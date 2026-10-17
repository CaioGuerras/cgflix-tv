import {FADE_MS, MIN_VISIBLE_MS, SPLASH_ID, hideBootSplash} from './bootSplash';

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
