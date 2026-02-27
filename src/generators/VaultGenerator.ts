import { Notice, normalizePath } from "obsidian";
import type QuranPlugin from "../main";
import type { Chapter, Juz, Verse } from "../utils/quranApi";
import { getChapters, getJuzs, getVersesByPage } from "../utils/quranApi";
import { padNumber, sleep, stripHtml } from "../utils/helpers";

export interface VaultGeneratorOptions {
	includeTranslation: boolean;
	translationId: number;
	includeMushaf?: boolean;
	defaultViewMode?: "verse" | "mushaf";
}

export class VaultGenerator {
	private plugin: QuranPlugin;
	private baseFolder = "Quran";

	constructor(plugin: QuranPlugin) {
		this.plugin = plugin;
	}

	async generateFullVault(options: VaultGeneratorOptions): Promise<void> {
		const notice = new Notice("Generating Quran ault...", 0);

		try {
			await this.createFolders();

			notice.setMessage("Generating surah notes...");
			await this.generateSurahNotes();

			notice.setMessage(
				"Generating page notes (this may take a few minutes)...",
			);
			await this.generatePageNotes(options);

			notice.setMessage("Generating index...");
			await this.generateIndex();

			notice.hide();
			new Notice("Quran vault generated successfully!");
		} catch (e) {
			notice.hide();
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Vault generation failed: ${msg}`);
		}
	}

	private async createFolders(): Promise<void> {
		const folders = ["Surahs", "Pages", "Juz", "Collections"];
		for (const folder of folders) {
			const path = normalizePath(`${this.baseFolder}/${folder}`);
			if (!this.plugin.app.vault.getAbstractFileByPath(path)) {
				await this.plugin.app.vault.createFolder(path);
			}
		}
	}

	private async generateSurahNotes(): Promise<void> {
		const chapters = await getChapters(this.plugin.settings.language);

		for (const chapter of chapters) {
			const fileName = `${padNumber(chapter.id, 3)} - ${chapter.name_simple}.md`;
			const path = normalizePath(`${this.baseFolder}/Surahs/${fileName}`);

			if (this.plugin.app.vault.getAbstractFileByPath(path)) continue;

			const content = this.buildSurahContent(chapter);
			await this.plugin.app.vault.create(path, content);
		}
	}

	private buildSurahContent(chapter: Chapter): string {
		const pageLinks = chapter.pages
			.map((p) => `- [[Page ${padNumber(p, 3)}]]`)
			.join("\n");

		return `---
surah: ${chapter.id}
name_arabic: "${chapter.name_arabic}"
name_english: "${chapter.name_simple}"
verses_count: ${chapter.verses_count}
revelation_place: "${chapter.revelation_place}"
pages: [${chapter.pages.join(", ")}]
status: "not_started"
tags: [quran, surah, ${chapter.revelation_place}]
---

# ${chapter.name_simple}

## ${chapter.name_arabic}

| Property | Value |
|----------|-------|
| **English** | ${chapter.name_simple} |
| **Verses** | ${chapter.verses_count} |
| **Revelation** | ${chapter.revelation_place} |
| **Pages** | ${chapter.pages[0]} - ${chapter.pages[chapter.pages.length - 1]} |

## Pages in this Surah

${pageLinks}

## Reading Progress

- [ ] Started reading
- [ ] Completed reading
- [ ] Memorized

## Notes

`;
	}

	private async generatePageNotes(
		options: VaultGeneratorOptions,
	): Promise<void> {
		const allChapters = await getChapters(this.plugin.settings.language);
		const chapterMap = new Map<number, Chapter>();
		for (const ch of allChapters) {
			chapterMap.set(ch.id, ch);
		}

		const juzs = await getJuzs();
		const juzPageMap = this.buildJuzPageMap(juzs);

		for (let page = 1; page <= 604; page++) {
			const fileName = `Page ${padNumber(page, 3)}.md`;
			const path = normalizePath(`${this.baseFolder}/Pages/${fileName}`);

			if (this.plugin.app.vault.getAbstractFileByPath(path)) continue;

			const verses = await getVersesByPage(page, {
				translations: options.includeTranslation
					? [options.translationId]
					: undefined,
				perPage: 50,
			});

			const chapterIds = [
				...new Set(
					verses.map((v) => v.chapter_id).filter((id) => id > 0),
				),
			];
			const chapters = chapterIds
				.map((id) => chapterMap.get(id))
				.filter((c): c is Chapter => c != null);

			const juzNumber = juzPageMap.get(page) ?? Math.ceil(page / 20);

			const content = this.buildPageContent(
				page,
				verses,
				chapters,
				juzNumber,
				options,
			);
			await this.plugin.app.vault.create(path, content);

			// Rate-limit: pause every 10 pages
			if (page % 10 === 0) {
				new Notice(`Generated ${page}/604 pages...`);
				await sleep(100);
			}
		}
	}

	private buildJuzPageMap(juzs: Juz[]): Map<number, number> {
		const pageToJuz = new Map<number, number>();
		for (let page = 1; page <= 604; page++) {
			for (const juz of juzs) {
				const approxStartPage =
					Math.round(((juz.juz_number - 1) / 30) * 604) + 1;
				const approxEndPage = Math.round((juz.juz_number / 30) * 604);
				if (page >= approxStartPage && page <= approxEndPage) {
					pageToJuz.set(page, juz.juz_number);
					break;
				}
			}
		}
		return pageToJuz;
	}

	private buildPageContent(
		page: number,
		verses: Verse[],
		chapters: Chapter[],
		juzNumber: number,
		options: VaultGeneratorOptions,
	): string {
		const surahLinks = chapters
			.map(
				(c) =>
					`[[${padNumber(c.id, 3)} - ${c.name_simple}|${c.name_simple}]]`,
			)
			.join(", ");

		const firstVerse = verses[0]?.verse_key ?? "";
		const lastVerse = verses[verses.length - 1]?.verse_key ?? "";

		let versesContent = "";
		for (const verse of verses) {
			const translationText =
				options.includeTranslation && verse.translations?.[0]
					? stripHtml(verse.translations[0].text)
					: "";

			versesContent += `### ${verse.verse_key}

> ${verse.text_uthmani ?? ""}

${translationText}

---

`;
		}

		const includeMushaf = options.includeMushaf ?? false;
		const defaultMode = options.defaultViewMode ?? "verse";

		// Build the view toggle + mushaf embed blocks
		const viewToggleBlock = includeMushaf
			? `\`\`\`quran-view-toggle
${defaultMode}
\`\`\`

\`\`\`quran-mushaf
\`\`\`

`
			: "";

		return `---
page: ${page}
juz: ${juzNumber}
surahs: [${chapters.map((c) => c.id).join(", ")}]
first_verse: "${firstVerse}"
last_verse: "${lastVerse}"
status: "not_read"
memorized: false
tags: [quran, page, juz-${juzNumber}]
---

# Page ${page}

**Surahs:** ${surahLinks}
**Juz:** [[Juz ${padNumber(juzNumber, 2)}]]
**Verses:** ${firstVerse} \u2192 ${lastVerse}

---

${viewToggleBlock}${versesContent}
## Status

- [ ] Read
- [ ] Memorized
- [ ] Reviewed
`;
	}

	private async generateIndex(): Promise<void> {
		const path = normalizePath(`${this.baseFolder}/_Index.md`);
		if (this.plugin.app.vault.getAbstractFileByPath(path)) return;

		const content = `---
tags: [quran, index]
---

# Quran Index

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

		await this.plugin.app.vault.create(path, content);
	}
}
