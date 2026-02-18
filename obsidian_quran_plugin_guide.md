# Comprehensive Guide: Building an Obsidian Plugin for Quran.com

This guide walks you through creating an Obsidian plugin that integrates with the **official [@quranjs/api SDK](https://api-docs.quran.foundation/docs/sdk/javascript)** for the Quran.Foundation API.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Using the @quranjs/api SDK](#using-the-quranjsapi-sdk)
5. [Core Plugin Architecture](#core-plugin-architecture)
6. [Implementing Core Features](#implementing-core-features)
7. [Quran Vault Generator](#quran-vault-generator) ⭐ NEW
8. [Custom Reading Collections](#custom-reading-collections) ⭐ NEW
9. [UI Components](#ui-components)
10. [Arabic Font Support](#arabic-font-support)
11. [Testing & Publishing](#testing--publishing)

---

## Overview

This Obsidian plugin provides comprehensive Quran reading functionality:
- **Surah List View** - Browse all 114 surahs
- **Verse Reading** - Display verses with Arabic text
- **Translations** - Show translations alongside Arabic
- **Search** - Search verses by keyword
- **Quran Vault Generator** ⭐ - Generate 604 pages + 114 surahs as linked notes for beautiful graph view
- **Custom Reading Collections** ⭐ - Create personalized reading pages (e.g., Moses story from Al-Kahf)
- **Memorization Tracking** ⭐ - Track progress with visual graph connections

---

## Prerequisites

- **Node.js** (v18+) and npm
- **TypeScript** knowledge
- **Obsidian** installed (latest version)
- **Quran.Foundation API credentials** - Register at [api-docs.quran.foundation](https://api-docs.quran.foundation)
- A dedicated **development vault** (separate from your main vault)

---

## Project Setup

### 1. Create Plugin Directory

```bash
mkdir -p /path/to/your-vault/.obsidian/plugins/obsidian-quran
cd /path/to/your-vault/.obsidian/plugins/obsidian-quran
```

### 2. Initialize the Project

```bash
npm init -y
npm install @quranjs/api
npm install -D obsidian @types/node esbuild typescript
```

### 3. Project Structure

```
obsidian-quran/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── quranClient.ts          # SDK client wrapper
│   ├── views/
│   │   ├── QuranReaderView.ts  # Main reading view
│   │   ├── SurahListView.ts    # Surah selection
│   │   └── SearchView.ts       # Search functionality
│   ├── settings/
│   │   └── SettingsTab.ts      # Plugin settings
│   └── utils/
│       └── helpers.ts          # Utility functions
├── styles.css                  # Plugin styles
├── manifest.json               # Obsidian manifest
├── package.json
├── tsconfig.json
└── esbuild.config.mjs
```

### 4. Configuration Files

#### `manifest.json`
```json
{
  "id": "obsidian-quran",
  "name": "Quran Reader",
  "version": "1.0.0",
  "minAppVersion": "1.0.0",
  "description": "Read and study the Quran within Obsidian",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourusername",
  "isDesktopOnly": false
}
```

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2020",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "lib": ["DOM", "ES2020"]
  },
  "include": ["src/**/*.ts"]
}
```

#### `esbuild.config.mjs`
```javascript
import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  watch: !prod,
}).catch(() => process.exit(1));
```

---

## Using the @quranjs/api SDK

The official SDK simplifies API interactions with typed responses and built-in authentication.

### Installation

```bash
npm install @quranjs/api
```

### SDK Quick Reference

```typescript
import { QuranClient, Language, SearchMode } from "@quranjs/api";

// Initialize the client
const client = new QuranClient({
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET",
  defaults: {
    language: Language.ENGLISH,
  },
});

// === CHAPTERS API ===
const chapters = await client.chapters.findAll();
const chapter = await client.chapters.findById("1");
const chapterInfo = await client.chapters.findInfoById("1");

// === VERSES API ===
const verses = await client.verses.findByChapter("1");
const verse = await client.verses.findByKey("2:255", {
  translations: [131],
  words: true,
});
const pageVerses = await client.verses.findByPage("1");
const juzVerses = await client.verses.findByJuz("30");
const randomVerse = await client.verses.findRandom({ translations: [20] });

// === RESOURCES API ===
const translations = await client.resources.findAllTranslations();
const tafsirs = await client.resources.findAllTafsirs();
const reciters = await client.resources.findAllRecitations();
const languages = await client.resources.findAllLanguages();

// === SEARCH API ===
const results = await client.search.search("mercy", {
  mode: SearchMode.Quick,
  language: Language.ENGLISH,
});
```

### Key SDK Types

```typescript
// Chapter type from SDK
interface Chapter {
  id: number;
  nameSimple: string;      // "Al-Fatihah"
  nameArabic: string;      // "الفاتحة"
  versesCount: number;
  revelationPlace: string; // "makkah" | "madinah"
  revelationOrder: number;
  pages: number[];
}

// Verse type from SDK
interface Verse {
  id: number;
  verseNumber: number;
  verseKey: string;        // "1:1"
  textUthmani: string;
  textImlaei: string;
  words?: Word[];
  translations?: Translation[];
}

// Translation type
interface Translation {
  id: number;
  text: string;
  resourceName: string;
  languageName: string;
}
```

---

## Core Plugin Architecture

### Main Entry Point

```typescript
// src/main.ts
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { QuranReaderView, VIEW_TYPE_QURAN_READER } from './views/QuranReaderView';
import { QuranSettingsTab } from './settings/SettingsTab';
import { QuranClient, Language } from '@quranjs/api';

interface QuranPluginSettings {
  clientId: string;
  clientSecret: string;
  defaultTranslation: number;
  showArabic: boolean;
  showTranslation: boolean;
  fontSize: number;
  language: string;
}

const DEFAULT_SETTINGS: QuranPluginSettings = {
  clientId: '',
  clientSecret: '',
  defaultTranslation: 131, // Sahih International
  showArabic: true,
  showTranslation: true,
  fontSize: 24,
  language: 'en',
};

export default class QuranPlugin extends Plugin {
  settings: QuranPluginSettings;
  client: QuranClient | null = null;

  async onload() {
    await this.loadSettings();
    this.initializeClient();

    this.registerView(
      VIEW_TYPE_QURAN_READER,
      (leaf) => new QuranReaderView(leaf, this)
    );

    this.addRibbonIcon('book-open', 'Open Quran', () => this.activateView());

    this.addCommand({
      id: 'open-quran-reader',
      name: 'Open Quran Reader',
      callback: () => this.activateView(),
    });

    this.addSettingTab(new QuranSettingsTab(this.app, this));
  }

  initializeClient() {
    if (this.settings.clientId && this.settings.clientSecret) {
      this.client = new QuranClient({
        clientId: this.settings.clientId,
        clientSecret: this.settings.clientSecret,
        defaults: {
          language: this.settings.language as Language,
        },
      });
    }
  }

  async activateView() {
    if (!this.client) {
      new Notice('Please configure API credentials in settings first.');
      return;
    }

    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_QURAN_READER)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE_QURAN_READER, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.initializeClient();
  }

  onunload() {}
}
```

---

## Implementing Core Features

### Surah List View

```typescript
// src/views/SurahListView.ts
import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type QuranPlugin from '../main';
import type { Chapter } from '@quranjs/api';

export const VIEW_TYPE_SURAH_LIST = 'surah-list-view';

export class SurahListView extends ItemView {
  plugin: QuranPlugin;
  chapters: Chapter[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: QuranPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE_SURAH_LIST; }
  getDisplayText() { return 'Surah List'; }
  getIcon() { return 'list'; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('quran-surah-list');

    if (!this.plugin.client) {
      container.createEl('div', { text: 'API not configured', cls: 'error' });
      return;
    }

    container.createEl('div', { text: 'Loading...', cls: 'loading' });

    try {
      // Using SDK - simple one-liner!
      this.chapters = await this.plugin.client.chapters.findAll();
      this.renderChapterList(container);
    } catch (error) {
      container.empty();
      container.createEl('div', { text: `Error: ${error.message}`, cls: 'error' });
    }
  }

  private renderChapterList(container: Element) {
    container.empty();
    container.createEl('h2', { text: 'Surahs of the Quran', cls: 'surah-list-header' });

    const list = container.createEl('div', { cls: 'surah-list' });

    for (const chapter of this.chapters) {
      const item = list.createEl('div', { cls: 'surah-item' });
      
      item.createEl('span', { text: String(chapter.id), cls: 'surah-number' });

      const info = item.createEl('div', { cls: 'surah-info' });
      info.createEl('span', { text: chapter.nameSimple, cls: 'surah-name-transliterated' });
      info.createEl('span', { text: `${chapter.versesCount} verses`, cls: 'surah-meta' });

      item.createEl('span', { text: chapter.nameArabic, cls: 'surah-name-arabic' });

      item.addEventListener('click', () => {
        this.app.workspace.trigger('quran:open-chapter', chapter.id);
      });
    }
  }
}
```

### Main Quran Reader View

```typescript
// src/views/QuranReaderView.ts
import { ItemView, WorkspaceLeaf, Menu, Notice } from 'obsidian';
import type QuranPlugin from '../main';
import type { Chapter, Verse } from '@quranjs/api';

export const VIEW_TYPE_QURAN_READER = 'quran-reader-view';

export class QuranReaderView extends ItemView {
  plugin: QuranPlugin;
  currentChapter = 1;
  verses: Verse[] = [];
  chapterInfo: Chapter | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: QuranPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE_QURAN_READER; }
  getDisplayText() { return this.chapterInfo?.nameSimple ?? 'Quran Reader'; }
  getIcon() { return 'book-open'; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('quran-reader');

    this.renderNavigation(container);
    container.createEl('div', { cls: 'quran-content' });

    await this.loadChapter(this.currentChapter);
  }

  private renderNavigation(container: Element) {
    const nav = container.createEl('div', { cls: 'quran-nav' });

    const prevBtn = nav.createEl('button', { text: '← Previous', cls: 'nav-btn' });
    prevBtn.addEventListener('click', () => this.navigateChapter(-1));

    const selector = nav.createEl('select', { cls: 'chapter-selector' });
    for (let i = 1; i <= 114; i++) {
      const option = selector.createEl('option', { text: `Surah ${i}`, value: String(i) });
      if (i === this.currentChapter) option.selected = true;
    }
    selector.addEventListener('change', (e) => {
      this.loadChapter(Number((e.target as HTMLSelectElement).value));
    });

    const nextBtn = nav.createEl('button', { text: 'Next →', cls: 'nav-btn' });
    nextBtn.addEventListener('click', () => this.navigateChapter(1));
  }

  private async navigateChapter(delta: number) {
    const next = this.currentChapter + delta;
    if (next >= 1 && next <= 114) await this.loadChapter(next);
  }

  async loadChapter(chapterId: number) {
    const content = this.containerEl.querySelector('.quran-content');
    if (!content || !this.plugin.client) return;

    content.empty();
    content.createEl('div', { text: 'Loading...', cls: 'loading' });

    try {
      this.currentChapter = chapterId;

      // Fetch using SDK - clean and typed!
      const [chapter, versesResponse] = await Promise.all([
        this.plugin.client.chapters.findById(String(chapterId)),
        this.plugin.client.verses.findByChapter(String(chapterId), {
          translations: [this.plugin.settings.defaultTranslation],
          words: true,
          perPage: 300,
        }),
      ]);

      this.chapterInfo = chapter;
      this.verses = versesResponse.verses;

      this.renderChapter(content);
      this.leaf.updateHeader();
    } catch (error) {
      content.empty();
      content.createEl('div', { text: `Error: ${error.message}`, cls: 'error' });
    }
  }

  private renderChapter(container: Element) {
    container.empty();

    if (!this.chapterInfo) return;

    // Header
    const header = container.createEl('div', { cls: 'chapter-header' });
    header.createEl('h1', { text: this.chapterInfo.nameSimple, cls: 'chapter-title' });
    header.createEl('h2', { text: this.chapterInfo.nameArabic, cls: 'chapter-title-arabic' });
    header.createEl('p', {
      text: `${this.chapterInfo.versesCount} verses • ${this.chapterInfo.revelationPlace}`,
      cls: 'chapter-subtitle',
    });

    // Bismillah (except Surah 9)
    if (this.currentChapter !== 9 && this.currentChapter !== 1) {
      container.createEl('div', {
        text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        cls: 'bismillah',
      });
    }

    // Verses
    const versesContainer = container.createEl('div', { cls: 'verses-container' });

    for (const verse of this.verses) {
      this.renderVerse(versesContainer, verse);
    }
  }

  private renderVerse(container: Element, verse: Verse) {
    const verseEl = container.createEl('div', { cls: 'verse' });
    verseEl.dataset.verseKey = verse.verseKey;

    verseEl.createEl('span', { text: String(verse.verseNumber), cls: 'verse-number' });

    // Arabic text
    if (this.plugin.settings.showArabic && verse.textUthmani) {
      verseEl.createEl('div', { text: verse.textUthmani, cls: 'verse-arabic' });
    }

    // Translation
    if (this.plugin.settings.showTranslation && verse.translations?.length) {
      const translation = verse.translations[0];
      const transEl = verseEl.createEl('div', { cls: 'verse-translation' });
      transEl.innerHTML = translation.text;
    }

    // Context menu
    verseEl.addEventListener('contextmenu', (e) => this.showVerseMenu(e, verse));
  }

  private showVerseMenu(event: MouseEvent, verse: Verse) {
    const menu = new Menu();

    menu.addItem((item) =>
      item.setTitle('Copy Arabic').setIcon('copy').onClick(() => {
        navigator.clipboard.writeText(verse.textUthmani || '');
        new Notice('Copied!');
      })
    );

    menu.addItem((item) =>
      item.setTitle('Copy Reference').setIcon('link').onClick(() => {
        navigator.clipboard.writeText(verse.verseKey);
        new Notice('Reference copied!');
      })
    );

    menu.addItem((item) =>
      item.setTitle('Insert as Quote').setIcon('edit').onClick(() => {
        this.insertVerseAsNote(verse);
      })
    );

    menu.showAtMouseEvent(event);
  }

  private insertVerseAsNote(verse: Verse) {
    const content = `
> [!quote] Quran ${verse.verseKey}
> ${verse.textUthmani || ''}
> 
> ${verse.translations?.[0]?.text || ''}
`;
    const editor = this.app.workspace.activeEditor?.editor;
    if (editor) {
      editor.replaceSelection(content);
      new Notice('Verse inserted!');
    }
  }
}
```

### Search View

```typescript
// src/views/SearchView.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type QuranPlugin from '../main';
import { SearchMode } from '@quranjs/api';

export const VIEW_TYPE_SEARCH = 'quran-search-view';

export class SearchView extends ItemView {
  plugin: QuranPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: QuranPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE_SEARCH; }
  getDisplayText() { return 'Search Quran'; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    const searchInput = container.createEl('input', {
      type: 'text',
      placeholder: 'Search verses...',
      cls: 'search-input',
    });

    const results = container.createEl('div', { cls: 'search-results' });

    searchInput.addEventListener('input', async (e) => {
      const query = (e.target as HTMLInputElement).value;
      if (query.length < 3) return;

      results.empty();
      results.createEl('div', { text: 'Searching...', cls: 'loading' });

      try {
        // Using SDK search
        const searchResults = await this.plugin.client?.search.search(query, {
          mode: SearchMode.Quick,
          size: 20,
        });

        results.empty();

        if (!searchResults?.results?.length) {
          results.createEl('div', { text: 'No results found', cls: 'no-results' });
          return;
        }

        for (const result of searchResults.results) {
          const item = results.createEl('div', { cls: 'search-result-item' });
          item.createEl('span', { text: result.verseKey, cls: 'result-key' });
          item.createEl('div', { cls: 'result-text' }).innerHTML = result.highlightedText;
        }
      } catch (error) {
        results.empty();
        results.createEl('div', { text: `Error: ${error.message}`, cls: 'error' });
      }
    });
  }
}
```

---

## Settings Tab

```typescript
// src/settings/SettingsTab.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import type QuranPlugin from '../main';

export class QuranSettingsTab extends PluginSettingTab {
  plugin: QuranPlugin;

  constructor(app: App, plugin: QuranPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Quran Reader Settings' });

    // API Credentials
    containerEl.createEl('h3', { text: 'API Credentials' });
    containerEl.createEl('p', { 
      text: 'Get credentials at api-docs.quran.foundation',
      cls: 'setting-item-description'
    });

    new Setting(containerEl)
      .setName('Client ID')
      .addText((text) =>
        text
          .setPlaceholder('Enter client ID')
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Client Secret')
      .addText((text) =>
        text
          .setPlaceholder('Enter client secret')
          .setValue(this.plugin.settings.clientSecret)
          .onChange(async (value) => {
            this.plugin.settings.clientSecret = value;
            await this.plugin.saveSettings();
          })
      );

    // Display Settings
    containerEl.createEl('h3', { text: 'Display' });

    new Setting(containerEl)
      .setName('Show Arabic Text')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showArabic)
          .onChange(async (value) => {
            this.plugin.settings.showArabic = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show Translation')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTranslation)
          .onChange(async (value) => {
            this.plugin.settings.showTranslation = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default Translation')
      .addDropdown((dropdown) => {
        const translations: Record<string, string> = {
          '131': 'Sahih International',
          '85': 'Abdul Haleem',
          '20': 'Pickthall',
          '22': 'Yusuf Ali',
          '84': 'Mufti Taqi Usmani',
        };

        Object.entries(translations).forEach(([id, name]) => {
          dropdown.addOption(id, name);
        });

        dropdown
          .setValue(String(this.plugin.settings.defaultTranslation))
          .onChange(async (value) => {
            this.plugin.settings.defaultTranslation = Number(value);
            await this.plugin.saveSettings();
          });
      });
  }
}
```

---

## Quran Vault Generator

This feature generates organized markdown notes for all **604 Quran pages** and **114 surahs**, creating a beautiful interconnected graph in Obsidian.

### Folder Structure Generated

```
Quran/
├── Surahs/
│   ├── 001 - Al-Fatihah.md
│   ├── 002 - Al-Baqarah.md
│   ├── ...
│   └── 114 - An-Nas.md
├── Pages/
│   ├── Page 001.md
│   ├── Page 002.md
│   ├── ...
│   └── Page 604.md
├── Juz/
│   ├── Juz 01.md
│   ├── ...
│   └── Juz 30.md
├── Collections/
│   └── (User-created custom pages)
└── _Index.md
```

### Page-to-Surah Linking

Each page links to its parent surah(s), creating a visual graph:

```
Page 001.md → [[001 - Al-Fatihah]]
Page 002.md → [[001 - Al-Fatihah]], [[002 - Al-Baqarah]]
```

### Vault Generator Implementation

```typescript
// src/generators/VaultGenerator.ts
import { Notice, TFolder, normalizePath } from 'obsidian';
import type QuranPlugin from '../main';
import type { Chapter, Verse } from '@quranjs/api';

interface PageMapping {
  page: number;
  chapters: number[];
  startVerse: string;
  endVerse: string;
}

export class VaultGenerator {
  plugin: QuranPlugin;
  baseFolder = 'Quran';

  constructor(plugin: QuranPlugin) {
    this.plugin = plugin;
  }

  async generateFullVault(options: {
    includeTranslation: boolean;
    translationId: number;
  }): Promise<void> {
    const notice = new Notice('Generating Quran vault...', 0);

    try {
      // Create folder structure
      await this.createFolders();

      // Generate surah notes
      await this.generateSurahNotes(options);

      // Generate page notes with links
      await this.generatePageNotes(options);

      // Generate index
      await this.generateIndex();

      notice.hide();
      new Notice('✅ Quran vault generated successfully!');
    } catch (error) {
      notice.hide();
      new Notice(`❌ Error: ${error.message}`);
    }
  }

  private async createFolders(): Promise<void> {
    const folders = ['Surahs', 'Pages', 'Juz', 'Collections'];
    
    for (const folder of folders) {
      const path = normalizePath(`${this.baseFolder}/${folder}`);
      if (!this.plugin.app.vault.getAbstractFileByPath(path)) {
        await this.plugin.app.vault.createFolder(path);
      }
    }
  }

  private async generateSurahNotes(options: {
    includeTranslation: boolean;
    translationId: number;
  }): Promise<void> {
    const chapters = await this.plugin.client!.chapters.findAll();

    for (const chapter of chapters) {
      const fileName = `${String(chapter.id).padStart(3, '0')} - ${chapter.nameSimple}.md`;
      const path = normalizePath(`${this.baseFolder}/Surahs/${fileName}`);

      const content = this.generateSurahContent(chapter, options);
      await this.plugin.app.vault.create(path, content);
    }
  }

  private generateSurahContent(chapter: Chapter, options: any): string {
    return `---
surah: ${chapter.id}
name_arabic: "${chapter.nameArabic}"
name_english: "${chapter.nameSimple}"
verses_count: ${chapter.versesCount}
revelation_place: "${chapter.revelationPlace}"
pages: [${chapter.pages.join(', ')}]
status: "not_started"
tags: [quran, surah, ${chapter.revelationPlace}]
---

# ${chapter.nameSimple}

## ${chapter.nameArabic}

| Property | Value |
|----------|-------|
| **English** | ${chapter.nameSimple} |
| **Verses** | ${chapter.versesCount} |
| **Revelation** | ${chapter.revelationPlace} |
| **Pages** | ${chapter.pages[0]} - ${chapter.pages[chapter.pages.length - 1]} |

## Pages in this Surah

${chapter.pages.map(p => `- [[Page ${String(p).padStart(3, '0')}]]`).join('\n')}

## Reading Progress

- [ ] Started reading
- [ ] Completed reading
- [ ] Memorized

## Notes

`;
  }

  private async generatePageNotes(options: any): Promise<void> {
    // Get page mappings from API
    for (let page = 1; page <= 604; page++) {
      const verses = await this.plugin.client!.verses.findByPage(String(page), {
        translations: options.includeTranslation ? [options.translationId] : undefined,
        words: true,
      });

      // Find which surahs are on this page
      const surahsOnPage = [...new Set(verses.verses.map(v => v.chapterId))];
      const chapters = await Promise.all(
        surahsOnPage.map(id => this.plugin.client!.chapters.findById(String(id)))
      );

      const fileName = `Page ${String(page).padStart(3, '0')}.md`;
      const path = normalizePath(`${this.baseFolder}/Pages/${fileName}`);

      const content = this.generatePageContent(page, verses.verses, chapters, options);
      await this.plugin.app.vault.create(path, content);

      // Progress update every 50 pages
      if (page % 50 === 0) {
        new Notice(`Generated ${page}/604 pages...`);
      }
    }
  }

  private generatePageContent(
    page: number,
    verses: Verse[],
    chapters: Chapter[],
    options: any
  ): string {
    const surahLinks = chapters.map(c => 
      `[[${String(c.id).padStart(3, '0')} - ${c.nameSimple}|${c.nameSimple}]]`
    ).join(', ');

    const juzNumber = Math.ceil(page / 20.13); // Approximate juz calculation
    const firstVerse = verses[0]?.verseKey || '';
    const lastVerse = verses[verses.length - 1]?.verseKey || '';

    let versesContent = '';
    for (const verse of verses) {
      versesContent += `
### ${verse.verseKey}

> ${verse.textUthmani || ''}

${options.includeTranslation && verse.translations?.[0] 
  ? verse.translations[0].text 
  : ''}

---
`;
    }

    return `---
page: ${page}
juz: ${juzNumber}
surahs: [${chapters.map(c => c.id).join(', ')}]
first_verse: "${firstVerse}"
last_verse: "${lastVerse}"
status: "not_read"
memorized: false
tags: [quran, page, juz-${juzNumber}]
---

# Page ${page}

**Surahs:** ${surahLinks}
**Juz:** [[Juz ${String(juzNumber).padStart(2, '0')}]]
**Verses:** ${firstVerse} → ${lastVerse}

---

${versesContent}

## Status

- [ ] Read
- [ ] Memorized
- [ ] Reviewed
`;
  }

  private async generateIndex(): Promise<void> {
    const content = `---
tags: [quran, index]
---

# 📖 Quran Index

## Quick Navigation

### By Surah
\`\`\`dataview
TABLE name_arabic as "Arabic", verses_count as "Verses", status
FROM "Quran/Surahs"
SORT surah ASC
\`\`\`

### Reading Progress
\`\`\`dataview
TABLE length(filter(file.tasks, (t) => t.completed)) as "Completed"
FROM "Quran/Pages"
WHERE status = "read"
\`\`\`

### Memorization Progress
\`\`\`dataview
LIST
FROM "Quran/Pages"
WHERE memorized = true
SORT page ASC
\`\`\`

## Statistics

- **Total Surahs:** 114
- **Total Pages:** 604
- **Total Juz:** 30
`;

    const path = normalizePath(`${this.baseFolder}/_Index.md`);
    await this.plugin.app.vault.create(path, content);
  }
}
```

### Adding Command to Generate Vault

```typescript
// Add to main.ts onload()
this.addCommand({
  id: 'generate-quran-vault',
  name: 'Generate Quran Vault (604 pages + 114 surahs)',
  callback: async () => {
    const generator = new VaultGenerator(this);
    await generator.generateFullVault({
      includeTranslation: this.settings.showTranslation,
      translationId: this.settings.defaultTranslation,
    });
  },
});
```

### Graph View Result

After generation, the graph view shows:
- **Central hub:** Each surah with connected pages
- **Clusters:** Pages grouped by their parent surah(s)
- **Cross-links:** Pages spanning multiple surahs show connections

---

## Custom Reading Collections

Let users create personalized reading pages with specific verse ranges, like:
- **Moses story** from Surah Al-Kahf (18:60-82)
- **Ayatul Kursi** (2:255)
- **Last 10 Surahs** for memorization

### Collection Modal UI

```typescript
// src/modals/CreateCollectionModal.ts
import { App, Modal, Setting, Notice } from 'obsidian';
import type QuranPlugin from '../main';

interface VerseRange {
  surah: number;
  startVerse: number;
  endVerse: number;
  label?: string;
}

export class CreateCollectionModal extends Modal {
  plugin: QuranPlugin;
  collectionName = '';
  ranges: VerseRange[] = [];

  constructor(app: App, plugin: QuranPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('quran-collection-modal');

    contentEl.createEl('h2', { text: 'Create Custom Reading Collection' });

    // Collection name
    new Setting(contentEl)
      .setName('Collection Name')
      .addText(text => text
        .setPlaceholder('e.g., Moses Story')
        .onChange(value => this.collectionName = value)
      );

    // Verse ranges section
    const rangesContainer = contentEl.createDiv({ cls: 'ranges-container' });
    rangesContainer.createEl('h3', { text: 'Verse Ranges' });

    this.renderRanges(rangesContainer);

    // Add range button
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('+ Add Verse Range')
        .onClick(() => {
          this.ranges.push({ surah: 1, startVerse: 1, endVerse: 7 });
          this.renderRanges(rangesContainer);
        })
      );

    // Preset buttons
    contentEl.createEl('h4', { text: 'Quick Presets' });
    const presets = contentEl.createDiv({ cls: 'presets' });

    const presetData = [
      { name: 'Ayatul Kursi', ranges: [{ surah: 2, startVerse: 255, endVerse: 255 }] },
      { name: 'Moses Story (Al-Kahf)', ranges: [{ surah: 18, startVerse: 60, endVerse: 82, label: 'Moses & Khidr' }] },
      { name: 'Surah Yasin', ranges: [{ surah: 36, startVerse: 1, endVerse: 83 }] },
      { name: 'Last 10 Surahs', ranges: Array.from({ length: 10 }, (_, i) => ({ surah: 105 + i, startVerse: 1, endVerse: 999 })) },
      { name: 'Surah Al-Mulk', ranges: [{ surah: 67, startVerse: 1, endVerse: 30 }] },
      { name: 'Friday Recitation', ranges: [
        { surah: 18, startVerse: 1, endVerse: 10, label: 'First 10' },
        { surah: 18, startVerse: 101, endVerse: 110, label: 'Last 10' }
      ]},
    ];

    for (const preset of presetData) {
      const btn = presets.createEl('button', { text: preset.name, cls: 'preset-btn' });
      btn.addEventListener('click', () => {
        this.collectionName = preset.name;
        this.ranges = [...preset.ranges];
        this.renderRanges(rangesContainer);
      });
    }

    // Create button
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Create Collection')
        .setCta()
        .onClick(() => this.createCollection())
      );
  }

  private renderRanges(container: HTMLElement) {
    container.querySelectorAll('.range-item').forEach(el => el.remove());

    for (let i = 0; i < this.ranges.length; i++) {
      const range = this.ranges[i];
      const item = container.createDiv({ cls: 'range-item' });

      new Setting(item)
        .setName(`Range ${i + 1}`)
        .addText(text => text
          .setPlaceholder('Surah')
          .setValue(String(range.surah))
          .onChange(v => range.surah = Number(v))
        )
        .addText(text => text
          .setPlaceholder('Start')
          .setValue(String(range.startVerse))
          .onChange(v => range.startVerse = Number(v))
        )
        .addText(text => text
          .setPlaceholder('End')
          .setValue(String(range.endVerse))
          .onChange(v => range.endVerse = Number(v))
        )
        .addButton(btn => btn
          .setIcon('trash')
          .onClick(() => {
            this.ranges.splice(i, 1);
            this.renderRanges(container);
          })
        );
    }
  }

  private async createCollection() {
    if (!this.collectionName || this.ranges.length === 0) {
      new Notice('Please provide a name and at least one verse range');
      return;
    }

    const notice = new Notice('Creating collection...', 0);

    try {
      let content = `---
type: collection
name: "${this.collectionName}"
created: ${new Date().toISOString().split('T')[0]}
ranges: ${JSON.stringify(this.ranges)}
status: "not_started"
tags: [quran, collection, custom]
---

# ${this.collectionName}

`;

      // Fetch and add verses for each range
      for (const range of this.ranges) {
        const chapter = await this.plugin.client!.chapters.findById(String(range.surah));
        
        content += `\n## ${chapter.nameSimple} (${range.surah}:${range.startVerse}-${range.endVerse})\n`;
        content += `**Link:** [[${String(range.surah).padStart(3, '0')} - ${chapter.nameSimple}]]\n\n`;

        // Fetch verses in range
        const allVerses = await this.plugin.client!.verses.findByChapter(String(range.surah), {
          translations: [this.plugin.settings.defaultTranslation],
          perPage: 300,
        });

        const filteredVerses = allVerses.verses.filter(v => 
          v.verseNumber >= range.startVerse && 
          v.verseNumber <= (range.endVerse === 999 ? 999 : range.endVerse)
        );

        for (const verse of filteredVerses) {
          content += `### ${verse.verseKey}\n\n`;
          content += `> ${verse.textUthmani || ''}\n\n`;
          if (verse.translations?.[0]) {
            content += `${verse.translations[0].text}\n\n`;
          }
          content += `---\n\n`;
        }
      }

      content += `
## Progress

- [ ] Started
- [ ] Completed
- [ ] Memorized

## Notes

`;

      const fileName = `${this.collectionName.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
      const path = normalizePath(`Quran/Collections/${fileName}`);
      
      await this.plugin.app.vault.create(path, content);

      notice.hide();
      new Notice(`✅ Collection "${this.collectionName}" created!`);
      this.close();

      // Open the new file
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (file) {
        await this.plugin.app.workspace.getLeaf().openFile(file as any);
      }
    } catch (error) {
      notice.hide();
      new Notice(`❌ Error: ${error.message}`);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
```

### Adding Command for Custom Collections

```typescript
// Add to main.ts onload()
this.addCommand({
  id: 'create-custom-collection',
  name: 'Create Custom Reading Collection',
  callback: () => {
    new CreateCollectionModal(this.app, this).open();
  },
});
```

### Example: Moses Story Collection

Running the command with preset "Moses Story (Al-Kahf)" creates:

```markdown
---
type: collection
name: "Moses Story"
created: 2024-02-09
ranges: [{"surah":18,"startVerse":60,"endVerse":82,"label":"Moses & Khidr"}]
tags: [quran, collection, custom]
---

# Moses Story

## Al-Kahf (18:60-82)
**Link:** [[018 - Al-Kahf]]

### 18:60
> وَإِذْ قَالَ مُوسَىٰ لِفَتَىٰهُ لَا أَبْرَحُ حَتَّىٰ أَبْلُغَ مَجْمَعَ الْبَحْرَيْنِ...

And [mention] when Moses said to his servant, "I will not cease...

---

### 18:61
> فَلَمَّا بَلَغَا مَجْمَعَ بَيْنِهِمَا نَسِيَا حُوتَهُمَا...

But when they reached the junction between them, they forgot their fish...

...
```

---

## UI Components

### Plugin Styles (styles.css)

```css
/* Container */
.quran-reader, .quran-surah-list {
  padding: 20px;
}

.loading { text-align: center; padding: 40px; color: var(--text-muted); }
.error { color: var(--text-error); padding: 20px; text-align: center; }

/* Navigation */
.quran-nav {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--background-modifier-border);
  margin-bottom: 20px;
}

.nav-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.chapter-selector {
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--background-secondary);
}

/* Chapter Header */
.chapter-header {
  text-align: center;
  padding: 30px 0;
  border-bottom: 2px solid var(--background-modifier-border);
  margin-bottom: 30px;
}

.chapter-title { font-size: 2em; margin: 0 0 10px 0; }

.chapter-title-arabic {
  font-family: 'Scheherazade New', 'Amiri', serif;
  font-size: 2.5em;
  direction: rtl;
  color: var(--text-accent);
}

.bismillah {
  text-align: center;
  font-family: 'Scheherazade New', 'Amiri', serif;
  font-size: 2em;
  direction: rtl;
  padding: 30px 0;
  color: var(--text-accent);
}

/* Verses */
.verses-container { max-width: 800px; margin: 0 auto; }

.verse {
  padding: 20px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.verse:hover { background: var(--background-secondary); }

.verse-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 50%;
  font-size: 0.85em;
  font-weight: bold;
}

.verse-arabic {
  font-family: 'Scheherazade New', 'Amiri', serif;
  font-size: 1.8em;
  line-height: 2.2;
  direction: rtl;
  text-align: right;
  margin: 15px 0;
}

.verse-translation {
  color: var(--text-muted);
  line-height: 1.8;
  margin-top: 10px;
  padding-left: 44px;
}

/* Surah List */
.surah-list-header { text-align: center; margin-bottom: 30px; }
.surah-list { max-width: 600px; margin: 0 auto; }

.surah-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid var(--background-modifier-border);
  cursor: pointer;
}

.surah-item:hover { background: var(--background-secondary); }

.surah-number {
  width: 40px;
  height: 40px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 15px;
}

.surah-info { flex: 1; display: flex; flex-direction: column; }
.surah-name-transliterated { font-weight: 600; }
.surah-meta { font-size: 0.8em; color: var(--text-faint); }

.surah-name-arabic {
  font-family: 'Scheherazade New', 'Amiri', serif;
  font-size: 1.5em;
  direction: rtl;
  color: var(--text-accent);
}

/* Search */
.search-input {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--background-modifier-border);
  margin-bottom: 20px;
}

.search-result-item {
  padding: 15px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.result-key {
  font-weight: bold;
  color: var(--text-accent);
}
```

---

## Arabic Font Support

Add Google Fonts in your `onload()`:

```typescript
document.head.createEl('link', {
  attr: {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&display=swap',
  },
});
```

---

## Testing & Publishing

### Development

```bash
# Add to package.json scripts
"scripts": {
  "dev": "node esbuild.config.mjs",
  "build": "node esbuild.config.mjs production"
}

npm run dev
```

### Testing Checklist

- [ ] API credentials saved and client initializes
- [ ] Chapters list loads from SDK
- [ ] Verses display with Arabic and translations
- [ ] Navigation between chapters works
- [ ] Search returns results
- [ ] Dark/light mode compatible

### Publishing

1. Create GitHub repository
2. Build production: `npm run build`
3. Create release with `manifest.json`, `main.js`, `styles.css`
4. Submit PR to [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)

---

## Resources

- [@quranjs/api SDK Documentation](https://api-docs.quran.foundation/docs/sdk/javascript)
- [Chapters API](https://api-docs.quran.foundation/docs/sdk/javascript/chapters)
- [Verses API](https://api-docs.quran.foundation/docs/sdk/javascript/verses)
- [Resources API](https://api-docs.quran.foundation/docs/sdk/javascript/resources)
- [Search API](https://api-docs.quran.foundation/docs/sdk/javascript/search)
- [Obsidian Plugin Documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

> [!TIP]
> The SDK handles authentication, caching, and typing automatically. Focus on building great UI!
