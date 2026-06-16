var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FrontmatterIconPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  iconSize: 16,
  showInExplorer: true,
  showInLinks: true,
  iconAttributes: ["icon"]
};
var FrontmatterIconPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.explorerObserver = null;
    this.refreshTimer = null;
  }
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
    var _a;
    if (this.refreshTimer)
      clearTimeout(this.refreshTimer);
    (_a = this.explorerObserver) == null ? void 0 : _a.disconnect();
    document.querySelectorAll(".fmi-icon").forEach((el) => el.remove());
  }
  // ── File Explorer ────────────────────────────────────────────────────────
  initExplorerObserver() {
    if (this.explorerObserver)
      return;
    const container = document.querySelector(".nav-files-container");
    if (!container)
      return;
    this.explorerObserver = new MutationObserver((mutations) => {
      const isOwnChange = mutations.every(
        (m) => [...m.addedNodes, ...m.removedNodes].every(
          (n) => n instanceof HTMLElement && n.classList.contains("fmi-icon")
        )
      );
      if (isOwnChange)
        return;
      if (this.refreshTimer)
        clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.refreshExplorer(), 100);
    });
    this.explorerObserver.observe(container, {
      childList: true,
      subtree: true
    });
  }
  refreshExplorer() {
    document.querySelectorAll(".nav-file-title[data-path]").forEach((titleEl) => {
      const path = titleEl.dataset.path;
      if (!path)
        return;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof import_obsidian.TFile) {
        this.applyExplorerIcon(titleEl, file);
      }
    });
  }
  // Fix: avoid CSS selector injection — compare dataset.path directly
  refreshExplorerItem(file) {
    document.querySelectorAll(".nav-file-title[data-path]").forEach((titleEl) => {
      if (titleEl.dataset.path === file.path) {
        this.applyExplorerIcon(titleEl, file);
      }
    });
  }
  applyExplorerIcon(titleEl, file) {
    var _a;
    (_a = titleEl.querySelector(".fmi-icon")) == null ? void 0 : _a.remove();
    const url = this.getIconUrl(file);
    if (!url)
      return;
    const img = this.createIconImg(url, "fmi-explorer-icon");
    const content = titleEl.querySelector(".nav-file-title-content");
    titleEl.insertBefore(img, content != null ? content : titleEl.firstChild);
  }
  // ── Reading View Links ───────────────────────────────────────────────────
  processLinks(el, ctx) {
    el.querySelectorAll("a.internal-link").forEach((link) => {
      var _a;
      const href = link.dataset.href;
      if (!href)
        return;
      const target = this.app.metadataCache.getFirstLinkpathDest(
        href,
        ctx.sourcePath
      );
      if (!(target instanceof import_obsidian.TFile))
        return;
      const url = this.getIconUrl(target);
      if (!url)
        return;
      (_a = link.querySelector(".fmi-icon")) == null ? void 0 : _a.remove();
      const img = this.createIconImg(url, "fmi-link-icon");
      link.insertBefore(img, link.firstChild);
    });
  }
  // Refresh link icons in all open reading views that link to the changed file
  refreshOpenLinksTo(file) {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof import_obsidian.MarkdownView))
        return;
      if (leaf.view.getMode() !== "preview")
        return;
      const contentEl = leaf.view.contentEl;
      contentEl.querySelectorAll("a.internal-link[data-href]").forEach((link) => {
        var _a, _b, _c;
        const href = link.dataset.href;
        if (!href)
          return;
        const target = this.app.metadataCache.getFirstLinkpathDest(
          href,
          (_b = (_a = leaf.view.file) == null ? void 0 : _a.path) != null ? _b : ""
        );
        if (!(target instanceof import_obsidian.TFile))
          return;
        if (target.path !== file.path)
          return;
        (_c = link.querySelector(".fmi-icon")) == null ? void 0 : _c.remove();
        const url = this.getIconUrl(file);
        if (!url)
          return;
        const img = this.createIconImg(url, "fmi-link-icon");
        link.insertBefore(img, link.firstChild);
      });
    });
  }
  // ── Icon Resolution ──────────────────────────────────────────────────────
  getIconUrl(file) {
    var _a;
    const frontmatter = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    if (!frontmatter)
      return null;
    for (const attr of this.settings.iconAttributes) {
      const iconValue = frontmatter[attr];
      if (iconValue) {
        const url = this.resolveIconValue(String(iconValue).trim(), file);
        if (url)
          return url;
      }
    }
    return null;
  }
  resolveIconValue(raw, source) {
    if (/^https?:\/\//.test(raw))
      return raw;
    const wikiMatch = raw.match(/!?\[\[([^\]|]+)/);
    if (wikiMatch) {
      const linked2 = this.app.metadataCache.getFirstLinkpathDest(
        wikiMatch[1].trim(),
        source.path
      );
      if (linked2 instanceof import_obsidian.TFile)
        return this.app.vault.getResourcePath(linked2);
    }
    const mdMatch = raw.match(/!\[.*?\]\(([^)]+)\)/);
    if (mdMatch) {
      raw = mdMatch[1].trim();
    }
    const linked = this.app.metadataCache.getFirstLinkpathDest(
      raw,
      source.path
    );
    if (linked instanceof import_obsidian.TFile)
      return this.app.vault.getResourcePath(linked);
    const direct = this.app.vault.getAbstractFileByPath(raw);
    if (direct instanceof import_obsidian.TFile)
      return this.app.vault.getResourcePath(direct);
    return null;
  }
  // ── Helpers ──────────────────────────────────────────────────────────────
  createIconImg(src, extraClass) {
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
    if (!Array.isArray(this.settings.iconAttributes) || this.settings.iconAttributes.length === 0) {
      this.settings.iconAttributes = [...DEFAULT_SETTINGS.iconAttributes];
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var FrontmatterIconSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Frontmatter Icon" });
    new import_obsidian.Setting(containerEl).setName("Icon size (px)").setDesc("Width and height of the icon in pixels (12\u201332).").addSlider(
      (slider) => slider.setLimits(12, 32, 1).setValue(this.plugin.settings.iconSize).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.iconSize = value;
        await this.plugin.saveSettings();
        document.querySelectorAll(".fmi-icon").forEach((img) => {
          img.width = value;
          img.height = value;
        });
      })
    );
    new import_obsidian.Setting(containerEl).setName("Show icons in file explorer").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showInExplorer).onChange(async (value) => {
        this.plugin.settings.showInExplorer = value;
        await this.plugin.saveSettings();
        if (!value) {
          document.querySelectorAll(".fmi-explorer-icon").forEach((el) => el.remove());
        } else {
          this.plugin.initExplorerObserver();
          this.plugin.app.workspace.onLayoutReady(
            () => this.plugin.refreshExplorer()
          );
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Show icons in internal links").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showInLinks).onChange(async (value) => {
        this.plugin.settings.showInLinks = value;
        await this.plugin.saveSettings();
        if (!value) {
          document.querySelectorAll(".fmi-link-icon").forEach((el) => el.remove());
        }
      })
    );
    containerEl.createEl("h3", { text: "Frontmatter attribute names" });
    containerEl.createEl("p", {
      text: "The plugin checks these attributes in order and uses the first one that contains a value.",
      cls: "setting-item-description"
    });
    const listEl = containerEl.createDiv("fmi-attr-list");
    this.renderAttributeList(listEl);
    new import_obsidian.Setting(containerEl).addButton(
      (btn) => btn.setButtonText("Add attribute").setCta().onClick(async () => {
        this.plugin.settings.iconAttributes.push("new-attribute");
        await this.plugin.saveSettings();
        this.renderAttributeList(listEl);
      })
    );
  }
  renderAttributeList(listEl) {
    listEl.empty();
    const attrs = this.plugin.settings.iconAttributes;
    attrs.forEach((attr) => {
      const row = listEl.createDiv("fmi-attr-row");
      const input = row.createEl("input", {
        type: "text",
        value: attr,
        cls: "fmi-attr-input"
      });
      input.addEventListener("change", async () => {
        const val = input.value.trim();
        if (!val)
          return;
        const rows = Array.from(listEl.querySelectorAll(".fmi-attr-row"));
        const i = rows.indexOf(row);
        if (i !== -1 && i < this.plugin.settings.iconAttributes.length) {
          this.plugin.settings.iconAttributes[i] = val;
          await this.plugin.saveSettings();
        }
      });
      const delBtn = row.createEl("button", {
        text: "\xD7",
        cls: "fmi-attr-delete"
      });
      delBtn.setAttribute("aria-label", "Remove attribute");
      delBtn.addEventListener("click", async () => {
        const rows = Array.from(listEl.querySelectorAll(".fmi-attr-row"));
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
};
