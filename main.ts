import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    MarkdownPostProcessorContext,
} from "obsidian";

interface FrontmatterIconSettings {
    iconSize: number;
    showInExplorer: boolean;
    showInLinks: boolean;
}

const DEFAULT_SETTINGS: FrontmatterIconSettings = {
    iconSize: 16,
    showInExplorer: true,
    showInLinks: true,
};

export default class FrontmatterIconPlugin extends Plugin {
    settings!: FrontmatterIconSettings;
    private explorerObserver: MutationObserver | null = null;
    private isRefreshing = false;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new FrontmatterIconSettingTab(this.app, this));
        this.injectStyles();

        // Reading view: add icons to rendered internal links
        this.registerMarkdownPostProcessor((el, ctx) => {
            if (this.settings.showInLinks) {
                this.processLinks(el, ctx);
            }
        });

        // File explorer: add icons once the workspace is ready
        this.app.workspace.onLayoutReady(() => {
            if (this.settings.showInExplorer) {
                this.initExplorerObserver();
                this.refreshExplorer();
            }
        });

        // Refresh when any note's metadata changes
        this.registerEvent(
            this.app.metadataCache.on("changed", (file) => {
                if (this.settings.showInExplorer) {
                    this.refreshExplorerItem(file);
                }
            })
        );
    }

    onunload() {
        this.explorerObserver?.disconnect();
        document.querySelectorAll(".fmi-icon").forEach((el) => el.remove());
        document.getElementById("fmi-styles")?.remove();
    }

    // ── File Explorer ────────────────────────────────────────────────────────

    private initExplorerObserver() {
        const container = document.querySelector(".nav-files-container");
        if (!container) return;

        this.explorerObserver = new MutationObserver((mutations) => {
            // Ignore mutations caused by our own icon insertions/removals
            const isOwnChange = mutations.every((m) =>
                [...m.addedNodes, ...m.removedNodes].every(
                    (n) =>
                        n instanceof HTMLElement &&
                        n.classList.contains("fmi-icon")
                )
            );
            if (isOwnChange) return;

            // Debounce to avoid rapid-fire refreshes
            if (this.refreshTimer) clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => this.refreshExplorer(), 100);
        });
        this.explorerObserver.observe(container, {
            childList: true,
            subtree: true,
        });
    }

    private refreshExplorer() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;
        try {
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
        } finally {
            this.isRefreshing = false;
        }
    }

    private refreshExplorerItem(file: TFile) {
        const escaped = CSS.escape(file.path);
        const titleEl = document.querySelector<HTMLElement>(
            `.nav-file-title[data-path="${escaped}"]`
        );
        if (titleEl) this.applyExplorerIcon(titleEl, file);
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

    // ── Icon Resolution ──────────────────────────────────────────────────────

    getIconUrl(file: TFile): string | null {
        const frontmatter =
            this.app.metadataCache.getFileCache(file)?.frontmatter;
        const iconValue = frontmatter?.icon as string | undefined;
        if (!iconValue) return null;
        return this.resolveIconValue(String(iconValue).trim(), file);
    }

    private resolveIconValue(raw: string, source: TFile): string | null {
        // External URL
        if (/^https?:\/\//.test(raw)) return raw;

        // Wikilink embed: ![[image.png]] or ![[image.png|alias]]
        const wikiMatch = raw.match(/!?\[\[([^\]|]+)/);
        if (wikiMatch) {
            const linked = this.app.metadataCache.getFirstLinkpathDest(
                wikiMatch[1].trim(),
                source.path
            );
            if (linked instanceof TFile)
                return this.app.vault.getResourcePath(linked);
        }

        // Markdown image syntax: ![alt](path/to/image.png)
        const mdMatch = raw.match(/!\[.*?\]\(([^)]+)\)/);
        if (mdMatch) {
            raw = mdMatch[1].trim();
        }

        // Bare filename or vault-relative path
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

    private injectStyles() {
        if (document.getElementById("fmi-styles")) return;
        const style = document.createElement("style");
        style.id = "fmi-styles";
        style.textContent = `
            .fmi-icon {
                object-fit: contain;
                vertical-align: middle;
                border-radius: 2px;
                flex-shrink: 0;
                display: inline-block;
            }
            .fmi-explorer-icon { margin-right: 4px; }
            .fmi-link-icon { margin-right: 3px; position: relative; top: -1px; }
            .nav-file-title { display: flex; align-items: center; }
        `;
        document.head.appendChild(style);
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
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
                            this.plugin.app.workspace.onLayoutReady(() =>
                                (this.plugin as any).refreshExplorer()
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
    }
}
