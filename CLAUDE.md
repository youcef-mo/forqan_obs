# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian community plugin template. TypeScript source in `src/` is bundled by esbuild into a single `main.js` (CommonJS). The three required plugin artifacts are `main.js`, `manifest.json`, and `styles.css`.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode — rebuilds on file changes
npm run build        # Production build (tsc type-check + minified bundle)
npm run lint         # ESLint with obsidianmd plugin rules
npm version patch    # Bump version in package.json, manifest.json, versions.json
```

No test framework is configured.

## Architecture

- **`src/main.ts`** — Plugin entry point. `MyPlugin extends Plugin` with `onload()`/`onunload()` lifecycle. Registers commands, ribbon icons, status bar, event listeners, and the settings tab.
- **`src/settings.ts`** — `MyPluginSettings` interface, `DEFAULT_SETTINGS` constant, and `SampleSettingTab extends PluginSettingTab`.
- **`esbuild.config.mjs`** — Bundles `src/main.ts` → `main.js`. Externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, and Node built-ins. Dev mode uses watch + inline source maps; production mode minifies.
- **`manifest.json`** — Plugin ID, name, version, and `minAppVersion`. Never change `id` after release.
- **`versions.json`** — Maps plugin version → minimum Obsidian version.

## Key Conventions

- **Indentation:** Tabs (see `.editorconfig`)
- **TypeScript strict mode:** `strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess`, etc.
- **Settings pattern:** `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` for loading; `this.saveData(this.settings)` for saving.
- **Resource cleanup:** Use `this.registerDomEvent()`, `this.registerInterval()`, `this.registerEvent()` — Obsidian handles cleanup on unload automatically.
- **Command IDs:** kebab-case (e.g., `open-modal-simple`).
- **Keep `main.ts` minimal** — extract features into separate modules.
- **`main.js` is a build artifact** — it's in `.gitignore`, don't commit it.

## AGENTS.md

The repo includes a detailed `AGENTS.md` with plugin-specific guidelines on security, UX, performance, mobile considerations, and common tasks. Consult it for Obsidian plugin development patterns.

## CI

GitHub Actions (`.github/workflows/lint.yml`) runs build + lint on Node 20.x and 22.x for all pushes and PRs.
