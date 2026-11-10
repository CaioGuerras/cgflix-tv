// CGFLIX: the Tizen build paints a logo splash straight from index.html, before
// the bundle has even parsed, so the TV never sits on a black screen. The app
// takes it down once the first real screen is ready. It stays up long enough
// for the logo animation to finish, then fades out with opacity alone.
export const SPLASH_ID = 'cgf-splash';
export const MIN_VISIBLE_MS = 1400;
export const FADE_MS = 450;
// The splash paints before any setting loads, so the app mirrors the chosen
// theme background here and the splash script in index.html reads it back.
// Only plain rgb() values pass, on both sides.
export const BOOT_BACKGROUND_KEY = 'cgf_bootBackground';
export const BOOT_BACKGROUND_PATTERN = /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/;

export const rememberBootBackground = (color) => {
	if (typeof color !== 'string' || !BOOT_BACKGROUND_PATTERN.test(color)) return false;
	try {
		window.localStorage?.setItem(BOOT_BACKGROUND_KEY, color);
		return true;
	} catch (e) {
		return false;
	}
};

export const hideBootSplash = (now = Date.now()) => {
	const el = typeof document !== 'undefined' && document.getElementById(SPLASH_ID);
	if (!el || el.getAttribute('data-leaving')) return false;
	el.setAttribute('data-leaving', '1');
	const stamp = parseInt(el.getAttribute('data-shown-at'), 10);
	const shownAt = isNaN(stamp) ? now : stamp;
	const wait = Math.max(0, MIN_VISIBLE_MS - (now - shownAt));
	setTimeout(() => {
		el.style.opacity = '0';
		setTimeout(() => {
			if (el.parentNode) el.parentNode.removeChild(el);
		}, FADE_MS);
	}, wait);
	return true;
};
