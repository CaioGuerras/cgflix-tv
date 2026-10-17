import {fetchTrendingIds, fetchUpcoming, __resetCgflixRowCache} from './cgflixRowsApi';
import {fetchWithTimeout} from '../utils/fetchTimeout';

jest.mock('../utils/fetchTimeout', () => ({fetchWithTimeout: jest.fn()}));
jest.mock('./jellyfinApi', () => ({
	getServerUrl: () => 'http://server',
	getUserId: () => 'user',
	getAuthHeader: () => 'MediaBrowser Token="test-token"'
}));

const mockJsonResponse = (data, status = 200) => ({
	ok: status >= 200 && status < 300,
	status,
	json: () => Promise.resolve(data)
});

const show = {Id: 'up1', ProviderIds: {SonarrId: '7'}};
const map = {s: {7: {jf: 'lib7'}}, m: {}};

// Answers each endpoint by path; a missing entry is a 404.
const serve = (routes) => {
	fetchWithTimeout.mockImplementation((url) => {
		const path = url.replace('http://server', '').split('?')[0];
		return Promise.resolve(path in routes ? mockJsonResponse(routes[path]) : mockJsonResponse(null, 404));
	});
};

describe('cgflixRowsApi', () => {
	beforeEach(() => {
		__resetCgflixRowCache();
		fetchWithTimeout.mockReset();
	});

	it('reads the trending ids and their title', async () => {
		serve({'/cgflix/emalta.json': {titulo: 'Em alta', itens: [{id: 'a'}, null, {id: 'b'}]}});
		expect(await fetchTrendingIds()).toEqual({title: 'Em alta', ids: ['a', 'b']});
	});

	it('returns the upcoming shows with the id map', async () => {
		serve({
			'/HomeScreen/Section/UpcomingShows': {Items: [show]},
			'/HomeScreen/Section/UpcomingMovies': {Items: []},
			'/cgflix/embreve.json': map
		});
		expect(await fetchUpcoming()).toEqual({shows: [show], movies: [], map});
	});

	it('does not cache an empty row when the id map fails to load', async () => {
		serve({
			'/HomeScreen/Section/UpcomingShows': {Items: [show]},
			'/HomeScreen/Section/UpcomingMovies': {Items: []}
		});
		expect(await fetchUpcoming()).toBeNull();

		serve({
			'/HomeScreen/Section/UpcomingShows': {Items: [show]},
			'/HomeScreen/Section/UpcomingMovies': {Items: []},
			'/cgflix/embreve.json': map
		});
		expect(await fetchUpcoming()).toEqual({shows: [show], movies: [], map});
	});
});
