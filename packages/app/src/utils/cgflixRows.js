import {uiLocale} from './uiLocale';

// CGFLIX: turns the Home Screen Sections upcoming lists into Coming Soon cards. One card per
// title, soonest first. A title already in the library opens its own page; one that isn't
// yet opens in Seerr by its TMDB id, and one with neither is left out, having nowhere to go.

const formatDate = (time) => new Date(time).toLocaleDateString(uiLocale(), {month: 'short', day: 'numeric'});

const entryFrom = (item, kind, map) => {
	const ids = item.ProviderIds || {};
	const arrId = kind === 'tv' ? ids.SonarrSeriesId : ids.RadarrMovieId;
	const date = Date.parse(item.PremiereDate);
	if (!arrId || !Number.isFinite(date)) return null;
	const ref = (kind === 'tv' ? map.s : map.m)?.[arrId] || {};
	const hasEpisode = kind === 'tv' && item.ParentIndexNumber != null && item.IndexNumber != null;
	return {
		key: `${kind}-${arrId}`,
		kind,
		jf: ref.jf || null,
		tmdb: ref.tmdb ? String(ref.tmdb) : null,
		name: ref.nome || item.SeriesName || item.Name || '',
		episode: hasEpisode ? `S${item.ParentIndexNumber}E${item.IndexNumber}` : '',
		date,
		poster: (kind === 'tv' ? ids.SonarrPoster : ids.RadarrPoster) || null
	};
};

export const upcomingEntries = ({shows = [], movies = [], map = {}} = {}) => {
	const byKey = new Map();
	const add = (entry) => {
		if (!entry) return;
		const prev = byKey.get(entry.key);
		if (!prev || entry.date < prev.date) byKey.set(entry.key, entry);
	};
	shows.forEach((item) => add(entryFrom(item, 'tv', map)));
	movies.forEach((item) => add(entryFrom(item, 'movie', map)));
	return [...byKey.values()].filter((entry) => entry.jf || entry.tmdb).sort((a, b) => a.date - b.date);
};

// libraryById holds the library items fetched for the entries' ids. An id the server no
// longer has, or hides from this viewer, falls back to the Seerr card.
export const buildComingSoonItems = (entries, libraryById, serverUrl) => entries.map((entry) => {
	const subtitle = [entry.episode, formatDate(entry.date)].filter(Boolean).join(' - ');
	const calendarDate = new Date(entry.date).toISOString();
	const owned = entry.jf ? libraryById.get(entry.jf) : null;
	if (owned) return {...owned, Subtitle: subtitle, _calendarDate: calendarDate};
	if (!entry.tmdb) return null;
	return {
		Id: `cgflix-embreve-${entry.kind}-${entry.tmdb}`,
		Name: entry.name,
		Type: entry.kind === 'tv' ? 'Series' : 'Movie',
		ProviderIds: {Tmdb: entry.tmdb},
		_externalPosterUrl: entry.poster && serverUrl ? `${serverUrl}${entry.poster}` : null,
		_externalBackdropUrl: null,
		_external: true,
		_calendarDate: calendarDate,
		Subtitle: subtitle,
		Overview: '',
		_serverName: entry.kind === 'tv' ? 'Sonarr' : 'Radarr',
		mediaInfo: {},
		_seerr: true,
		_seerrType: 'item',
		_seerrMediaType: entry.kind,
		_seerrRaw: {mediaId: Number(entry.tmdb), mediaType: entry.kind}
	};
}).filter(Boolean);
