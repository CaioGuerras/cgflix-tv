// CGFLIX: lê legenda em texto (SRT, WebVTT ou ASS/SSA) e devolve o mesmo formato que o
// Jellyfin entrega em Stream.js ({TrackEvents: [{StartPositionTicks, EndPositionTicks, Text}]}).
// Usado com servidores Plex, que entregam o arquivo de legenda cru. O player higieniza o
// HTML antes de desenhar (sanitizeSubtitleHtml), então <i>/<b> do SRT podem ficar.

const TICKS_PER_SECOND = 10000000;

// 00:01:02,345 | 00:01:02.345 | 01:02.345 | 0:01:02.34 (ASS, centésimos)
const toTicks = (stamp) => {
	const m = String(stamp).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
	if (!m) return null;
	const [, h = '0', min, sec, frac = '0'] = m;
	const fraction = Number(`0.${frac}`);
	return Math.round(((Number(h) * 3600) + (Number(min) * 60) + Number(sec) + fraction) * TICKS_PER_SECOND);
};

const parseCues = (text) => {
	const events = [];
	const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
	for (const block of blocks) {
		const lines = block.split('\n');
		const timeLine = lines.findIndex((l) => l.includes('-->'));
		if (timeLine < 0) continue;
		const [from, rest] = lines[timeLine].split('-->');
		const to = (rest || '').trim().split(/\s+/)[0];
		const start = toTicks(from);
		const end = toTicks(to);
		if (start === null || end === null) continue;
		const body = lines.slice(timeLine + 1).join('\n').trim();
		if (!body) continue;
		events.push({Id: String(events.length), StartPositionTicks: start, EndPositionTicks: end, Text: body});
	}
	return events;
};

const parseAss = (text) => {
	const events = [];
	let format = null;
	let inEvents = false;
	for (const raw of text.replace(/\r/g, '').split('\n')) {
		const line = raw.trim();
		if (/^\[events\]$/i.test(line)) {
			inEvents = true;
			continue;
		}
		if (/^\[.+\]$/.test(line)) {
			inEvents = false;
			continue;
		}
		if (!inEvents) continue;
		if (/^format:/i.test(line)) {
			format = line.slice(7).split(',').map((f) => f.trim().toLowerCase());
			continue;
		}
		if (!/^dialogue:/i.test(line) || !format) continue;
		const values = line.slice(9).split(',');
		const textIndex = format.indexOf('text');
		const fields = {};
		format.forEach((name, i) => {
			fields[name] = i === textIndex ? values.slice(i).join(',') : (values[i] || '').trim();
		});
		const start = toTicks(fields.start);
		const end = toTicks(fields.end);
		const body = String(fields.text || '')
			.replace(/\{[^}]*\}/g, '')
			.replace(/\\N/gi, '\n')
			.replace(/\\h/g, ' ')
			.trim();
		if (start === null || end === null || !body) continue;
		events.push({Id: String(events.length), StartPositionTicks: start, EndPositionTicks: end, Text: body});
	}
	return events.sort((a, b) => a.StartPositionTicks - b.StartPositionTicks);
};

export const parseSubtitleText = (text) => {
	const source = String(text || '').replace(/^\uFEFF/, '');
	const isAss = /^\s*\[script info\]/i.test(source) || /^\s*\[events\]/im.test(source);
	return {TrackEvents: isAss ? parseAss(source) : parseCues(source)};
};
