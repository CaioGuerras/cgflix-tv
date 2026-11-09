import {normalizeOverlayColorKey, resolveOverlayColor} from './overlayColors';

describe('overlay colors', () => {
	it('keeps a key it already knows', () => {
		expect(normalizeOverlayColorKey('gray')).toBe('gray');
		expect(normalizeOverlayColorKey('dark_red')).toBe('dark_red');
		expect(normalizeOverlayColorKey('charcoal')).toBe('charcoal');
		expect(resolveOverlayColor('gray')).toBe('#6E6B75');
		expect(resolveOverlayColor('black')).toBe('#000000');
	});

	it('accepts the other spellings a key can arrive in', () => {
		expect(normalizeOverlayColorKey('grey')).toBe('gray');
		expect(normalizeOverlayColorKey('DARKRED')).toBe('dark_red');
		expect(normalizeOverlayColorKey('darkgreen')).toBe('dark_green');
	});

	it('carries the hex this app used to save onto its key', () => {
		expect(normalizeOverlayColorKey('#8b0000')).toBe('dark_red');
		expect(normalizeOverlayColorKey('#36454f')).toBe('charcoal');
		expect(normalizeOverlayColorKey('#000000')).toBe('black');
	});

	it('sends the retired blue, teal and purple keys to gray', () => {
		for (const key of ['dark_blue', 'navy', 'indigo', 'purple', 'teal', 'moonfinCyan', 'neonPulseMagenta', '#00a4dc', '#6a0dad']) {
			expect(normalizeOverlayColorKey(key)).toBe('gray');
		}
	});

	it('falls back to gray for anything it cant place', () => {
		expect(normalizeOverlayColorKey('')).toBe('gray');
		expect(normalizeOverlayColorKey(undefined)).toBe('gray');
		expect(normalizeOverlayColorKey('#ffffff')).toBe('gray');
		expect(normalizeOverlayColorKey('constructor')).toBe('gray');
		expect(resolveOverlayColor('nonsense')).toBe('#6E6B75');
	});
});
