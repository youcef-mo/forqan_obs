import { ItemView, WorkspaceLeaf } from "obsidian";
import type QuranPlugin from "../main";
import type { Chapter } from "../utils/quranApi";
import { getChapters } from "../utils/quranApi";

export const VIEW_TYPE_SURAH_LIST = "quran-surah-list-view";

export class SurahListView extends ItemView {
	plugin: QuranPlugin;
	chapters: Chapter[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: QuranPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_SURAH_LIST;
	}

	getDisplayText(): string {
		return "Surah list";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("quran-surah-list");

		container.createEl("div", {
			text: "Loading surahs...",
			cls: "quran-loading",
		});

		try {
			this.chapters = await getChapters(this.plugin.settings.language);
			this.renderChapterList(container);
		} catch (e) {
			container.empty();
			const msg = e instanceof Error ? e.message : String(e);
			container.createEl("div", {
				text: `Error loading surahs: ${msg}`,
				cls: "quran-error",
			});
		}
	}

	private renderChapterList(container: HTMLElement): void {
		container.empty();

		container.createEl("h2", {
			text: "Surahs of the Quran",
			cls: "surah-list-header",
		});

		const list = container.createEl("div", { cls: "surah-list" });

		for (const chapter of this.chapters) {
			const item = list.createEl("div", { cls: "surah-item" });

			item.createEl("span", {
				text: String(chapter.id),
				cls: "surah-number",
			});

			const info = item.createEl("div", { cls: "surah-info" });
			info.createEl("span", {
				text: chapter.name_simple,
				cls: "surah-name-transliterated",
			});
			info.createEl("span", {
				text: `${chapter.verses_count} verses \u00B7 ${chapter.revelation_place}`,
				cls: "surah-meta",
			});

			item.createEl("span", {
				text: chapter.name_arabic,
				cls: "surah-name-arabic",
			});

			item.addEventListener("click", () => {
				void this.plugin.openChapter(chapter.id);
			});
		}
	}

	onClose(): Promise<void> {
		return Promise.resolve();
	}
}
