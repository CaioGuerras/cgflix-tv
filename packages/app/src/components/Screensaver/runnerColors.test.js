import {runnerColors} from './runnerColors';

describe('runnerColors', () => {
	afterEach(() => document.documentElement.style.removeProperty('--theme-accent-rgb'));

	it('follows the theme accent (Sumi gold)', () => {
		document.documentElement.style.setProperty('--theme-accent-rgb', '220, 184, 117');
		expect(runnerColors()).toEqual({lead: 'rgb(220, 184, 117)', trail: 'rgb(141, 118, 75)'});
	});

	it('keeps the Shikkoku lilac without a theme', () => {
		expect(runnerColors().lead).toBe('rgb(184, 173, 222)');
	});
});
