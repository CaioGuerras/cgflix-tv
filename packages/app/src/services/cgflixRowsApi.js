import {getAuthHeader, getServerUrl, getUserId} from './jellyfinApi';
import {fetchWithTimeout} from '../utils/fetchTimeout';
import {mediaServerQueue} from '../utils/requestQueue';

// CGFLIX: the lists behind the Trending in Brazil and Coming Soon rows. The server keeps two
// small files next to the web client (/cgflix/emalta.json with the library ids of what's
// trending, /cgflix/embreve.json mapping Sonarr and Radarr ids to library or TMDB ids), and
// the upcoming episodes and movies come from the Home Screen Sections plugin, which only
// answers a user token. A server without them gives empty rows, which the home screen drops.

const cache = {};
const CACHE_TTL_MS = 30 * 60 * 1000;

const cacheScope = () => `${getServerUrl() || ''}|${getUserId() || ''}`;

// Exported so tests can clear the cache between cases.
export const __resetCgflixRowCache = () => {
	for (const key of Object.keys(cache)) {
		delete cache[key];
	}
};

// The files are served with a long expiry for the web client, so the hour goes in the query
// to read a fresh copy without asking the TV's engine for cache modes it may not have.
const getJson = async (path, {auth = false} = {}) => {
	const baseUrl = getServerUrl();
	if (!baseUrl) return null;
	const headers = auth ? {'Authorization': getAuthHeader()} : {};
	const sep = path.includes('?') ? '&' : '?';
	const url = `${baseUrl}${path}${auth ? '' : `${sep}h=${Math.floor(Date.now() / 3600000)}`}`;
	try {
		const response = await mediaServerQueue.run(() => fetchWithTimeout(url, {headers}, 10000));
		if (!response.ok) return null;
		return await response.json();
	} catch (err) {
		console.warn('[CgflixRows] Fetch failed:', path, err);
		return null;
	}
};

const cached = async (name, load) => {
	const key = `${cacheScope()}|${name}`;
	const hit = cache[key];
	if (hit && (Date.now() - hit.fetchedAt) < CACHE_TTL_MS) return hit.payload;
	const payload = await load();
	if (payload) cache[key] = {payload, fetchedAt: Date.now()};
	return payload || hit?.payload || null;
};

// Library ids, most watched first.
export const fetchTrendingIds = () => cached('emalta', async () => {
	const data = await getJson('/cgflix/emalta.json');
	const ids = (data?.itens || []).map((it) => it && it.id).filter(Boolean);
	return ids.length > 0 ? {title: data.titulo || null, ids} : null;
});

export const fetchUpcoming = () => cached('embreve', async () => {
	const userId = getUserId();
	if (!userId) return null;
	const [shows, movies, map] = await Promise.all([
		getJson(`/HomeScreen/Section/UpcomingShows?UserId=${userId}`, {auth: true}),
		getJson(`/HomeScreen/Section/UpcomingMovies?UserId=${userId}`, {auth: true}),
		getJson('/cgflix/embreve.json')
	]);
	const payload = {shows: shows?.Items || [], movies: movies?.Items || [], map: map || {}};
	return payload.shows.length > 0 || payload.movies.length > 0 ? payload : null;
});
