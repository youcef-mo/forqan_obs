import { requestUrl } from "obsidian";

const BASE_URL = "https://api.quran.com/api/v4";

// --- Response types matching the public API (snake_case) ---

export interface Chapter {
	id: number;
	revelation_place: string;
	revelation_order: number;
	bismillah_pre: boolean;
	name_simple: string;
	name_complex: string;
	name_arabic: string;
	verses_count: number;
	pages: number[];
	translated_name: { language_name: string; name: string };
}

export interface Translation {
	id: number;
	resource_id: number;
	text: string;
}

export interface Verse {
	id: number;
	verse_number: number;
	verse_key: string;
	chapter_id: number;
	text_uthmani: string;
	page_number: number;
	juz_number: number;
	hizb_number: number;
	translations?: Translation[];
}

export interface Juz {
	id: number;
	juz_number: number;
	verse_mapping: Record<string, string>;
	first_verse_id: number;
	last_verse_id: number;
	verses_count: number;
}

export interface SearchResultVerse {
	verse_key: string;
	verse_id: number;
	text: string;
	translations?: Array<{
		text: string;
		resource_id: number;
		name: string;
		language_name: string;
	}>;
}

export interface SearchResponse {
	search: {
		query: string;
		total_results: number;
		current_page: number;
		total_pages: number;
		results: SearchResultVerse[];
	};
}

// --- API functions ---

async function fetchJson<T>(
	path: string,
	params?: Record<string, string | number | undefined>,
): Promise<T> {
	const url = new URL(`${BASE_URL}${path}`);
	if (params) {
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) {
				url.searchParams.set(key, String(value));
			}
		}
	}
	const response = await requestUrl({ url: url.toString() });
	return response.json as T;
}

export async function getChapters(language = "en"): Promise<Chapter[]> {
	const data = await fetchJson<{ chapters: Chapter[] }>("/chapters", {
		language,
	});
	return data.chapters;
}

export async function getChapter(
	id: number,
	language = "en",
): Promise<Chapter> {
	const data = await fetchJson<{ chapter: Chapter }>(`/chapters/${id}`, {
		language,
	});
	return data.chapter;
}

export interface GetVersesOptions {
	translations?: number[];
	perPage?: number;
	fields?: string;
}

export async function getVersesByChapter(
	chapterId: number,
	options: GetVersesOptions = {},
): Promise<Verse[]> {
	const params: Record<string, string | number | undefined> = {
		per_page: options.perPage ?? 300,
		fields: options.fields ?? "text_uthmani,chapter_id",
		translations: options.translations?.join(","),
	};
	const data = await fetchJson<{ verses: Verse[] }>(
		`/verses/by_chapter/${chapterId}`,
		params,
	);
	return data.verses;
}

export async function getVersesByPage(
	page: number,
	options: GetVersesOptions = {},
): Promise<Verse[]> {
	const params: Record<string, string | number | undefined> = {
		per_page: options.perPage ?? 50,
		fields: options.fields ?? "text_uthmani,chapter_id",
		translations: options.translations?.join(","),
	};
	const data = await fetchJson<{ verses: Verse[] }>(
		`/verses/by_page/${page}`,
		params,
	);
	return data.verses;
}

export async function getJuzs(): Promise<Juz[]> {
	const data = await fetchJson<{ juzs: Juz[] }>("/juzs");
	return data.juzs;
}

// --- Word-level types for Mushaf layout ---

export interface Word {
	id: number;
	position: number;
	text_uthmani: string;
	char_type_name: "word" | "end" | "pause";
	line_number: number;
	page_number: number;
}

export interface VerseWithWords extends Verse {
	words: Word[];
}

export async function getVersesByPageWithWords(
	page: number,
): Promise<VerseWithWords[]> {
	const params: Record<string, string | number> = {
		per_page: 50,
		words: 1,
		fields: "text_uthmani,chapter_id",
		word_fields:
			"text_uthmani,line_number,page_number,position,char_type_name",
	};
	const data = await fetchJson<{ verses: VerseWithWords[] }>(
		`/verses/by_page/${page}`,
		params,
	);
	return data.verses;
}

export async function search(
	query: string,
	options: { size?: number; language?: string } = {},
): Promise<SearchResponse> {
	return fetchJson<SearchResponse>("/search", {
		q: query,
		size: options.size ?? 20,
		language: options.language ?? "en",
	});
}
