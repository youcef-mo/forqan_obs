import { ItemView, WorkspaceLeaf } from "obsidian";
import type QuranPlugin from "../main";
import { search } from "../utils/quranApi";
import { stripHtml } from "../utils/helpers";

export const VIEW_TYPE_SEARCH = "quran-search-view";

export class SearchView extends ItemView {
	plugin: QuranPlugin;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: QuranPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_SEARCH;
	}

	getDisplayText(): string {
		return "Search Quran";
	}

	getIcon(): string {
		return "search";
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("quran-search");

		const searchInput = container.createEl("input", {
			type: "text",
			placeholder: "Search verses...",
			cls: "search-input",
		});

		const results = container.createEl("div", { cls: "search-results" });

		searchInput.addEventListener("input", (e) => {
			const query = (e.target as HTMLInputElement).value;
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
			this.debounceTimer = setTimeout(() => {
				void this.performSearch(query, results);
			}, 400);
		});
		return Promise.resolve();
	}

	private async performSearch(
		query: string,
		results: HTMLElement,
	): Promise<void> {
		if (query.length < 3) {
			results.empty();
			return;
		}

		results.empty();
		results.createEl("div", { text: "Searching...", cls: "quran-loading" });

		try {
			const response = await search(query, {
				size: 20,
				language: this.plugin.settings.language,
			});

			results.empty();

			const verses = response.search.results;
			if (!verses.length) {
				results.createEl("div", {
					text: "No results found",
					cls: "quran-no-results",
				});
				return;
			}

			for (const result of verses) {
				const item = results.createEl("div", {
					cls: "search-result-item",
				});
				item.createEl("span", {
					text: result.verse_key,
					cls: "result-key",
				});

				const translationText = result.translations?.[0]?.text;
				if (translationText) {
					const textEl = item.createEl("div", {
						cls: "result-text",
					});
					textEl.textContent = stripHtml(translationText);
				}

				item.addEventListener("click", () => {
					const chapterId = Number(result.verse_key.split(":")[0]);
					if (chapterId >= 1 && chapterId <= 114) {
						void this.plugin.openChapter(chapterId);
					}
				});
			}
		} catch (e) {
			results.empty();
			const msg = e instanceof Error ? e.message : String(e);
			results.createEl("div", {
				text: `Search error: ${msg}`,
				cls: "quran-error",
			});
		}
	}

	onClose(): Promise<void> {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		return Promise.resolve();
	}
}
