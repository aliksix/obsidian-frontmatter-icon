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
  showInLinks: true
};
var FrontmatterIconPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.explorerObserver = null;
    this.isRefreshing = false;
    this.refreshTimer = null;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FrontmatterIconSettingTab(this.app, this));
    this.injectStyles();
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
      })
    );
  }
  onunload() {
    var _a, _b;
    (_a = this.explorerObserver) == null ? void 0 : _a.disconnect();
    document.querySelectorAll(".fmi-icon").forEach((el) => el.remove());
    (_b = document.getElementById("fmi-styles")) == null ? void 0 : _b.remove();
  }
  // ── File Explorer ────────────────────────────────────────────────────────
  initExplorerObserver() {
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
    if (this.isRefreshing)
      return;
    this.isRefreshing = true;
    try {
      document.querySelectorAll(".nav-file-title[data-path]").forEach((titleEl) => {
        const path = titleEl.dataset.path;
        if (!path)
          return;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian.TFile) {
          this.applyExplorerIcon(titleEl, file);
        }
      });
    } finally {
      this.isRefreshing = false;
    }
  }
  refreshExplorerItem(file) {
    const escaped = CSS.escape(file.path);
    const titleEl = document.querySelector(
      `.nav-file-title[data-path="${escaped}"]`
    );
    if (titleEl)
      this.applyExplorerIcon(titleEl, file);
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
  // ── Icon Resolution ──────────────────────────────────────────────────────
  getIconUrl(file) {
    var _a;
    const frontmatter = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    const iconValue = frontmatter == null ? void 0 : frontmatter.icon;
    if (!iconValue)
      return null;
    return this.resolveIconValue(String(iconValue).trim(), file);
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
  injectStyles() {
    if (document.getElementById("fmi-styles"))
      return;
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
  }
};
