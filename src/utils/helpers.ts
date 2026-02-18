/**
 * Pad a number to a fixed width with leading zeros.
 */
export function padNumber(n: number, width: number): string {
	return String(n).padStart(width, '0');
}

/**
 * Sanitize HTML string to plain text, stripping all tags.
 */
export function stripHtml(html: string): string {
	const div = document.createElement('div');
	div.textContent = html;
	return div.textContent ?? '';
}

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
