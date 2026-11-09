import {parseThemeSpec} from './themeSpec';

// Heisuca has exactly two looks on the TV: Shikkoku (the default) and Sumi
// (pure black for OLED panels). Every value comes from the brand tokens in
// marca/tokens/temas/{shikkoku,sumi}.tokens.json, so the TV and the phone apps
// share one palette.
//
// Use rules the stylesheets rely on:
//  - the primary button (Play) is neutral, never coloured: buttonFocused and
//    onButtonFocused carry botao.fundo and botao.texto;
//  - the accent is for small things only (active tab, progress bar, switch, chip);
//  - the red seal (selo) lives in the logo and icon only, so it has no slot here;
//  - focus is a 3 px ring in the `foco` colour with no coloured glow.

export const DEFAULT_THEME_ID = 'shikkoku';
export const OLED_THEME_ID = 'sumi';
export const THEME_FONT_FAMILY = 'HeisucaInter';

// Brand tokens as plain #RRGGBB. `selo` is listed for completeness and is not
// mapped to any theme slot on purpose.
const TOKENS = Object.freeze({
	shikkoku: Object.freeze({
		fundo: '#0F0D13',
		superficie: '#1A181F',
		superficie2: '#26242C',
		borda: '#3E3B44',
		texto: '#EAE8EE',
		texto2: '#ABA7B2',
		acento: '#B8ADDE',
		acentoSuave: '#37304C',
		botaoFundo: '#EAE8EE',
		botaoTexto: '#0F0D13',
		foco: '#F1EFF5',
		selo: '#C84127',
		sucesso: '#78C995',
		erro: '#EE757C',
		aviso: '#EDBB64'
	}),
	sumi: Object.freeze({
		fundo: '#000000',
		superficie: '#100F0E',
		superficie2: '#1D1C1A',
		borda: '#343330',
		texto: '#DBD9D5',
		texto2: '#96938E',
		acento: '#DCB875',
		acentoSuave: '#392B11',
		botaoFundo: '#DBD9D5',
		botaoTexto: '#000000',
		foco: '#E0DEDA',
		selo: '#C84127',
		sucesso: '#75BE8F',
		erro: '#E97078',
		aviso: '#E3B667'
	})
});

// Night variants of the two kids accents, for Kids Mode over Shikkoku.
export const KIDS_ACCENTS = Object.freeze({
	ichigo: '#EE939B',
	sorairo: '#7FC4EC'
});

const argb = (hex, alphaByte = 'FF') => `#${alphaByte}${hex.replace('#', '')}`;

const buildTheme = (id, displayName, t) => parseThemeSpec({
	schemaVersion: 1,
	id,
	displayName,
	fontFamily: THEME_FONT_FAMILY,
	semantic: {
		statusAvailable: argb(t.sucesso),
		statusRequested: argb(t.acento),
		statusPending: argb(t.aviso),
		statusDownloading: argb(t.acento),
		statusError: argb(t.erro),
		mediaTypeBadgeMovie: argb(t.acento),
		mediaTypeBadgeShow: argb(t.texto2)
	},
	colors: {
		background: argb(t.fundo),
		onBackground: argb(t.texto),
		surface: argb(t.superficie),
		onSurface: argb(t.texto),
		surfaceVariant: argb(t.superficie2),
		scrim: argb(t.fundo, 'CC'),
		accent: argb(t.acento),
		onAccent: argb(t.fundo),
		buttonNormal: argb(t.superficie2),
		buttonFocused: argb(t.botaoFundo),
		buttonDisabled: argb(t.superficie),
		buttonActive: argb(t.acentoSuave),
		onButtonNormal: argb(t.texto),
		onButtonFocused: argb(t.botaoTexto),
		onButtonDisabled: argb(t.texto2, '99'),
		inputBackground: argb(t.superficie),
		inputFocused: argb(t.superficie2),
		inputBorder: argb(t.borda),
		inputBorderFocused: argb(t.foco),
		rangeTrack: argb(t.borda),
		rangeProgress: argb(t.acento),
		rangeThumb: argb(t.foco),
		seekbarBuffered: argb(t.texto2, '80'),
		badgeBackground: argb(t.acento),
		onBadge: argb(t.fundo),
		badgeUnplayed: argb(t.acento),
		badgeWatched: argb(t.sucesso),
		recordingActive: argb(t.erro),
		recordingScheduled: argb(t.aviso),
		error: argb(t.erro)
	},
	borders: {
		cardBorder: {color: '#00000000', width: 1},
		chipBorder: {color: argb(t.borda), width: 1},
		focusBorder: {color: argb(t.foco), width: 3},
		cardRadius: 8,
		chipRadius: 999,
		chipBackground: argb(t.acentoSuave),
		focusGlow: [],
		navBorder: {color: argb(t.borda), width: 1}
	}
});

const shikkokuTheme = buildTheme('shikkoku', 'Shikkoku', TOKENS.shikkoku);
const sumiTheme = buildTheme('sumi', 'Sumi (preto OLED)', TOKENS.sumi);

const builtInThemes = Object.freeze({
	[DEFAULT_THEME_ID]: shikkokuTheme,
	[OLED_THEME_ID]: sumiTheme
});

export const builtInThemeIdsList = Object.freeze(Object.keys(builtInThemes));
export const isBuiltInThemeId = (id) => Object.prototype.hasOwnProperty.call(builtInThemes, id);

export const getAvailableThemes = () => builtInThemes;
export const getAvailableThemeList = () => Object.values(builtInThemes);

export const resolveThemeById = (id) => (isBuiltInThemeId(id) ? builtInThemes[id] : builtInThemes[DEFAULT_THEME_ID]);

/**
 * Maps whatever theme value an older build saved onto one of the two themes.
 * Anything that was black or OLED becomes Sumi, everything else Shikkoku.
 *
 * @param {*} value - the saved visualTheme (or a legacy custom theme id)
 * @param {*} [legacyOledMode] - the old separate OLED setting, when present
 * @returns {string} 'shikkoku' or 'sumi'
 */
export const migrateSavedTheme = (value, legacyOledMode) => {
	if (isBuiltInThemeId(value)) return value;
	const id = typeof value === 'string' ? value.toLowerCase() : '';
	if (id.indexOf('oled') >= 0 || id.indexOf('black') >= 0 || id.indexOf('preto') >= 0) return OLED_THEME_ID;
	// 'subtle' was the factory default of the old OLED switch, so it says nothing
	// about the user; only the deliberate 'vivid' choice counts as OLED.
	if (legacyOledMode === 'vivid') return OLED_THEME_ID;
	return DEFAULT_THEME_ID;
};

/**
 * Kids Mode keeps Shikkoku and only swaps the accent for the night variant of
 * the kid's colour.
 *
 * @param {object} theme - a parsed theme
 * @param {string} [palette] - 'ichigo' or 'sorairo'
 * @returns {object} the same theme with the accent swapped
 */
export const withKidsAccent = (theme, palette) => {
	const accent = KIDS_ACCENTS[palette] || KIDS_ACCENTS.ichigo;
	const value = argb(accent);
	return {
		...theme,
		colors: {
			...theme.colors,
			accent: value,
			rangeProgress: value,
			badgeBackground: value,
			badgeUnplayed: value
		},
		borders: {...theme.borders, chipBackground: argb(accent, '2E')},
		semantic: {...theme.semantic, statusRequested: value, statusDownloading: value, mediaTypeBadgeMovie: value}
	};
};
