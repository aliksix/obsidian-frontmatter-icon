import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    MarkdownPostProcessorContext,
    MarkdownView,
} from "obsidian";

interface FrontmatterIconSettings {
    iconSize: number;
    showInExplorer: boolean;
    showInLinks: boolean;
    iconAttributes: string[];
}

const DEFAULT_SETTINGS: FrontmatterIconSettings = {
    iconSize: 16,
    showInExplorer: true,
    showInLinks: true,
    iconAttributes: ["icon"],
};

export default class FrontmatterIconPlugin extends Plugin {
    settings!: FrontmatterIconSettings;
    private explorerObserver: MutationObserver | null = null;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new FrontmatterIconSettingTab(this.app, this));

        this.registerMarkdownPostProcessor((el, ctx) => {
            if (this.settings.showInLinks) {
                this.processLinks(el, ctx);
            }
        });

        this.app.workspace.onLayoutReady(() => {
            if (this.settings.showInExplorer) {
                this.initExplorerObserver();
                this.refreshExplorer();
            }
        });

        this.registerEvent(
            this.app.metadataCache.on("changed", (file) => {
                if (this.settings.showInExplorer) {
                    this.refreshExplorerItem(file);
                }
                if (this.settings.showInLinks) {
                    this.refreshOpenLinksTo(file);
                }
            })
        );
    }

    onunload() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.explorerObserver?.disconnect();
        document.querySelectorAll(".fmi-icon").forEach((el) => el.remove());
    }

    // ── File Explorer ────────────────────────────────────────────────────────

    initExplorerObserver() {
        if (this.explorerObserver) return;
        const container = document.querySelector(".nav-files-container");
        if (!container) return;

        this.explorerObserver = new MutationObserver((mutations) => {
            const isOwnChange = mutations.every((m) =>
                [...m.addedNodes, ...m.removedNodes].every(
                    (n) =>
                        n instanceof HTMLElement &&
                        n.classList.contains("fmi-icon")
                )
            );
            if (isOwnChange) return;

            if (this.refreshTimer) clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => this.refreshExplorer(), 100);
        });
        this.explorerObserver.observe(container, {
            childList: true,
            subtree: true,
        });
    }

    refreshExplorer() {
        document
            .querySelectorAll<HTMLElement>(".nav-file-title[data-path]")
            .forEach((titleEl) => {
                const path = titleEl.dataset.path;
                if (!path) return;
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    this.applyExplorerIcon(titleEl, file);
                }
            });
    }

    // Fix: avoid CSS selector injection — compare dataset.path directly
    private refreshExplorerItem(file: TFile) {
        document
            .querySelectorAll<HTMLElement>(".nav-file-title[data-path]")
            .forEach((titleEl) => {
                if (titleEl.dataset.path === file.path) {
                    this.applyExplorerIcon(titleEl, file);
                }
            });
    }

    private applyExplorerIcon(titleEl: HTMLElement, file: TFile) {
        titleEl.querySelector(".fmi-icon")?.remove();

        const url = this.getIconUrl(file);
        if (!url) return;

        const img = this.createIconImg(url, "fmi-explorer-icon");
        const content = titleEl.querySelector(".nav-file-title-content");
        titleEl.insertBefore(img, content ?? titleEl.firstChild);
    }

    // ── Reading View Links ───────────────────────────────────────────────────

    private processLinks(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        el.querySelectorAll<HTMLElement>("a.internal-link").forEach((link) => {
            const href = link.dataset.href;
            if (!href) return;

            const target = this.app.metadataCache.getFirstLinkpathDest(
                href,
                ctx.sourcePath
            );
            if (!(target instanceof TFile)) return;

            const url = this.getIconUrl(target);
            if (!url) return;

            link.querySelector(".fmi-icon")?.remove();
            const img = this.createIconImg(url, "fmi-link-icon");
            link.insertBefore(img, link.firstChild);
        });
    }

    // Refresh link icons in all open reading views that link to the changed file
    private refreshOpenLinksTo(file: TFile) {
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (!(leaf.view instanceof MarkdownView)) return;
            if (leaf.view.getMode() !== "preview") return;

            const contentEl = leaf.view.contentEl;
            contentEl
                .querySelectorAll<HTMLElement>("a.internal-link[data-href]")
                .forEach((link) => {
                    const href = link.dataset.href;
                    if (!href) return;
                    const target = this.app.metadataCache.getFirstLinkpathDest(
                        href,
                        leaf.view.file?.path ?? ""
                    );
                    if (!(target instanceof TFile)) return;
                    if (target.path !== file.path) return;

                    link.querySelector(".fmi-icon")?.remove();
                    const url = this.getIconUrl(file);
                    if (!url) return;
                    const img = this.createIconImg(url, "fmi-link-icon");
                    link.insertBefore(img, link.firstChild);
                });
        });
    }

    // ── Icon Resolution ──────────────────────────────────────────────────────

    getIconUrl(file: TFile): string | null {
        const frontmatter =
            this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!frontmatter) return null;

        for (const attr of this.settings.iconAttributes) {
            const iconValue = frontmatter[attr] as string | undefined;
            if (iconValue) {
                const url = this.resolveIconValue(String(iconValue).trim(), file);
                if (url) return url;
            }
        }
        return null;
    }

    private resolveIconValue(raw: string, source: TFile): string | null {
        if (/^https?:\/\//.test(raw)) return raw;

        const wikiMatch = raw.match(/!?\[\[([^\]|]+)/);
        if (wikiMatch) {
            const linked = this.app.metadataCache.getFirstLinkpathDest(
                wikiMatch[1].trim(),
                source.path
            );
            if (linked instanceof TFile)
                return this.app.vault.getResourcePath(linked);
        }

        const mdMatch = raw.match(/!\[.*?\]\(([^)]+)\)/);
        if (mdMatch) {
            raw = mdMatch[1].trim();
        }

        const linked = this.app.metadataCache.getFirstLinkpathDest(
            raw,
            source.path
        );
        if (linked instanceof TFile)
            return this.app.vault.getResourcePath(linked);

        const direct = this.app.vault.getAbstractFileByPath(raw);
        if (direct instanceof TFile)
            return this.app.vault.getResourcePath(direct);

        return null;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private createIconImg(src: string, extraClass: string): HTMLImageElement {
        const img = document.createElement("img");
        img.className = `fmi-icon ${extraClass}`;
        img.src = src;
        img.width = this.settings.iconSize;
        img.height = this.settings.iconSize;
        img.setAttribute("aria-hidden", "true");
        return img;
    }

    async loadSettings() {
        const saved = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
        // Ensure iconAttributes is always a non-empty array
        if (!Array.isArray(this.settings.iconAttributes) || this.settings.iconAttributes.length === 0) {
            this.settings.iconAttributes = [...DEFAULT_SETTINGS.iconAttributes];
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

class FrontmatterIconSettingTab extends PluginSettingTab {
    plugin: FrontmatterIconPlugin;

    constructor(app: App, plugin: FrontmatterIconPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Frontmatter Icon" });

        new Setting(containerEl)
            .setName("Icon size (px)")
            .setDesc("Width and height of the icon in pixels (12–32).")
            .addSlider((slider) =>
                slider
                    .setLimits(12, 32, 1)
                    .setValue(this.plugin.settings.iconSize)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.iconSize = value;
                        await this.plugin.saveSettings();
                        document
                            .querySelectorAll<HTMLImageElement>(".fmi-icon")
                            .forEach((img) => {
                                img.width = value;
                                img.height = value;
                            });
                    })
            );

        new Setting(containerEl)
            .setName("Show icons in file explorer")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showInExplorer)
                    .onChange(async (value) => {
                        this.plugin.settings.showInExplorer = value;
                        await this.plugin.saveSettings();
                        if (!value) {
                            document
                                .querySelectorAll(".fmi-explorer-icon")
                                .forEach((el) => el.remove());
                        } else {
                            // Fix: also start the observer if it wasn't running
                            this.plugin.initExplorerObserver();
                            this.plugin.app.workspace.onLayoutReady(() =>
                                this.plugin.refreshExplorer()
                            );
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Show icons in internal links")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showInLinks)
                    .onChange(async (value) => {
                        this.plugin.settings.showInLinks = value;
                        await this.plugin.saveSettings();
                        if (!value) {
                            document
                                .querySelectorAll(".fmi-link-icon")
                                .forEach((el) => el.remove());
                        }
                    })
            );

        containerEl.createEl("h3", { text: "Frontmatter attribute names" });
        containerEl.createEl("p", {
            text: "The plugin checks these attributes in order and uses the first one that contains a value.",
            cls: "setting-item-description",
        });

        const listEl = containerEl.createDiv("fmi-attr-list");
        this.renderAttributeList(listEl);

        new Setting(containerEl).addButton((btn) =>
            btn
                .setButtonText("Add attribute")
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.iconAttributes.push("new-attribute");
                    await this.plugin.saveSettings();
                    this.renderAttributeList(listEl);
                })
        );
    }

    private renderAttributeList(listEl: HTMLElement) {
        listEl.empty();
        const attrs = this.plugin.settings.iconAttributes;

        attrs.forEach((attr) => {
            const row = listEl.createDiv("fmi-attr-row");

            const input = row.createEl("input", {
                type: "text",
                value: attr,
                cls: "fmi-attr-input",
            });

            // Fix: resolve position from DOM at event time, not from captured index
            input.addEventListener("change", async () => {
                const val = input.value.trim();
                if (!val) return;
                const rows = Array.from(listEl.querySelectorAll<HTMLElement>(".fmi-attr-row"));
                const i = rows.indexOf(row);
                if (i !== -1 && i < this.plugin.settings.iconAttributes.length) {
                    this.plugin.settings.iconAttributes[i] = val;
                    await this.plugin.saveSettings();
                }
            });

            const delBtn = row.createEl("button", {
                text: "×",
                cls: "fmi-attr-delete",
            });
            delBtn.setAttribute("aria-label", "Remove attribute");
            delBtn.addEventListener("click", async () => {
                const rows = Array.from(listEl.querySelectorAll<HTMLElement>(".fmi-attr-row"));
                const i = rows.indexOf(row);
                if (i !== -1) {
                    this.plugin.settings.iconAttributes.splice(i, 1);
                }
                if (this.plugin.settings.iconAttributes.length === 0) {
                    this.plugin.settings.iconAttributes.push("icon");
                }
                await this.plugin.saveSettings();
                this.renderAttributeList(listEl);
            });
        });
    }
}
