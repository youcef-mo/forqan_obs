import { App, PluginSettingTab, Setting } from "obsidian";
import type QuranPlugin from "./main";

export interface QuranPluginSettings {
	defaultTranslation: number;
	showArabic: boolean;
	showTranslation: boolean;
	fontSize: number;
	language: string;
	defaultNoteViewMode: "verse" | "mushaf";
	includeMushafInGeneration: boolean;
}

export const DEFAULT_SETTINGS: QuranPluginSettings = {
	defaultTranslation: 20,
	showArabic: true,
	showTranslation: true,
	fontSize: 24,
	language: "en",
	defaultNoteViewMode: "verse",
	includeMushafInGeneration: true,
};

export class QuranSettingsTab extends PluginSettingTab {
	plugin: QuranPlugin;

	constructor(app: App, plugin: QuranPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Display").setHeading();

		new Setting(containerEl)
			.setName("Show arabic text")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showArabic)
					.onChange(async (value) => {
						this.plugin.settings.showArabic = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show translation")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showTranslation)
					.onChange(async (value) => {
						this.plugin.settings.showTranslation = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Arabic font size")
			.addSlider((slider) =>
				slider
					.setLimits(16, 48, 2)
					.setValue(this.plugin.settings.fontSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.fontSize = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default translation")
			.addDropdown((dropdown) => {
				const translations: Record<string, string> = {
					"20": "Saheeh International",
					"85": "Abdul Haleem",
					"19": "Pickthall",
					"22": "Yusuf Ali",
					"84": "Mufti Taqi Usmani",
					"203": "Al-Hilali & Khan",
				};
				for (const [id, name] of Object.entries(translations)) {
					dropdown.addOption(id, name);
				}
				dropdown
					.setValue(String(this.plugin.settings.defaultTranslation))
					.onChange(async (value) => {
						this.plugin.settings.defaultTranslation = Number(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName("Notes").setHeading();

		new Setting(containerEl)
			.setName("Default note view mode")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Mushaf" is a proper noun
				"Choose whether generated page notes show Mushaf layout or verse-by-verse by default.",
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("verse", "Verse-by-verse");
				dropdown.addOption("mushaf", "Mushaf page");
				dropdown
					.setValue(this.plugin.settings.defaultNoteViewMode)
					.onChange(async (value) => {
						this.plugin.settings.defaultNoteViewMode = value as
							| "verse"
							| "mushaf";
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Mushaf" is a proper noun
			.setName("Include Mushaf in generated notes")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Mushaf" is a proper noun
				"When generating the vault, embed a Mushaf page view in each page note.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeMushafInGeneration)
					.onChange(async (value) => {
						this.plugin.settings.includeMushafInGeneration = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Language").addDropdown((dropdown) => {
			const languages: Record<string, string> = {
				en: "English",
				ar: "Arabic",
				fr: "French",
				ur: "Urdu",
				tr: "Turkish",
				id: "Indonesian",
				bn: "Bengali",
				ru: "Russian",
				es: "Spanish",
				de: "German",
			};
			for (const [code, name] of Object.entries(languages)) {
				dropdown.addOption(code, name);
			}
			dropdown
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				});
		});
	}
}
