import {buildThemeOverrideCss} from './themeOverrides';
import {
	DEFAULT_THEME_ID,
	OLED_THEME_ID,
	THEME_FONT_FAMILY,
	builtInThemeIdsList,
	resolveThemeById
} from './themeRegistry';
import {contrastRatio, inkOn, toCssColor, MIN_BUTTON_CONTRAST} from './themeSpec';

const THEME_IDS = [DEFAULT_THEME_ID, OLED_THEME_ID];

describe('buildThemeOverrideCss', () => {
	it('knows exactly two themes, Shikkoku first', () => {
		expect(builtInThemeIdsList).toEqual(['shikkoku', 'sumi']);
	});

	it('scopes every rule to the active theme id', () => {
		for (const id of THEME_IDS) {
			const css = buildThemeOverrideCss(resolveThemeById(id));
			const selectors = css.split('\n').filter(Boolean);
			expect(selectors.length).toBeGreaterThan(50);
			for (const line of selectors) {
				expect(line.startsWith(`html[data-theme-id='${id}'][data-theme-id]`)).toBe(true);
			}
		}
	});

	it('emits literal theme colors instead of custom properties', () => {
		const shikkoku = buildThemeOverrideCss(resolveThemeById('shikkoku'));
		expect(shikkoku).toContain('rgb(15, 13, 19)');
		expect(shikkoku).not.toContain('var(--theme');
		const sumi = buildThemeOverrideCss(resolveThemeById('sumi'));
		expect(sumi).toContain('rgb(0, 0, 0)');
		expect(sumi).not.toContain('var(--theme');
	});

	it('paints the user avatar with the theme accent', () => {
		const sumi = buildThemeOverrideCss(resolveThemeById('sumi'));
		const gold = toCssColor(resolveThemeById('sumi').colors.accent);
		const avatarRule = sumi.split('}').find((r) => r.includes('userAvatar') && r.includes('background'));
		expect(avatarRule).toBeDefined();
		expect(avatarRule).toContain(gold);
	});

	it('never paints a glow or a nav color cycle', () => {
		for (const id of THEME_IDS) {
			const css = buildThemeOverrideCss(resolveThemeById(id));
			expect(css).not.toContain('data-nav-slot');
			// The only text-shadow left is the neutral scrim behind the hero title, so the
			// text stays legible on artwork. It never takes the accent or any other colour.
			const scrim = toCssColor(resolveThemeById(id).colors.scrim).match(/\d+/g).slice(0, 3).join(', ');
			const shadows = css.match(/text-shadow: [^;]+;/g) || [];
			for (const shadow of shadows) {
				expect(shadow).toBe(`text-shadow: 0 0 20px rgba(${scrim}, 0.72);`);
			}
		}
	});

	it('keeps rounded radii outside the Fire TV preview rules', () => {
		for (const id of THEME_IDS) {
			const css = buildThemeOverrideCss(resolveThemeById(id));
			const rounded = css.split('\n').filter((line) => !line.includes('].vega '));
			expect(rounded.join('\n')).not.toContain('border-radius: 0;');
		}
	});

	it('squares the preview frame, ring and container on the Fire TV for both card styles', () => {
		const css = buildThemeOverrideCss(resolveThemeById('shikkoku'));
		const squared = css.split('\n').filter((line) => line.includes('border-radius: 0;'));
		expect(squared).toHaveLength(2);
		for (const line of squared) {
			expect(line.startsWith("html[data-theme-id='shikkoku'][data-theme-id].vega .")).toBe(true);
			expect(line.split('].vega .')).toHaveLength(4);
		}
	});

	it('names Inter on every wrapper that sets its own font', () => {
		expect(THEME_FONT_FAMILY).toBe('HeisucaInter');
		for (const id of THEME_IDS) {
			const css = buildThemeOverrideCss(resolveThemeById(id));
			expect(css).toContain('.sandstone-theme');
			expect(css).toContain("font-family: 'HeisucaInter', sans-serif;");
		}
	});

	it('fills the media bar card from its own overlay setting', () => {
		const theme = resolveThemeById('shikkoku');
		// Three quarters of the chosen opacity.
		expect(buildThemeOverrideCss(theme, {mediaBarOverlayColor: 'black', mediaBarOverlayOpacity: 100}))
			.toContain('background-color: rgba(0, 0, 0, 0.75)');
		expect(buildThemeOverrideCss(theme)).toContain('background-color: rgba(110, 107, 117, 0.375)');
	});

	it('prefers the focus border color setting over the theme focus border', () => {
		const theme = resolveThemeById('shikkoku');
		expect(buildThemeOverrideCss(theme, {focusBorderColor: '#ff0000'})).toContain('rgb(255, 0, 0)');
		expect(buildThemeOverrideCss(theme, {focusBorderColor: 'nonsense'})).not.toContain('nonsense');
	});

	it('rings a focused card in the focus color, 3 px wide', () => {
		const shikkoku = resolveThemeById('shikkoku');
		expect(shikkoku.borders.focusBorder.width).toBe(3);
		expect(toCssColor(shikkoku.borders.focusBorder.color)).toBe('rgb(241, 239, 245)');
		const sumi = resolveThemeById('sumi');
		expect(toCssColor(sumi.borders.focusBorder.color)).toBe('rgb(224, 222, 218)');
	});
});

describe('ink on a focused row', () => {
	it('picks dark text on a bright fill and light on a dim one', () => {
		expect(inkOn('#FFEAE8EE')).toBe('0, 0, 0');
		expect(inkOn('#FFDBD9D5')).toBe('0, 0, 0');
		expect(inkOn('#FF101010')).toBe('255, 255, 255');
		expect(inkOn('#FF2A2A2A')).toBe('255, 255, 255');
	});

	// A focused settings row fills with the theme's focused button colour and writes on it in that
	// colour's ink.
	it('fills every theme\'s focused settings rows with its focused button colour and writes in its ink', () => {
		for (const id of THEME_IDS) {
			const theme = resolveThemeById(id);
			const fill = theme.colors.buttonFocused;
			const ink = inkOn(fill);
			const css = buildThemeOverrideCss(theme);

			expect(css).toContain(`rgba(${ink}, 0.87)`);
			expect(css).toContain(`rgba(${ink}, 0.54)`);
			expect(css).toContain(`background: ${toCssColor(fill)};`);
		}
	});

	// The one rule that fills a button with the theme's focus colour and writes on it.
	const focusedButtonRule = (id) => buildThemeOverrideCss(resolveThemeById(id))
		.split('\n')
		.find((line) => line.includes('.actionButton:focus'));

	it('keeps the neutral button pair the identity asks for, since it holds up', () => {
		for (const id of THEME_IDS) {
			const theme = resolveThemeById(id);
			expect(contrastRatio(theme.colors.buttonFocused, theme.colors.onButtonFocused)).toBeGreaterThan(MIN_BUTTON_CONTRAST);
			expect(focusedButtonRule(id)).toContain(`color: ${toCssColor(theme.colors.onButtonFocused)}`);
		}
	});

	it('uses a neutral fill for the primary button, never the accent', () => {
		for (const id of THEME_IDS) {
			const theme = resolveThemeById(id);
			expect(theme.colors.buttonFocused).not.toBe(theme.colors.accent);
		}
	});

	it('leaves every theme with readable text on a focused button', () => {
		for (const id of THEME_IDS) {
			const theme = resolveThemeById(id);
			const declared = contrastRatio(theme.colors.buttonFocused, theme.colors.onButtonFocused);
			const fallback = contrastRatio(theme.colors.buttonFocused, inkOn(theme.colors.buttonFocused) === '0, 0, 0' ? '#FF000000' : '#FFFFFFFF');
			expect(Math.max(declared, fallback)).toBeGreaterThanOrEqual(MIN_BUTTON_CONTRAST);
		}
	});
});
