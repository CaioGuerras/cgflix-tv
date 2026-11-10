// CGFLIX: the active theme accent as an [r, g, b] array, read from the CSS variable the app sets on <html>.
// Canvas drawings cannot use var(), so they read the accent here; the Shikkoku lilac is the fallback.
const FALLBACK = [184, 173, 222];

export const readAccentRgb = (fallback = FALLBACK) => {
	try {
		const raw = window.getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-rgb');
		const parts = String(raw).split(',').map((n) => Number.parseInt(n, 10));
		if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return parts;
	} catch (e) {
		// No DOM (tests, early boot): keep the fallback.
	}
	return fallback;
};

export const dimRgb = (rgb, factor) => rgb.map((n) => Math.round(n * factor));
