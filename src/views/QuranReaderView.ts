import { ItemView, WorkspaceLeaf, Menu, Notice } from "obsidian";
import type QuranPlugin from "../main";
import type { Chapter, Verse } from "../utils/quranApi";
import { getChapter, getVersesByChapter } from "../utils/quranApi";
import { stripHtml } from "../utils/helpers";

export const VIEW_TYPE_QURAN_READER = "quran-reader-view";

export class QuranReaderView extends ItemView {
	plugin: QuranPlugin;
	currentChapter = 1;
	verses: Verse[] = [];
	chapterInfo: Chapter | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: QuranPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_QURAN_READER;
	}

	getDisplayText(): string {
		return this.chapterInfo?.name_simple ?? "Quran reader";
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("quran-reader");

		this.renderNavigation(container);
		container.createEl("div", { cls: "quran-content" });

		await this.loadChapter(this.currentChapter);
	}

	private renderNavigation(container: HTMLElement): void {
		const nav = container.createEl("div", { cls: "quran-nav" });

		const prevBtn = nav.createEl("button", {
			text: "\u2190 previous",
			cls: "nav-btn",
		});
		prevBtn.addEventListener("click", () => {
			void this.navigateChapter(-1);
		});

		const selector = nav.createEl("select", { cls: "chapter-selector" });
		for (let i = 1; i <= 114; i++) {
			const option = selector.createEl("option", {
				text: `Surah ${i}`,
				value: String(i),
			});
			if (i === this.currentChapter) option.selected = true;
		}
		selector.addEventListener("change", (e) => {
			void this.loadChapter(
				Number((e.target as HTMLSelectElement).value),
			);
		});

		const nextBtn = nav.createEl("button", {
			text: "Next \u2192",
			cls: "nav-btn",
		});
		nextBtn.addEventListener("click", () => {
			void this.navigateChapter(1);
		});
	}

	private async navigateChapter(delta: number): Promise<void> {
		const next = this.currentChapter + delta;
		if (next >= 1 && next <= 114) {
			await this.loadChapter(next);
		}
	}

	async loadChapter(chapterId: number): Promise<void> {
		const content =
			this.containerEl.querySelector<HTMLElement>(".quran-content");
		if (!content) return;

		content.empty();
		content.createEl("div", { text: "Loading...", cls: "quran-loading" });

		try {
			this.currentChapter = chapterId;

			const [chapter, verses] = await Promise.all([
				getChapter(chapterId, this.plugin.settings.language),
				getVersesByChapter(chapterId, {
					translations: [this.plugin.settings.defaultTranslation],
					perPage: 300,
				}),
			]);

			this.chapterInfo = chapter;
			this.verses = verses;

			this.renderChapter(content);

			const selector =
				this.containerEl.querySelector<HTMLSelectElement>(
					".chapter-selector",
				);
			if (selector) selector.value = String(chapterId);
		} catch (e) {
			content.empty();
			const msg = e instanceof Error ? e.message : String(e);
			content.createEl("div", {
				text: `Error: ${msg}`,
				cls: "quran-error",
			});
		}
	}

	private renderChapter(container: HTMLElement): void {
		container.empty();
		if (!this.chapterInfo) return;

		const header = container.createEl("div", { cls: "chapter-header" });
		header.createEl("h1", {
			text: this.chapterInfo.name_simple,
			cls: "chapter-title",
		});
		header.createEl("h2", {
			text: this.chapterInfo.name_arabic,
			cls: "chapter-title-arabic",
		});
		header.createEl("p", {
			text: `${this.chapterInfo.verses_count} verses \u00B7 ${this.chapterInfo.revelation_place}`,
			cls: "chapter-subtitle",
		});

		// Bismillah (except Surah 9 At-Tawbah and Surah 1 Al-Fatihah which has it as verse 1)
		if (this.currentChapter !== 9 && this.currentChapter !== 1) {
			container.createEl("div", {
				text: "\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650",
				cls: "bismillah",
			});
		}

		const versesContainer = container.createEl("div", {
			cls: "verses-container",
		});
		for (const verse of this.verses) {
			this.renderVerse(versesContainer, verse);
		}
	}

	private renderVerse(container: HTMLElement, verse: Verse): void {
		const verseEl = container.createEl("div", { cls: "verse" });
		verseEl.dataset.verseKey = verse.verse_key;

		verseEl.createEl("span", {
			text: String(verse.verse_number),
			cls: "verse-number",
		});

		if (this.plugin.settings.showArabic && verse.text_uthmani) {
			const arabicEl = verseEl.createEl("div", {
				text: verse.text_uthmani,
				cls: "verse-arabic",
			});
			arabicEl.style.fontSize = `${this.plugin.settings.fontSize}px`;
		}

		if (
			this.plugin.settings.showTranslation &&
			verse.translations?.length
		) {
			const translation = verse.translations[0];
			if (translation) {
				const transEl = verseEl.createEl("div", {
					cls: "verse-translation",
				});
				transEl.textContent = stripHtml(translation.text);
			}
		}

		verseEl.addEventListener("contextmenu", (e) =>
			this.showVerseMenu(e, verse),
		);
	}

	private showVerseMenu(event: MouseEvent, verse: Verse): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle("Copy Arabic")
				.setIcon("copy")
				.onClick(() => {
					void navigator.clipboard.writeText(
						verse.text_uthmani ?? "",
					);
					new Notice("Arabic text copied");
				}),
		);

		menu.addItem((item) =>
			item
				.setTitle("Copy reference")
				.setIcon("link")
				.onClick(() => {
					void navigator.clipboard.writeText(verse.verse_key);
					new Notice("Reference copied");
				}),
		);

		menu.addItem((item) =>
			item
				.setTitle("Insert as quote")
				.setIcon("edit")
				.onClick(() => {
					this.insertVerseAsNote(verse);
				}),
		);

		menu.showAtMouseEvent(event);
	}

	private insertVerseAsNote(verse: Verse): void {
		const arabicLine = verse.text_uthmani ?? "";
		const translationLine = verse.translations?.[0]
			? stripHtml(verse.translations[0].text)
			: "";

		const content = [
			`> [!quote] Quran ${verse.verse_key}`,
			`> ${arabicLine}`,
			`>`,
			`> ${translationLine}`,
			"",
		].join("\n");

		const editor = this.app.workspace.activeEditor?.editor;
		if (editor) {
			editor.replaceSelection(content);
			new Notice("Verse inserted");
		}
	}

	onClose(): Promise<void> {
		return Promise.resolve();
	}
}
