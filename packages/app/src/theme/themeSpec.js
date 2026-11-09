const REQUIRED_COLOR_KEYS = [
	'background',
	'onBackground',
	'surface',
	'onSurface',
	'surfaceVariant',
	'scrim',
	'accent',
	'onAccent',
	'buttonNormal',
	'buttonFocused',
	'buttonDisabled',
	'buttonActive',
	'onButtonNormal',
	'onButtonFocused',
	'onButtonDisabled',
	'inputBackground',
	'inputFocused',
	'inputBorder',
	'inputBorderFocused',
	'rangeTrack',
	'rangeProgress',
	'rangeThumb',
	'seekbarBuffered',
	'badgeBackground',
	'onBadge',
	'badgeUnplayed',
	'badgeWatched',
	'recordingActive',
	'recordingScheduled'
];

// Fallbacks for a theme that names no status colors of its own: the Shikkoku
// tokens (sucesso, acento, aviso, erro).
const DEFAULT_SEMANTIC = Object.freeze({
	statusAvailable: '#FF78C995',
	statusRequested: '#FFB8ADDE',
	statusPending: '#FFEDBB64',
	statusDownloading: '#FFB8ADDE',
	statusError: '#FFEE757C',
	mediaTypeBadgeMovie: '#FFB8ADDE',
	mediaTypeBadgeShow: '#FFABA7B2'
});

// What a theme falls back to when it carries no error color of its own.
export const DEFAULT_ERROR_COLOR = '#FFEE757C';

const normalizeHexColor = (value, fieldName) => {
	if (typeof value !== 'string') {
		throw new Error(`Theme field "${fieldName}" must be a hex color string.`);
	}
	const raw = value.trim().replace(/^#/, '');
	if (!/^[0-9a-fA-F]+$/.test(raw)) {
		throw new Error(`Theme field "${fieldName}" must be a valid hex color.`);
	}
	if (raw.length === 3) {
		const expanded = raw.split('').map((part) => part + part).join('');
		return `#FF${expanded.toUpperCase()}`;
	}
	if (raw.length === 6) {
		return `#FF${raw.toUpperCase()}`;
	}
	if (raw.length === 8) {
		return `#${raw.toUpperCase()}`;
	}
	throw new Error(`Theme field "${fieldName}" must be #RGB, #RRGGBB, or #AARRGGBB.`);
};

export const isValidHexColor = (value) => {
	if (typeof value !== 'string') return false;
	const raw = value.trim().replace(/^#/, '');
	if (!/^[0-9a-fA-F]+$/.test(raw)) return false;
	return raw.length === 3 || raw.length === 6 || raw.length === 8;
};

const parseNumber = (value, fieldName, fallback) => {
	if (value === undefined || value === null) return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Theme field "${fieldName}" must be a number.`);
	}
	return parsed;
};

const parseRadiusValue = (value, fieldName) => {
	if (typeof value === 'number') return value;
	if (typeof value === 'string') {
		const parsed = Number.parseFloat(value.replace(/px$/i, ''));
		if (Number.isFinite(parsed)) return parsed;
	}
	throw new Error(`Theme field "${fieldName}" must be a number or px string.`);
};

const parseBorderRadius = (value, fieldName) => {
	if (typeof value === 'number' || typeof value === 'string') {
		const radius = parseRadiusValue(value, fieldName);
		return {
			topLeft: radius,
			topRight: radius,
			bottomRight: radius,
			bottomLeft: radius
		};
	}
	if (!value || typeof value !== 'object') {
		throw new Error(`Theme field "${fieldName}" must be a radius value.`);
	}
	return {
		topLeft: parseRadiusValue(value.topLeft ?? value.tl ?? 0, `${fieldName}.topLeft`),
		topRight: parseRadiusValue(value.topRight ?? value.tr ?? 0, `${fieldName}.topRight`),
		bottomRight: parseRadiusValue(value.bottomRight ?? value.br ?? 0, `${fieldName}.bottomRight`),
		bottomLeft: parseRadiusValue(value.bottomLeft ?? value.bl ?? 0, `${fieldName}.bottomLeft`)
	};
};

const parseBorderSide = (value, fieldName, allowNull = false) => {
	if (value == null) {
		if (allowNull) return null;
		throw new Error(`Theme field "${fieldName}" is required.`);
	}
	if (typeof value !== 'object') {
		throw new Error(`Theme field "${fieldName}" must be a border object.`);
	}
	return {
		color: normalizeHexColor(value.color, `${fieldName}.color`),
		width: parseNumber(value.width, `${fieldName}.width`, 1)
	};
};

const parseShadow = (value, fieldName) => {
	if (!value || typeof value !== 'object') {
		throw new Error(`Theme field "${fieldName}" must be a shadow object.`);
	}
	return {
		color: normalizeHexColor(value.color, `${fieldName}.color`),
		blurRadius: parseNumber(value.blurRadius, `${fieldName}.blurRadius`, 0),
		spreadRadius: parseNumber(value.spreadRadius, `${fieldName}.spreadRadius`, 0),
		offsetX: parseNumber(value.offsetX, `${fieldName}.offsetX`, 0),
		offsetY: parseNumber(value.offsetY, `${fieldName}.offsetY`, 0)
	};
};

const parseShadowList = (value, fieldName) => {
	if (value == null) return [];
	if (!Array.isArray(value)) {
		throw new Error(`Theme field "${fieldName}" must be a list.`);
	}
	if (value.length > 8) {
		throw new Error(`Theme field "${fieldName}" supports at most 8 shadows.`);
	}
	return value.map((entry, index) => parseShadow(entry, `${fieldName}[${index}]`));
};

const parseColorGroup = (value, fieldName, defaults) => {
	const source = value || {};
	const next = {};
	for (const key of Object.keys(defaults)) {
		next[key] = normalizeHexColor(source[key] ?? defaults[key], `${fieldName}.${key}`);
	}
	return next;
};

export const parseThemeSpec = (json) => {
	if (!json || typeof json !== 'object') {
		throw new Error('Theme spec must be an object.');
	}
	const schemaVersion = Number(json.schemaVersion ?? 1);
	if (!Number.isFinite(schemaVersion) || schemaVersion > 1) {
		throw new Error('Unsupported theme schemaVersion.');
	}
	const id = typeof json.id === 'string' ? json.id.trim() : '';
	if (!id || !/^[a-z0-9_-]+$/.test(id)) {
		throw new Error('Theme id must be lowercase letters, numbers, underscores, or hyphens.');
	}
	const displayName = typeof json.displayName === 'string' ? json.displayName.trim() : '';
	if (!displayName) {
		throw new Error('Theme displayName is required.');
	}
	const colorsSource = json.colors;
	if (!colorsSource || typeof colorsSource !== 'object') {
		throw new Error('Theme colors are required.');
	}
	const colors = {};
	for (const key of REQUIRED_COLOR_KEYS) {
		colors[key] = normalizeHexColor(colorsSource[key], `colors.${key}`);
	}
	// Optional on the other clients too, so a theme without one is not an error.
	colors.error = colorsSource.error != null
		? normalizeHexColor(colorsSource.error, 'colors.error')
		: null;
	const bordersSource = json.borders;
	if (!bordersSource || typeof bordersSource !== 'object') {
		throw new Error('Theme borders are required.');
	}
	return {
		schemaVersion,
		id,
		displayName,
		description: typeof json.description === 'string' && json.description.trim() ? json.description.trim() : '',
		fontFamily: typeof json.fontFamily === 'string' && json.fontFamily.trim() ? json.fontFamily.trim() : null,
		colors,
		borders: {
			cardBorder: parseBorderSide(bordersSource.cardBorder, 'borders.cardBorder'),
			chipBorder: parseBorderSide(bordersSource.chipBorder, 'borders.chipBorder'),
			focusBorder: parseBorderSide(bordersSource.focusBorder, 'borders.focusBorder'),
			cardRadius: parseBorderRadius(bordersSource.cardRadius, 'borders.cardRadius'),
			chipRadius: parseBorderRadius(bordersSource.chipRadius, 'borders.chipRadius'),
			chipBackground: normalizeHexColor(bordersSource.chipBackground, 'borders.chipBackground'),
			focusGlow: parseShadowList(bordersSource.focusGlow, 'borders.focusGlow'),
			navBorder: parseBorderSide(bordersSource.navBorder, 'borders.navBorder', true)
		},
		semantic: parseColorGroup(json.semantic, 'semantic', DEFAULT_SEMANTIC)
	};
};

export const toCssColorWithAlpha = (hex, alphaMultiplier) => {
	const normalized = normalizeHexColor(hex, 'color');
	const value = normalized.slice(1);
	const alpha = Number.parseInt(value.slice(0, 2), 16) / 255;
	const red = Number.parseInt(value.slice(2, 4), 16);
	const green = Number.parseInt(value.slice(4, 6), 16);
	const blue = Number.parseInt(value.slice(6, 8), 16);
	const adjusted = Math.min(1, Math.max(0, alpha * alphaMultiplier));
	if (adjusted >= 0.999) return `rgb(${red}, ${green}, ${blue})`;
	return `rgba(${red}, ${green}, ${blue}, ${Math.round(adjusted * 1000) / 1000})`;
};

export const toCssColor = (hex) => {
	const normalized = normalizeHexColor(hex, 'color');
	const value = normalized.slice(1);
	const alpha = Number.parseInt(value.slice(0, 2), 16) / 255;
	const red = Number.parseInt(value.slice(2, 4), 16);
	const green = Number.parseInt(value.slice(4, 6), 16);
	const blue = Number.parseInt(value.slice(6, 8), 16);
	if (alpha >= 0.999) {
		return `rgb(${red}, ${green}, ${blue})`;
	}
	return `rgba(${red}, ${green}, ${blue}, ${Math.round(alpha * 1000) / 1000})`;
};

// Extract RGB triplet as string for use in rgba(var(...), opacity) syntax
export const toRgbTriplet = (hex) => {
	const normalized = normalizeHexColor(hex, 'color');
	const value = normalized.slice(1);
	const red = Number.parseInt(value.slice(2, 4), 16);
	const green = Number.parseInt(value.slice(4, 6), 16);
	const blue = Number.parseInt(value.slice(6, 8), 16);
	return `${red}, ${green}, ${blue}`;
};

// Whether text on a colour should be dark or light comes down to how bright that
// colour is. The crossover sits where black and white read equally well against
// it, so either side of that line picks the one that reads better.
const INK_CROSSOVER = 0.179;

// The least a button label has to differ from its fill to stay readable. Button
// text is large and bold, which is the case that gets by on three rather than
// the four and a half a paragraph needs.
export const MIN_BUTTON_CONTRAST = 3;

const relativeLuminance = (hex) => {
	const channels = toRgbTriplet(hex).split(', ').map(Number);
	const linear = channels.map((value) => {
		const part = value / 255;
		return part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4);
	});
	return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
};

/**
 * The rgb triplet to write on top of a colour, dark for a bright background and
 * light for a dim one.
 *
 * @param {string} hex - the background the text sits on
 * @returns {string} an rgb triplet ready for an rgba()
 */
export const inkOn = (hex) => (relativeLuminance(hex) > INK_CROSSOVER ? '0, 0, 0' : '255, 255, 255');

/**
 * How far apart two colours are to read, on the usual 1 to 21 scale.
 *
 * @param {string} hex
 * @param {string} other
 * @returns {number}
 */
export const contrastRatio = (hex, other) => {
	const first = relativeLuminance(hex);
	const second = relativeLuminance(other);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

export const radiusToCss = (radius) => {
	if (!radius) return '0px';
	const {topLeft, topRight, bottomRight, bottomLeft} = radius;
	if (topLeft === topRight && topLeft === bottomRight && topLeft === bottomLeft) {
		return `${topLeft}px`;
	}
	return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
};

export const shadowToCss = (shadow) => {
	const offsetX = shadow.offsetX || 0;
	const offsetY = shadow.offsetY || 0;
	const blur = shadow.blurRadius || 0;
	const spread = shadow.spreadRadius || 0;
	return `${offsetX}px ${offsetY}px ${blur}px ${spread}px ${toCssColor(shadow.color)}`;
};

export const buildThemeCssVars = (theme) => ({
	'--accent-color': toCssColor(theme.borders.focusBorder.color),
	'--theme-background': toCssColor(theme.colors.background),
	'--theme-on-background': toCssColor(theme.colors.onBackground),
	'--theme-surface': toCssColor(theme.colors.surface),
	'--theme-on-surface': toCssColor(theme.colors.onSurface),
	'--theme-surface-variant': toCssColor(theme.colors.surfaceVariant),
	'--theme-scrim': toCssColor(theme.colors.scrim),
	'--theme-accent': toCssColor(theme.colors.accent),
	'--theme-on-accent': toCssColor(theme.colors.onAccent),
	'--theme-button-normal': toCssColor(theme.colors.buttonNormal),
	'--theme-button-focused': toCssColor(theme.colors.buttonFocused),
	'--theme-button-disabled': toCssColor(theme.colors.buttonDisabled),
	'--theme-button-active': toCssColor(theme.colors.buttonActive),
	'--theme-input-background': toCssColor(theme.colors.inputBackground),
	'--theme-input-focused': toCssColor(theme.colors.inputFocused),
	'--theme-input-border': toCssColor(theme.colors.inputBorder),
	'--theme-input-border-focused': toCssColor(theme.colors.inputBorderFocused),
	'--theme-range-track': toCssColor(theme.colors.rangeTrack),
	'--theme-range-progress': toCssColor(theme.colors.rangeProgress),
	'--theme-range-thumb': toCssColor(theme.colors.rangeThumb),
	'--theme-seekbar-buffered': toCssColor(theme.colors.seekbarBuffered),
	'--theme-badge-background': toCssColor(theme.colors.badgeBackground),
	'--theme-badge-unplayed': toCssColor(theme.colors.badgeUnplayed),
	'--theme-badge-watched': toCssColor(theme.colors.badgeWatched),
	'--theme-recording-active': toCssColor(theme.colors.recordingActive),
	'--theme-recording-scheduled': toCssColor(theme.colors.recordingScheduled),
	'--theme-focus-border-color': toCssColor(theme.borders.focusBorder.color),
	'--theme-focus-border-width': `${theme.borders.focusBorder.width}px`,
	'--theme-card-radius': radiusToCss(theme.borders.cardRadius),
	'--theme-chip-radius': radiusToCss(theme.borders.chipRadius),
	'--theme-chip-background': toCssColor(theme.borders.chipBackground),
	'--theme-chip-border': `${theme.borders.chipBorder.width}px solid ${toCssColor(theme.borders.chipBorder.color)}`,
	'--theme-card-border': `${theme.borders.cardBorder.width}px solid ${toCssColor(theme.borders.cardBorder.color)}`,
	'--theme-nav-border': theme.borders.navBorder
		? `${theme.borders.navBorder.width}px solid ${toCssColor(theme.borders.navBorder.color)}`
		: 'none',
	'--theme-focus-glow': theme.borders.focusGlow.length ? theme.borders.focusGlow.map(shadowToCss).join(', ') : 'none',
	'--theme-font-family': theme.fontFamily || 'inherit',
	'--theme-error': toCssColor(theme.colors.error || DEFAULT_ERROR_COLOR),
	'--theme-status-error': toCssColor(theme.semantic.statusError),
	'--theme-status-available': toCssColor(theme.semantic.statusAvailable),
	'--theme-status-available-20': toCssColorWithAlpha(theme.semantic.statusAvailable, 0.2),
	'--theme-status-requested': toCssColor(theme.semantic.statusRequested),
	'--theme-status-pending': toCssColor(theme.semantic.statusPending),
	'--theme-status-pending-20': toCssColorWithAlpha(theme.semantic.statusPending, 0.2),
	'--theme-status-downloading': toCssColor(theme.semantic.statusDownloading),
	'--theme-badge-movie': toCssColor(theme.semantic.mediaTypeBadgeMovie),
	'--theme-badge-show': toCssColor(theme.semantic.mediaTypeBadgeShow),
	// button text
	'--theme-on-button-normal': toCssColor(theme.colors.onButtonNormal),
	'--theme-on-button-focused': toCssColor(theme.colors.onButtonFocused),
	'--theme-on-button-disabled': toCssColor(theme.colors.onButtonDisabled),
	'--theme-on-badge': toCssColor(theme.colors.onBadge),
	// derived convenience vars consumed by global LESS variables
	'--theme-text-primary': toCssColor(theme.colors.onBackground),
	'--theme-text-secondary': toCssColorWithAlpha(theme.colors.onSurface, 0.7),
	'--theme-text-muted': toCssColorWithAlpha(theme.colors.onSurface, 0.45),
	'--theme-border-color': toCssColor(theme.borders.cardBorder.color),
	'--theme-accent-secondary': toCssColor(theme.colors.recordingScheduled),
	'--theme-login-gradient-end': toCssColor(theme.colors.surfaceVariant),
	// RGB triplet vars for use in rgba(var(...), opacity) syntax
	'--theme-background-rgb': toRgbTriplet(theme.colors.background),
	'--theme-surface-rgb': toRgbTriplet(theme.colors.surface),
	'--theme-on-background-rgb': toRgbTriplet(theme.colors.onBackground),
	'--theme-on-surface-rgb': toRgbTriplet(theme.colors.onSurface),
	'--theme-accent-rgb': toRgbTriplet(theme.colors.accent),
	'--theme-surface-variant-rgb': toRgbTriplet(theme.colors.surfaceVariant),
	'--theme-scrim-rgb': toRgbTriplet(theme.colors.scrim)
});
