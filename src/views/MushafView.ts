import { ItemView, WorkspaceLeaf } from "obsidian";
import type QuranPlugin from "../main";
import { fetchAndRenderPage } from "../renderers/MushafRenderer";

export const VIEW_TYPE_MUSHAF = "quran-mushaf-view";

export class MushafView extends ItemView {
	plugin: QuranPlugin;
	currentPage = 1;

	constructor(leaf: WorkspaceLeaf, plugin: QuranPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MUSHAF;
	}

	getDisplayText(): string {
		return `Mushaf - Page ${this.currentPage}`;
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("mushaf-view");

		this.renderControls(container);
		container.createEl("div", { cls: "mushaf-page-wrapper" });

		await this.loadPage(this.currentPage);
	}

	private renderControls(container: HTMLElement): void {
		const controls = container.createEl("div", { cls: "mushaf-controls" });

		const prevBtn = controls.createEl("button", {
			text: "\u2192",
			cls: "mushaf-nav-btn",
		});
		prevBtn.addEventListener("click", () => {
			void this.navigatePage(1);
		});

		const pageInfo = controls.createEl("div", { cls: "mushaf-page-info" });

		const pageInput = pageInfo.createEl("input", {
			type: "number",
			cls: "mushaf-page-input",
			value: String(this.currentPage),
		});
		pageInput.min = "1";
		pageInput.max = "604";
		pageInput.addEventListener("change", () => {
			const page = Number(pageInput.value);
			if (page >= 1 && page <= 604) {
				void this.loadPage(page);
			}
		});
		pageInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				const page = Number(pageInput.value);
				if (page >= 1 && page <= 604) {
					void this.loadPage(page);
				}
			}
		});

		pageInfo.createEl("span", {
			text: "/ 604",
			cls: "mushaf-page-total",
		});

		const nextBtn = controls.createEl("button", {
			text: "\u2190",
			cls: "mushaf-nav-btn",
		});
		nextBtn.addEventListener("click", () => {
			void this.navigatePage(-1);
		});
	}

	private async navigatePage(delta: number): Promise<void> {
		const next = this.currentPage + delta;
		if (next >= 1 && next <= 604) {
			await this.loadPage(next);
		}
	}

	async loadPage(page: number): Promise<void> {
		const wrapper = this.containerEl.querySelector<HTMLElement>(
			".mushaf-page-wrapper",
		);
		if (!wrapper) return;

		this.currentPage = page;

		const input =
			this.containerEl.querySelector<HTMLInputElement>(
				".mushaf-page-input",
			);
		if (input) input.value = String(page);

		await fetchAndRenderPage(wrapper, page, this.plugin.settings.language);

		const leaf = this.leaf as { updateHeader?: () => void };
		leaf.updateHeader?.();
	}

	onClose(): Promise<void> {
		return Promise.resolve();
	}
}
