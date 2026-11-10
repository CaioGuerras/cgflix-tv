import {BOOT_BACKGROUND_KEY, FADE_MS, MIN_VISIBLE_MS, SPLASH_ID, hideBootSplash, rememberBootBackground} from './bootSplash';

describe('hideBootSplash', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		document.body.innerHTML = '';
	});
	afterEach(() => jest.useRealTimers());

	const addSplash = (shownAt) => {
		const el = document.createElement('div');
		el.id = SPLASH_ID;
		el.setAttribute('data-shown-at', String(shownAt));
		document.body.appendChild(el);
		return el;
	};

	test('does nothing without a splash', () => {
		expect(hideBootSplash(1000)).toBe(false);
	});

	test('waits out the minimum time, fades, then removes the splash', () => {
		const el = addSplash(1000);
		expect(hideBootSplash(1500)).toBe(true);
		jest.advanceTimersByTime(MIN_VISIBLE_MS - 501);
		expect(el.style.opacity).toBe('');
		jest.advanceTimersByTime(1);
		expect(el.style.opacity).toBe('0');
		jest.advanceTimersByTime(FADE_MS);
		expect(document.getElementById(SPLASH_ID)).toBeNull();
	});

	test('fades at once when the minimum already passed, and only once', () => {
		const el = addSplash(0);
		expect(hideBootSplash(MIN_VISIBLE_MS + 10)).toBe(true);
		expect(hideBootSplash(MIN_VISIBLE_MS + 20)).toBe(false);
		jest.advanceTimersByTime(0);
		expect(el.style.opacity).toBe('0');
	});
});

describe('rememberBootBackground', () => {
	beforeEach(() => window.localStorage.removeItem(BOOT_BACKGROUND_KEY));

	test('keeps the Sumi black for the next boot', () => {
		expect(rememberBootBackground('rgb(0, 0, 0)')).toBe(true);
		expect(window.localStorage.getItem(BOOT_BACKGROUND_KEY)).toBe('rgb(0, 0, 0)');
	});

	test('refuses anything that is not a plain rgb() value', () => {
		expect(rememberBootBackground('url(x)')).toBe(false);
		expect(rememberBootBackground('rgba(0, 0, 0, 0.5)')).toBe(false);
		expect(rememberBootBackground(undefined)).toBe(false);
		expect(window.localStorage.getItem(BOOT_BACKGROUND_KEY)).toBeNull();
	});
});
