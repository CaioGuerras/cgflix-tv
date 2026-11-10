import {readAccentRgb, dimRgb} from './runtimeAccent';

describe('readAccentRgb', () => {
	afterEach(() => document.documentElement.style.removeProperty('--theme-accent-rgb'));

	it('reads the accent triplet set on the root element', () => {
		document.documentElement.style.setProperty('--theme-accent-rgb', '220, 184, 117');
		expect(readAccentRgb()).toEqual([220, 184, 117]);
	});

	it('falls back to the Shikkoku lilac when the variable is missing or invalid', () => {
		expect(readAccentRgb()).toEqual([184, 173, 222]);
		document.documentElement.style.setProperty('--theme-accent-rgb', 'nope');
		expect(readAccentRgb()).toEqual([184, 173, 222]);
	});

	it('dims a color toward black', () => {
		expect(dimRgb([220, 184, 117], 0.3)).toEqual([66, 55, 35]);
	});
});
