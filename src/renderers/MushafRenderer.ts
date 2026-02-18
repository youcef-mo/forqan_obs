import type { Chapter, VerseWithWords, Word } from "../utils/quranApi";
import { getChapters, getVersesByPageWithWords } from "../utils/quranApi";

/** Session-level cache for chapter metadata. */
let chaptersCache: Chapter[] | null = null;

export function clearChaptersCache(): void {
	chaptersCache = null;
}

export async function getCachedChapters(language: string): Promise<Chapter[]> {
	if (!chaptersCache) {
		chaptersCache = await getChapters(language);
	}
	return chaptersCache;
}

/** Group all words across all verses by their line_number. */
export function groupWordsByLine(
	verses: VerseWithWords[],
): Map<number, Word[]> {
	const lineMap = new Map<number, Word[]>();
	for (const verse of verses) {
		for (const word of verse.words) {
			const existing = lineMap.get(word.line_number) ?? [];
			existing.push(word);
			lineMap.set(word.line_number, existing);
		}
	}
	return lineMap;
}

/**
 * For each verse where verse_number === 1, record which line its first word
 * falls on.  This tells us exactly where to insert a surah header.
 */
export function buildSurahStartLines(
	verses: VerseWithWords[],
): Map<number, number> {
	const map = new Map<number, number>();
	for (const verse of verses) {
		if (verse.verse_number === 1 && verse.words.length > 0) {
			const firstWord = verse.words[0]!;
			map.set(firstWord.line_number, verse.chapter_id);
		}
	}
	return map;
}

/** Resolve a Map<chapterId, Chapter> for the given IDs using the cache. */
export async function getChaptersForIds(
	chapterIds: number[],
	language: string,
): Promise<Map<number, Chapter>> {
	const all = await getCachedChapters(language);
	const map = new Map<number, Chapter>();
	for (const ch of all) {
		if (chapterIds.includes(ch.id)) {
			map.set(ch.id, ch);
		}
	}
	return map;
}

/**
 * Render a full Mushaf page into the given container element.
 * This is the shared rendering core used by both the sidebar MushafView
 * and the embedded code block processor.
 */
export function renderMushafPage(
	container: HTMLElement,
	page: number,
	lineMap: Map<number, Word[]>,
	chapters: Map<number, Chapter>,
	surahStartLines: Map<number, number>,
): void {
	container.empty();

	const pageEl = container.createEl("div", { cls: "mushaf-page" });
	const lineNumbers = [...lineMap.keys()].sort((a, b) => a - b);

	for (const lineNum of lineNumbers) {
		const words = lineMap.get(lineNum)!;

		// If a surah starts on this line, render header + bismillah
		const startChapterId = surahStartLines.get(lineNum);
		if (startChapterId !== undefined) {
			const chapter = chapters.get(startChapterId);
			if (chapter) {
				const headerEl = pageEl.createEl("div", {
					cls: "mushaf-surah-header",
				});
				headerEl.createEl("span", {
					text: chapter.name_arabic,
					cls: "mushaf-surah-name",
				});

				if (startChapterId !== 9 && startChapterId !== 1) {
					pageEl.createEl("div", {
						text: "\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650",
						cls: "mushaf-bismillah",
					});
				}
			}
		}

		// Render line
		const lineEl = pageEl.createEl("div", { cls: "mushaf-line" });
		for (const word of words) {
			const wordEl = lineEl.createEl("span", {
				cls: `mushaf-word mushaf-word-${word.char_type_name}`,
			});
			wordEl.textContent = word.text_uthmani;
		}
	}

	// Page footer
	const footer = pageEl.createEl("div", { cls: "mushaf-page-footer" });
	const chapterNames = [...chapters.values()]
		.map((c) => c.name_simple)
		.join(" \u00B7 ");
	footer.createEl("span", {
		text: chapterNames,
		cls: "mushaf-footer-surahs",
	});
	footer.createEl("span", {
		text: String(page),
		cls: "mushaf-footer-page",
	});
}

/**
 * Convenience: fetch data for a page and render it into a container.
 * Returns the chapter IDs found on the page.
 */
export async function fetchAndRenderPage(
	container: HTMLElement,
	page: number,
	language: string,
): Promise<void> {
	container.empty();
	container.createEl("div", { text: "Loading...", cls: "quran-loading" });

	try {
		const verses = await getVersesByPageWithWords(page);
		const lineMap = groupWordsByLine(verses);
		const chapterIds = [...new Set(verses.map((v) => v.chapter_id))];
		const chapters = await getChaptersForIds(chapterIds, language);
		const surahStartLines = buildSurahStartLines(verses);

		renderMushafPage(container, page, lineMap, chapters, surahStartLines);
	} catch (e) {
		container.empty();
		const msg = e instanceof Error ? e.message : String(e);
		container.createEl("div", {
			text: `Error: ${msg}`,
			cls: "quran-error",
		});
	}
}
