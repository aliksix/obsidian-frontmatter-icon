# Frontmatter Icon

An [Obsidian](https://obsidian.md) plugin that displays an image from the note's `icon` frontmatter field as an icon in the file explorer and next to internal links in Reading View.

## Usage

Add an `icon` field to any note's frontmatter. The following formats are supported:

**Wikilink to a vault image:**
```yaml
---
icon: "![[my-image.png]]"
---
```

**Vault-relative path:**
```yaml
---
icon: assets/icons/logo.png
---
```

**External URL:**
```yaml
---
icon: https://example.com/icon.png
---
```

The icon will appear:
- **In the file explorer** — to the left of the note name
- **In Reading View** — to the left of any `[[internal link]]` that points to a note with an icon

> Icons in links are only visible in **Reading View**, not in Live Preview or Source mode.

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest).
2. Copy them into your vault at `.obsidian/plugins/frontmatter-icon/`.
3. In Obsidian: Settings → Community plugins → enable **Frontmatter Icon**.

### Community Plugins (coming soon)

Search for **Frontmatter Icon** in Settings → Community plugins → Browse.

## Settings

| Setting | Default | Description |
|---|---|---|
| Icon size | 16 px | Width and height of icons |
| Show icons in file explorer | On | Toggle explorer icons |
| Show icons in internal links | On | Toggle link icons |

## Development

```bash
git clone https://github.com/aliksix/obsidian-frontmatter-icon
cd obsidian-frontmatter-icon
npm install
npm run dev      # watch mode
npm run build    # production build
```

Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/frontmatter-icon/` in your vault.

## License

MIT
