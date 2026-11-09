// The color the navigation and media bar surfaces paint themselves with. It's
// held as a named key rather than a hex so the setting survives a round trip
// through the server profile. Earlier builds saved a hex instead, so those
// values map back onto the key they were picked from.

// Only neutral and warm tones remain. The Heisuca identity has no blue, teal
// or purple surfaces, so the old keys for those fall back to gray.
const OVERLAY_COLORS = {
	gray: '#6E6B75',
	black: '#000000',
	charcoal: '#3A3840',
	brown: '#3E2723',
	dark_red: '#8B0000',
	dark_green: '#0B4F0F',
	slate: '#4A4850'
};

const ALIASES = {
	grey: 'gray',
	darkred: 'dark_red',
	darkgreen: 'dark_green',
	'#000000': 'black',
	'#36454f': 'charcoal',
	'#8b4513': 'brown',
	'#8b0000': 'dark_red',
	'#006400': 'dark_green',
	'#708090': 'slate'
};

const owns = (map, key) => Object.prototype.hasOwnProperty.call(map, key);

// Anything unrecognized lands on gray, which is where the setting starts.
export const normalizeOverlayColorKey = (name) => {
	const raw = typeof name === 'string' ? name.trim() : '';
	if (!raw) return 'gray';
	if (owns(OVERLAY_COLORS, raw)) return raw;
	const lower = raw.toLowerCase();
	if (owns(OVERLAY_COLORS, lower)) return lower;
	return owns(ALIASES, lower) ? ALIASES[lower] : 'gray';
};

export const resolveOverlayColor = (name) => OVERLAY_COLORS[normalizeOverlayColorKey(name)];
