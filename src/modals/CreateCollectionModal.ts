import { App, Modal, Setting, Notice, normalizePath, TFile } from "obsidian";
import type QuranPlugin from "../main";
import type { Verse } from "../utils/quranApi";
import { getChapter, getVersesByChapter } from "../utils/quranApi";
import { padNumber, stripHtml } from "../utils/helpers";

interface VerseRange {
	surah: number;
	startVerse: number;
	endVerse: number;
	label?: string;
}

const PRESETS: Array<{ name: string; ranges: VerseRange[] }> = [
	{
		name: "Ayatul Kursi",
		ranges: [{ surah: 2, startVerse: 255, endVerse: 255 }],
	},
	{
		name: "Moses Story (Al-Kahf)",
		ranges: [
			{ surah: 18, startVerse: 60, endVerse: 82, label: "Moses & Khidr" },
		],
	},
	{
		name: "Surah Yasin",
		ranges: [{ surah: 36, startVerse: 1, endVerse: 83 }],
	},
	{
		name: "Surah Al-Mulk",
		ranges: [{ surah: 67, startVerse: 1, endVerse: 30 }],
	},
	{
		name: "Last 10 Surahs",
		ranges: Array.from({ length: 10 }, (_, i) => ({
			surah: 105 + i,
			startVerse: 1,
			endVerse: 999,
		})),
	},
	{
		name: "Friday Recitation",
		ranges: [
			{ surah: 18, startVerse: 1, endVerse: 10, label: "First 10" },
			{ surah: 18, startVerse: 101, endVerse: 110, label: "Last 10" },
		],
	},
];

export class CreateCollectionModal extends Modal {
	private plugin: QuranPlugin;
	private collectionName = "";
	private ranges: VerseRange[] = [];

	constructor(app: App, plugin: QuranPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("quran-collection-modal");

		contentEl.createEl("h2", { text: "Create custom reading collection" });

		/* eslint-disable obsidianmd/ui/sentence-case -- example with proper nouns */
		new Setting(contentEl).setName("Collection name").addText((text) =>
			text.setPlaceholder("e.g., Moses story").onChange((value) => {
				this.collectionName = value;
			}),
		);
		/* eslint-enable obsidianmd/ui/sentence-case */

		const rangesContainer = contentEl.createDiv({
			cls: "ranges-container",
		});
		rangesContainer.createEl("h3", { text: "Verse ranges" });

		this.renderRanges(rangesContainer);

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("+ add verse range").onClick(() => {
				this.ranges.push({ surah: 1, startVerse: 1, endVerse: 7 });
				this.renderRanges(rangesContainer);
			}),
		);

		// Presets
		contentEl.createEl("h4", { text: "Quick presets" });
		const presets = contentEl.createDiv({ cls: "presets" });

		for (const preset of PRESETS) {
			const btn = presets.createEl("button", {
				text: preset.name,
				cls: "preset-btn",
			});
			btn.addEventListener("click", () => {
				this.collectionName = preset.name;
				this.ranges = preset.ranges.map((r) => ({ ...r }));
				this.renderRanges(rangesContainer);
			});
		}

		// Create button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Create collection")
				.setCta()
				.onClick(() => this.createCollection()),
		);
	}

	private renderRanges(container: HTMLElement): void {
		container.querySelectorAll(".range-item").forEach((el) => el.remove());

		for (let i = 0; i < this.ranges.length; i++) {
			const range = this.ranges[i]!;
			const item = container.createDiv({ cls: "range-item" });

			new Setting(item)
				.setName(`Range ${i + 1}`)
				.addText((text) =>
					text
						.setPlaceholder("Surah")
						.setValue(String(range.surah))
						.onChange((v) => {
							range.surah = Number(v);
						}),
				)
				.addText((text) =>
					text
						.setPlaceholder("Start")
						.setValue(String(range.startVerse))
						.onChange((v) => {
							range.startVerse = Number(v);
						}),
				)
				.addText((text) =>
					text
						.setPlaceholder("End")
						.setValue(String(range.endVerse))
						.onChange((v) => {
							range.endVerse = Number(v);
						}),
				)
				.addButton((btn) =>
					btn.setIcon("trash").onClick(() => {
						this.ranges.splice(i, 1);
						this.renderRanges(container);
					}),
				);
		}
	}

	private async createCollection(): Promise<void> {
		if (!this.collectionName || this.ranges.length === 0) {
			new Notice("Please provide a name and at least one verse range.");
			return;
		}

		const notice = new Notice("Creating collection...", 0);

		try {
			const allPages = new Set<number>();
			let body = "";

			for (const range of this.ranges) {
				const chapter = await getChapter(
					range.surah,
					this.plugin.settings.language,
				);

				const label =
					range.label ??
					`${range.surah}:${range.startVerse}-${range.endVerse}`;
				body += `\n## ${chapter.name_simple} (${label})\n`;
				body += `**Link:** [[${padNumber(range.surah, 3)} - ${chapter.name_simple}]]\n\n`;

				const allVerses = await getVersesByChapter(range.surah, {
					translations: [this.plugin.settings.defaultTranslation],
					perPage: 300,
					fields: "text_uthmani,chapter_id,page_number",
				});

				const maxVerse =
					range.endVerse === 999 ? Infinity : range.endVerse;
				const filtered = allVerses.filter(
					(v: Verse) =>
						v.verse_number >= range.startVerse &&
						v.verse_number <= maxVerse,
				);

				for (const verse of filtered) {
					if (verse.page_number) allPages.add(verse.page_number);
					body += `### ${verse.verse_key}\n\n`;
					body += `> ${verse.text_uthmani ?? ""}\n\n`;
					if (verse.translations?.[0]) {
						body += `${stripHtml(verse.translations[0].text)}\n\n`;
					}
					body += `---\n\n`;
				}
			}

			const sortedPages = [...allPages].sort((a, b) => a - b);

			let content = `---
type: collection
name: "${this.collectionName}"
created: ${new Date().toISOString().split("T")[0]}
ranges: ${JSON.stringify(this.ranges)}
pages: [${sortedPages.join(", ")}]
status: "not_started"
tags: [quran, collection, custom]
---

# ${this.collectionName}

${body}
## Progress

- [ ] Started
- [ ] Completed
- [ ] Memorized

## Notes

`;

			const safeName = this.collectionName.replace(
				/[^a-zA-Z0-9 _-]/g,
				"_",
			);
			const fileName = `${safeName}.md`;
			const path = normalizePath(`Quran/Collections/${fileName}`);

			// Ensure Collections folder exists
			const folderPath = normalizePath("Quran/Collections");
			if (!this.plugin.app.vault.getAbstractFileByPath(folderPath)) {
				await this.plugin.app.vault.createFolder(folderPath);
			}

			await this.plugin.app.vault.create(path, content);

			notice.hide();
			new Notice(`Collection "${this.collectionName}" created!`);
			this.close();

			const file = this.plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await this.plugin.app.workspace.getLeaf().openFile(file);
			}
		} catch (e) {
			notice.hide();
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Error creating collection: ${msg}`);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
