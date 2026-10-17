// CGFLIX: omakase. The TV ships set up the way we think is best, so it only shows the few
// settings a viewer may want to change. Everything else waits behind the advanced mode,
// unlocked by pressing OK seven times on Version, under About, so nobody wanders into it.

export const ADVANCED_KEY = 'cgflixAdvancedSettings';
export const ADVANCED_TAPS = 7;

// category -> subcategory -> the rows it keeps (id or key), or null for all of them.
// A category or subcategory left out disappears whole.
const SIMPLE = {
	general: {
		general: ['language', 'uiLanguage', 'clock', 'showClock', 'clockDisplay', 'timeOffsetHours']
	},
	playback: {
		subtitles: ['subtitlesGeneral', 'subtitleMode', 'subtitleCustomization'],
		subtitleCustomization: null
	},
	about: {
		about: [
			'aboutHeader', 'appInfo', 'appVersion', 'platform', 'legal', 'licenses',
			'server', 'serverUrl', 'serverVersion',
			'device', 'model', 'osVersion', 'firmware', 'resolution',
			'capabilities', 'hdr', 'videoCodecs', 'audioCodecs', 'containers'
		]
	}
};

// Kids Mode draws its own exit screen and stays as it is.
const UNTOUCHED = ['kidsMode'];

export const isAdvanced = (ctx) => ctx?.settings?.[ADVANCED_KEY] === true;

const rowName = (row) => row.id || row.key || row.render;

const onlyWhenAdvanced = (node) => {
	const when = node.when;
	node.when = (ctx) => isAdvanced(ctx) && (!when || when(ctx));
};

export const applySimpleMode = (schema) => {
	schema.forEach((category) => {
		if (UNTOUCHED.includes(category.id)) return;
		const keep = SIMPLE[category.id];
		if (!keep) {
			onlyWhenAdvanced(category);
			return;
		}
		(category.subcategories || []).forEach((sub) => {
			if (!(sub.id in keep)) {
				onlyWhenAdvanced(sub);
				return;
			}
			const rows = keep[sub.id];
			if (!rows) return;
			(sub.rows || []).forEach((row) => {
				if (!rows.includes(rowName(row))) onlyWhenAdvanced(row);
			});
		});
	});
	return schema;
};
