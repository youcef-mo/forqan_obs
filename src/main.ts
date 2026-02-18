import { MarkdownPostProcessorContext, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	QuranPluginSettings,
	QuranSettingsTab,
} from "./settings";
import {
	QuranReaderView,
	VIEW_TYPE_QURAN_READER,
} from "./views/QuranReaderView";
import { SurahListView, VIEW_TYPE_SURAH_LIST } from "./views/SurahListView";
import { SearchView, VIEW_TYPE_SEARCH } from "./views/SearchView";
import { MushafView, VIEW_TYPE_MUSHAF } from "./views/MushafView";
import { VaultGenerator } from "./generators/VaultGenerator";
import { CreateCollectionModal } from "./modals/CreateCollectionModal";
import { fetchAndRenderPage } from "./renderers/MushafRenderer";

export default class QuranPlugin extends Plugin {
	settings: QuranPluginSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_QURAN_READER,
			(leaf) => new QuranReaderView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_SURAH_LIST,
			(leaf) => new SurahListView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_SEARCH,
			(leaf) => new SearchView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_MUSHAF,
			(leaf) => new MushafView(leaf, this),
		);

		// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Quran" is a proper noun
		this.addRibbonIcon("book-open", "Open Quran reader", () => {
			void this.activateView(VIEW_TYPE_MUSHAF);
		});

		this.addCommand({
			id: "open-quran-reader",
			name: "Open reader",
			callback: () => {
				void this.activateView(VIEW_TYPE_QURAN_READER);
			},
		});

		this.addCommand({
			id: "open-surah-list",
			name: "Open surah list",
			callback: () => {
				void this.activateView(VIEW_TYPE_SURAH_LIST);
			},
		});

		this.addCommand({
			id: "open-mushaf",
			name: "Open mushaf",
			callback: () => {
				void this.activateView(VIEW_TYPE_MUSHAF);
			},
		});

		this.addCommand({
			id: "open-quran-search",
			name: "Search",
			callback: () => {
				void this.activateView(VIEW_TYPE_SEARCH);
			},
		});

		this.addCommand({
			id: "generate-quran-vault",
			name: "Generate vault (604 pages + 114 surahs)",
			callback: async () => {
				const generator = new VaultGenerator(this);
				await generator.generateFullVault({
					includeTranslation: this.settings.showTranslation,
					translationId: this.settings.defaultTranslation,
					includeMushaf: this.settings.includeMushafInGeneration,
					defaultViewMode: this.settings.defaultNoteViewMode,
				});
			},
		});

		this.addCommand({
			id: "create-custom-collection",
			name: "Create custom reading collection",
			callback: () => {
				new CreateCollectionModal(this.app, this).open();
			},
		});

		this.addSettingTab(new QuranSettingsTab(this.app, this));

		this.registerMushafCodeBlockProcessor();
		this.registerViewToggleProcessor();
		this.registerAutoMushafPostProcessor();
	}

	/**
	 * ````quran-mushaf` code block processor.
	 *
	 * Accepts an optional `page` parameter (one per line).
	 * If omitted, the page number is read from frontmatter.
	 *
	 * Examples:
	 *   ```quran-mushaf
	 *   page: 3
	 *   ```
	 *
	 *   ```quran-mushaf
	 *   ```          ← auto-detects page from frontmatter
	 */
	private registerMushafCodeBlockProcessor(): void {
		this.registerMarkdownCodeBlockProcessor(
			"quran-mushaf",
			(
				source: string,
				el: HTMLElement,
				ctx: MarkdownPostProcessorContext,
			) => {
				const wrapper = el.createEl("div", {
					cls: "mushaf-embed-wrapper",
				});

				let page = this.parsePage(source);

				if (!page) {
					const frontmatter = this.app.metadataCache.getCache(
						ctx.sourcePath,
					)?.frontmatter;
					if (frontmatter?.["page"]) {
						page = Number(frontmatter["page"]);
					}
				}

				if (!page || page < 1 || page > 604) {
					wrapper.createEl("div", {
						text: "Invalid or missing page number. Use page: 1\u2013604 or add page to frontmatter.",
						cls: "quran-error",
					});
					return;
				}

				void fetchAndRenderPage(wrapper, page, this.settings.language);
			},
		);
	}

	/**
	 * ````quran-view-toggle` code block processor.
	 *
	 * Renders two buttons that toggle visibility between
	 * `.quran-verse-section` and `.mushaf-embed-wrapper` siblings
	 * within the same note preview container.
	 */
	private registerViewToggleProcessor(): void {
		this.registerMarkdownCodeBlockProcessor(
			"quran-view-toggle",
			(source: string, el: HTMLElement) => {
				const bar = el.createEl("div", { cls: "quran-view-toggle" });

				const verseBtn = bar.createEl("button", {
					text: "Verse view",
					cls: "quran-toggle-btn",
				});
				const mushafBtn = bar.createEl("button", {
					text: "Mushaf view",
					cls: "quran-toggle-btn",
				});

				const defaultMode =
					source.trim() || this.settings.defaultNoteViewMode;

				const setMode = (mode: string) => {
					const preview = el.closest(".markdown-preview-view");
					if (!(preview instanceof HTMLElement)) return;

					const isMushaf = mode === "mushaf";
					preview.classList.toggle("quran-show-mushaf", isMushaf);
					preview.classList.toggle("quran-show-verse", !isMushaf);

					verseBtn.classList.toggle("is-active", !isMushaf);
					mushafBtn.classList.toggle("is-active", isMushaf);
				};

				verseBtn.addEventListener("click", () => setMode("verse"));
				mushafBtn.addEventListener("click", () => setMode("mushaf"));

				// Apply default mode
				// Delay slightly so sibling elements are in the DOM
				setTimeout(() => setMode(defaultMode), 0);
			},
		);
	}

	/**
	 * Auto-inject post-processor for Quran notes.
	 *
	 * Supports two frontmatter shapes:
	 *   - `page: N`           — single-page notes (Quran/Pages)
	 *   - `pages: [N, M, …]`  — multi-page notes  (Collections)
	 *
	 * Injects a toggle bar + Mushaf embed(s) into the rendered preview.
	 * No code blocks required in the markdown — works on existing notes.
	 */
	private registerAutoMushafPostProcessor(): void {
		this.registerMarkdownPostProcessor((el, ctx) => {
			const frontmatter = this.app.metadataCache.getCache(
				ctx.sourcePath,
			)?.frontmatter;
			if (!frontmatter) return;

			const pages = this.extractPages(frontmatter);
			if (pages.length === 0) return;

			// Tag verse content for CSS toggle
			for (const node of Array.from(
				el.querySelectorAll("h3, h2, blockquote, hr, p"),
			)) {
				if (node.closest(".mushaf-auto-inject")) continue;
				node.classList.add("quran-verse-section");
			}

			// Only inject toggle + mushaf once per preview container.
			// Check the DOM directly so page switches work correctly —
			// Obsidian removes old children when navigating between notes.
			const preview = el.closest(".markdown-preview-view");
			if (!preview || preview.querySelector(".mushaf-auto-inject"))
				return;

			// Create auto-inject container at the top of the element
			const container = el.createEl("div", {
				cls: "mushaf-auto-inject",
			});

			// Toggle bar
			const bar = container.createEl("div", {
				cls: "quran-view-toggle",
			});
			const verseBtn = bar.createEl("button", {
				text: "Verse view",
				cls: "quran-toggle-btn",
			});
			const mushafBtn = bar.createEl("button", {
				text: "Mushaf view",
				cls: "quran-toggle-btn",
			});

			const setMode = (mode: string) => {
				if (!(preview instanceof HTMLElement)) return;

				const isMushaf = mode === "mushaf";
				preview.classList.toggle("quran-show-mushaf", isMushaf);
				preview.classList.toggle("quran-show-verse", !isMushaf);
				verseBtn.classList.toggle("is-active", !isMushaf);
				mushafBtn.classList.toggle("is-active", isMushaf);
			};

			verseBtn.addEventListener("click", () => setMode("verse"));
			mushafBtn.addEventListener("click", () => setMode("mushaf"));

			// Mushaf embed(s) — one per page
			for (const page of pages) {
				const wrapper = container.createEl("div", {
					cls: "mushaf-embed-wrapper",
				});
				void fetchAndRenderPage(wrapper, page, this.settings.language);
			}

			// Move inject container to be the first child
			el.prepend(container);

			// Apply default mode
			setTimeout(() => setMode(this.settings.defaultNoteViewMode), 0);
		});
	}

	/**
	 * Extract valid page numbers from frontmatter.
	 * Handles both `page: 5` and `pages: [1, 2, 3]`.
	 */
	private extractPages(frontmatter: Record<string, unknown>): number[] {
		const isValidPage = (n: number) =>
			Number.isInteger(n) && n >= 1 && n <= 604;

		// Single page
		const single = Number(frontmatter["page"] ?? 0);
		if (isValidPage(single)) return [single];

		// Multiple pages (collections)
		const multi = frontmatter["pages"];
		if (Array.isArray(multi)) {
			return multi.map((v) => Number(v)).filter((n) => isValidPage(n));
		}

		return [];
	}

	private parsePage(source: string): number | null {
		for (const line of source.split("\n")) {
			const match = line.match(/^\s*page\s*:\s*(\d+)\s*$/i);
			if (match?.[1]) return Number(match[1]);
		}
		return null;
	}

	async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(viewType)[0];

		if (!leaf) {
			const newLeaf = workspace.getRightLeaf(false);
			if (!newLeaf) return;
			leaf = newLeaf;
			await leaf.setViewState({ type: viewType, active: true });
		}

		await workspace.revealLeaf(leaf);
	}

	async openChapter(chapterId: number): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_QURAN_READER)[0];

		if (!leaf) {
			const newLeaf = workspace.getRightLeaf(false);
			if (!newLeaf) return;
			leaf = newLeaf;
			await leaf.setViewState({
				type: VIEW_TYPE_QURAN_READER,
				active: true,
			});
		}

		await workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (view instanceof QuranReaderView) {
			await view.loadChapter(chapterId);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<QuranPluginSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
