import {defaultSettings} from '../../context/defaultSettings';

import {SETTINGS_SCHEMA} from './settingsSchema';
import {ADVANCED_KEY} from './cgflixSimpleSettings';

const ctxWith = (advanced) => ({
	settings: {...defaultSettings, [ADVANCED_KEY]: advanced},
	seerr: {isEnabled: true, pluginInfo: {}},
	achievements: {},
	actions: {},
	capabilities: {modelName: 'QN55QN85BAGXZD'}
});

const shown = (node, ctx) => !node.when || !!node.when(ctx);

const visible = (ctx) => SETTINGS_SCHEMA
	.filter((category) => shown(category, ctx))
	.map((category) => ({
		id: category.id,
		subs: (category.subcategories || []).filter((sub) => shown(sub, ctx)).map((sub) => ({
			id: sub.id,
			rows: (sub.rows || []).filter((row) => shown(row, ctx)).map((row) => row.id || row.key || row.render)
		}))
	}));

describe('CGFLIX simple settings', () => {
	test('starts in the simple mode', () => {
		expect(defaultSettings[ADVANCED_KEY]).toBe(false);
	});

	test('the simple mode keeps only General, Playback and About', () => {
		expect(visible(ctxWith(false)).map((category) => category.id)).toEqual(['general', 'playback', 'about']);
	});

	test('nothing about accounts, the plugin or Seerr is left in the simple mode', () => {
		const rows = visible(ctxWith(false)).flatMap((category) => category.subs.flatMap((sub) => sub.rows));
		for (const gone of ['kidsMode', 'parentalControls', 'pinCodeSettings', 'autoLoginBehavior', 'alwaysAuthenticate',
			'serverSortBy', 'settingsSync', 'useMoonfinPlugin', 'subtitleDownloadLanguages', 'supportMoonfin', 'checkForUpdates']) {
			expect(rows).not.toContain(gone);
		}
	});

	test('playback only offers the subtitles', () => {
		const playback = visible(ctxWith(false)).find((category) => category.id === 'playback');
		expect(playback.subs.map((sub) => sub.id)).toEqual(['subtitles', 'subtitleCustomization']);
		expect(playback.subs[0].rows).toEqual(['subtitlesGeneral', 'subtitleMode', 'subtitleCustomization', 'subtitleCustomization']);
	});

	test('the advanced mode brings every category back', () => {
		const ids = visible(ctxWith(true)).map((category) => category.id);
		expect(ids).toEqual(expect.arrayContaining(['account', 'general', 'appearance', 'playback', 'storage', 'about']));
	});
});
