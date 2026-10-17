import {buildComingSoonItems, upcomingEntries} from './cgflixRows';

const episode = (seriesId, season, number, date, extra = {}) => ({
	Name: `Episode ${number}`,
	SeriesName: 'Show',
	ParentIndexNumber: season,
	IndexNumber: number,
	PremiereDate: date,
	ProviderIds: {SonarrSeriesId: String(seriesId), SonarrPoster: `/poster/${seriesId}.jpg`},
	...extra
});

const movie = (movieId, date) => ({
	Name: `Movie ${movieId}`,
	PremiereDate: date,
	ProviderIds: {RadarrMovieId: String(movieId), RadarrPoster: `/poster/m${movieId}.jpg`}
});

const map = {
	s: {'1': {jf: 'jf-show-1', tmdb: 100}, '2': {tmdb: 200, nome: 'Second Show'}, '3': {}},
	m: {'7': {tmdb: 700}}
};

describe('upcomingEntries', () => {
	test('keeps one entry per title, at its soonest date, soonest first', () => {
		const entries = upcomingEntries({
			shows: [
				episode(1, 1, 3, '2026-10-20T00:00:00Z'),
				episode(1, 1, 2, '2026-10-18T00:00:00Z'),
				episode(2, 2, 1, '2026-10-19T00:00:00Z')
			],
			movies: [movie(7, '2026-10-17T00:00:00Z')],
			map
		});
		expect(entries.map((entry) => entry.key)).toEqual(['movie-7', 'tv-1', 'tv-2']);
		expect(entries[1].episode).toBe('S1E2');
		expect(entries[2].name).toBe('Second Show');
		expect(entries[0].tmdb).toBe('700');
	});

	test('drops titles with nowhere to open and items without a date or id', () => {
		const entries = upcomingEntries({
			shows: [
				episode(3, 1, 1, '2026-10-18T00:00:00Z'),
				episode(1, 1, 1, 'not a date'),
				{Name: 'No id', PremiereDate: '2026-10-18T00:00:00Z', ProviderIds: {}}
			],
			map
		});
		expect(entries).toEqual([]);
	});

	test('tolerates a missing payload', () => {
		expect(upcomingEntries()).toEqual([]);
		expect(upcomingEntries({shows: [episode(1, 1, 1, '2026-10-18T00:00:00Z')]})).toEqual([]);
	});
});

describe('buildComingSoonItems', () => {
	const entries = upcomingEntries({
		shows: [episode(1, 1, 2, '2026-10-18T12:00:00Z'), episode(2, 2, 1, '2026-10-19T12:00:00Z')],
		movies: [movie(7, '2026-10-17T12:00:00Z')],
		map
	});

	test('a title in the library keeps its own item, with the date as subtitle', () => {
		const library = new Map([['jf-show-1', {Id: 'jf-show-1', Name: 'Show', Type: 'Series'}]]);
		const items = buildComingSoonItems(entries, library, 'https://server');
		const owned = items.find((item) => item.Id === 'jf-show-1');
		expect(owned.Type).toBe('Series');
		expect(owned.Subtitle.startsWith('S1E2 - ')).toBe(true);
		expect(owned._calendarDate).toBe('2026-10-18T12:00:00.000Z');
		expect(owned._seerr).toBeUndefined();
	});

	test('a title not in the library becomes a Seerr card by its TMDB id', () => {
		const items = buildComingSoonItems(entries, new Map(), 'https://server');
		expect(items.map((item) => item.Id)).toEqual([
			'cgflix-embreve-movie-700',
			'cgflix-embreve-tv-100',
			'cgflix-embreve-tv-200'
		]);
		const card = items[2];
		expect(card.Name).toBe('Second Show');
		expect(card._seerrRaw).toEqual({mediaId: 200, mediaType: 'tv'});
		expect(card._externalPosterUrl).toBe('https://server/poster/2.jpg');
		expect(card._serverName).toBe('Sonarr');
		expect(items[0].Type).toBe('Movie');
		expect(items[0].Subtitle.includes(' - ')).toBe(false);
	});

	test('a library id the viewer cannot see without a TMDB id is left out', () => {
		const onlyLibrary = [{...entries[1], tmdb: null}];
		expect(buildComingSoonItems(onlyLibrary, new Map(), 'https://server')).toEqual([]);
	});
});
