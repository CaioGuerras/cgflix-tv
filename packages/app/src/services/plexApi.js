// CGFLIX: adaptador do Plex.
//
// O app inteiro fala com o servidor pelo objeto `api` do jellyfinApi.js e lê respostas no
// formato do Jellyfin (BaseItemDto). Este módulo implementa o mesmo contrato para um servidor
// Plex: cada método fala com a API do Plex e devolve os dados no formato que as telas já usam.
// Assim o Plex entra como mais um tipo de servidor (serverType 'plex'), como o Emby, sem
// duplicar telas nem o player.
//
// Convenções de id (para não colidir com o ratingKey numérico do Plex):
//   biblioteca  plexlib-{seção}      pessoa  plexperson-{tag}      gênero  plexgenre-{seção}-{chave}
//
// Fora desta fase (documentado em PLEX.md): favoritos (no Plex isso é a Watchlist do plex.tv),
// TV ao vivo, música, listas do plugin Moonfin, edição de metadados.

import {plexHeaders} from './plexTv';
import {registerPlexServer, rememberPlexImages} from './plexImages';

const TIMEOUT_MS = 20000;
const TICKS_PER_MS = 10000;

const TYPE_TO_JF = {movie: 'Movie', show: 'Series', season: 'Season', episode: 'Episode', collection: 'BoxSet', playlist: 'Playlist', clip: 'Video'};
const JF_TO_PLEX_TYPE = {Movie: 1, Series: 2, Season: 3, Episode: 4, BoxSet: 18};
const SECTION_COLLECTION = {movie: 'movies', show: 'tvshows'};
const SORT = {
	SortName: 'titleSort', Name: 'titleSort', DateCreated: 'addedAt', PremiereDate: 'originallyAvailableAt',
	ProductionYear: 'year', CommunityRating: 'audienceRating', CriticRating: 'rating', OfficialRating: 'contentRating',
	Random: 'random', DatePlayed: 'lastViewedAt', PlayCount: 'viewCount', Runtime: 'duration',
	DateLastContentAdded: 'episode.addedAt', SeriesDatePlayed: 'lastViewedAt'
};
const CODEC = {dca: 'dts', 'dts-hd ma': 'dts', mpeg4: 'mpeg4', h265: 'hevc', x265: 'hevc'};
const STREAM_TYPE = {1: 'Video', 2: 'Audio', 3: 'Subtitle'};
const MARKER_TYPE = {intro: 'Intro', credits: 'Outro', commercial: 'Commercial'};
const EXTERNAL_SUB_BASE = 10000;

const emptyPage = () => ({Items: [], TotalRecordCount: 0, StartIndex: 0});
const toTicks = (ms) => (ms ? Math.round(ms * TICKS_PER_MS) : 0);
const fromTicks = (ticks) => Math.round((ticks || 0) / TICKS_PER_MS);
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const csv = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const codec = (c) => {
	const k = String(c || '').toLowerCase();
	return CODEC[k] || k;
};
const query = (params) => Object.keys(params)
	.filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
	.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
	.join('&');
const pick = (params, ...names) => {
	for (const n of names) {
		if (params[n] !== undefined && params[n] !== null && params[n] !== '') return params[n];
	}
	return undefined;
};
const randomId = () => `cgf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const providerIds = (m) => {
	const ids = {};
	for (const g of list(m.Guid)) {
		const [scheme, value] = String(g.id || '').split('://');
		if (scheme === 'imdb') ids.Imdb = value;
		if (scheme === 'tmdb') ids.Tmdb = value;
		if (scheme === 'tvdb') ids.Tvdb = value;
	}
	return ids;
};

// O Plex manda o nome padrão da temporada em inglês ("Season 1", "Specials"); o resto do app é em português.
const seasonName = (title, index) => {
	if (/^specials?$/i.test(title || '') || (index === 0 && /^season 0$/i.test(title || ''))) return 'Especiais';
	const m = /^season (\d+)$/i.exec(title || '');
	return m ? `Temporada ${m[1]}` : title;
};

const imagePath = (m, type) => list(m.Image).find((i) => i.type === type)?.url || null;

/**
 * Cria o cliente de um servidor Plex. `userId`/`userName` são da conta plex.tv.
 */
export const createPlexApi = ({serverUrl, token, userId, userName}) => {
	const base = String(serverUrl || '').replace(/\/+$/, '');
	registerPlexServer(base, token);

	const durations = {};
	const parts = {};
	const people = {};
	const itemTypes = {};
	const transcodeSessions = {};
	let sectionsCache = null;
	const genreCache = {};

	const http = async (path, params = {}, {method = 'GET', timeoutMs = TIMEOUT_MS} = {}) => {
		const qs = query(params);
		const url = `${base}${path}${qs ? (path.includes('?') ? '&' : '?') + qs : ''}`;
		const response = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(Object.assign(new Error('Tempo esgotado no servidor Plex'), {status: 0})), timeoutMs);
			fetch(url, {method, headers: plexHeaders(token)}).then((r) => {
				clearTimeout(timer);
				resolve(r);
			}, (e) => {
				clearTimeout(timer);
				reject(e);
			});
		});
		if (!response.ok) throw Object.assign(new Error(`Plex ${response.status}`), {status: response.status});
		const text = await response.text();
		if (!text) return {};
		try {
			return JSON.parse(text).MediaContainer || {};
		} catch (e) {
			return {};
		}
	};

	// ---------- conversão Plex -> formato Jellyfin ----------

	const toStream = (s, externalOrdinal) => {
		const type = STREAM_TYPE[s.streamType];
		const external = !!s.key;
		const stream = {
			Type: type,
			Index: external ? EXTERNAL_SUB_BASE + externalOrdinal : s.index,
			Codec: codec(s.codec),
			Language: s.languageCode || s.languageTag || s.language,
			Title: s.title,
			DisplayTitle: s.extendedDisplayTitle || s.displayTitle || s.language,
			IsDefault: !!s.default || !!s.selected,
			IsForced: !!s.forced,
			IsHearingImpaired: !!s.hearingImpaired,
			IsExternal: external,
			IsTextSubtitleStream: type === 'Subtitle' && !['pgs', 'hdmv_pgs_subtitle', 'dvd_subtitle', 'vobsub', 'dvb_subtitle'].includes(codec(s.codec)),
			Channels: s.channels,
			ChannelLayout: s.audioChannelLayout,
			BitRate: s.bitrate ? s.bitrate * 1000 : undefined,
			SampleRate: s.samplingRate,
			Width: s.width,
			Height: s.height,
			BitDepth: s.bitDepth,
			Profile: s.profile,
			VideoRange: s.colorTrc === 'smpte2084' ? 'HDR' : 'SDR',
			PlexStreamId: s.id
		};
		if (external) {
			stream.DeliveryMethod = 'External';
			stream.DeliveryUrl = `${s.key}?${query({'X-Plex-Token': token})}`;
			stream.IsExternalUrl = false;
		}
		return stream;
	};

	const toMediaSource = (m, media) => {
		const part = list(media.Part)[0] || {};
		let externalOrdinal = 0;
		const streams = list(part.Stream).map((s) => toStream(s, s.key ? externalOrdinal++ : 0));
		const audio = streams.filter((s) => s.Type === 'Audio');
		const subs = streams.filter((s) => s.Type === 'Subtitle');
		const selectedAudio = audio.find((s) => s.IsDefault) || audio[0];
		const selectedSub = list(part.Stream).find((s) => s.streamType === 3 && s.selected);
		parts[m.ratingKey] = parts[m.ratingKey] || {};
		parts[m.ratingKey][String(media.id)] = {partId: part.id, key: part.key};
		return {
			Id: String(media.id),
			Name: media.videoResolution ? `${String(media.videoResolution).toUpperCase()}${/^\d+$/.test(media.videoResolution) ? 'p' : ''}` : m.title,
			Path: part.file,
			Protocol: 'File',
			Type: 'Default',
			Container: String(part.container || media.container || '').toLowerCase(),
			Size: part.size,
			Bitrate: media.bitrate ? media.bitrate * 1000 : undefined,
			RunTimeTicks: toTicks(part.duration || media.duration || m.duration),
			MediaStreams: streams,
			DefaultAudioStreamIndex: selectedAudio ? selectedAudio.Index : undefined,
			DefaultSubtitleStreamIndex: selectedSub ? subs.find((s) => s.PlexStreamId === selectedSub.id)?.Index : -1,
			PlexPartKey: part.key,
			PlexPartId: part.id
		};
	};

	const userData = (m) => {
		const isSeries = m.type === 'show' || m.type === 'season';
		const leaf = m.leafCount || 0;
		const viewed = m.viewedLeafCount || 0;
		const played = isSeries ? leaf > 0 && viewed >= leaf : (m.viewCount || 0) > 0;
		const position = toTicks(m.viewOffset);
		return {
			Played: played,
			PlayCount: m.viewCount || 0,
			PlaybackPositionTicks: position,
			PlayedPercentage: m.viewOffset && m.duration ? (m.viewOffset / m.duration) * 100 : undefined,
			UnplayedItemCount: isSeries ? Math.max(leaf - viewed, 0) : undefined,
			IsFavorite: false,
			LastPlayedDate: m.lastViewedAt ? new Date(m.lastViewedAt * 1000).toISOString() : undefined,
			Key: String(m.ratingKey)
		};
	};

	const toPerson = (r, kind) => {
		const id = `plexperson-${r.id || r.tag}`;
		people[id] = {name: r.tag, thumb: r.thumb || null};
		if (r.thumb) rememberPlexImages(id, {Primary: r.thumb});
		return {Id: id, Name: r.tag, Role: r.role, Type: kind, PrimaryImageTag: r.thumb ? 'p' : undefined};
	};

	const toItem = (m) => {
		if (!m) return null;
		const type = TYPE_TO_JF[m.type] || 'Video';
		const id = String(m.ratingKey);
		itemTypes[id] = type;
		if (m.duration) durations[id] = m.duration;
		const logo = imagePath(m, 'clearLogo');
		rememberPlexImages(id, {Primary: m.thumb, Backdrop: m.art, Thumb: m.art, Logo: logo});
		const item = {
			Id: id,
			ServerId: base,
			Name: m.title,
			OriginalTitle: m.originalTitle,
			SortName: m.titleSort || m.title,
			Type: type,
			MediaType: type === 'Movie' || type === 'Episode' || type === 'Video' ? 'Video' : undefined,
			IsFolder: type === 'Series' || type === 'Season' || type === 'BoxSet' || type === 'Playlist',
			LocationType: 'FileSystem',
			Overview: m.summary,
			Taglines: m.tagline ? [m.tagline] : [],
			ProductionYear: m.year,
			PremiereDate: m.originallyAvailableAt ? `${m.originallyAvailableAt}T00:00:00.0000000Z` : undefined,
			DateCreated: m.addedAt ? new Date(m.addedAt * 1000).toISOString() : undefined,
			OfficialRating: m.contentRating,
			CommunityRating: m.audienceRating || m.rating,
			CriticRating: m.rating ? Math.round(m.rating * 10) : undefined,
			RunTimeTicks: toTicks(m.duration),
			Genres: list(m.Genre).map((g) => g.tag),
			GenreItems: list(m.Genre).map((g) => ({Name: g.tag, Id: `plexgenre-${m.librarySectionID}-${g.id}`})),
			Studios: m.studio ? [{Name: m.studio, Id: m.studio}] : [],
			Tags: list(m.Label).map((l) => l.tag),
			ProviderIds: providerIds(m),
			People: [
				...list(m.Role).map((r) => toPerson(r, 'Actor')),
				...list(m.Director).map((r) => toPerson(r, 'Director')),
				...list(m.Writer).map((r) => toPerson(r, 'Writer'))
			],
			ImageTags: {
				...(m.thumb ? {Primary: 'p'} : {}),
				...(m.art ? {Thumb: 'a'} : {}),
				...(logo ? {Logo: 'l'} : {})
			},
			BackdropImageTags: m.art ? ['a'] : [],
			PrimaryImageAspectRatio: type === 'Episode' ? 16 / 9 : 2 / 3,
			UserData: userData(m),
			ChildCount: m.childCount,
			RecursiveItemCount: m.leafCount,
			ParentId: m.parentRatingKey ? String(m.parentRatingKey) : m.librarySectionID ? `plexlib-${m.librarySectionID}` : undefined,
			PlexLibrarySectionId: m.librarySectionID
		};
		if (type === 'Season') {
			item.Name = seasonName(m.title, m.index);
			item.IndexNumber = m.index;
			item.SeriesId = String(m.parentRatingKey);
			item.SeriesName = m.parentTitle;
			if (m.parentThumb) {
				item.SeriesPrimaryImageTag = 'p';
				rememberPlexImages(item.SeriesId, {Primary: m.parentThumb, Backdrop: m.parentArt || m.art});
			}
			if (m.parentArt || m.art) {
				item.ParentBackdropItemId = item.SeriesId;
				item.ParentBackdropImageTags = ['a'];
			}
		}
		if (type === 'Episode') {
			item.IndexNumber = m.index;
			item.ParentIndexNumber = m.parentIndex;
			item.SeriesId = String(m.grandparentRatingKey);
			item.SeriesName = m.grandparentTitle;
			item.SeasonId = String(m.parentRatingKey);
			item.SeasonName = seasonName(m.parentTitle, m.parentIndex);
			item.PrimaryImageAspectRatio = 16 / 9;
			rememberPlexImages(item.SeriesId, {Primary: m.grandparentThumb, Backdrop: m.grandparentArt});
			if (m.grandparentThumb) item.SeriesPrimaryImageTag = 'p';
			if (m.grandparentArt) {
				item.ParentBackdropItemId = item.SeriesId;
				item.ParentBackdropImageTags = ['a'];
			}
		}
		if (m.Media) {
			item.MediaSources = list(m.Media).map((media) => toMediaSource(m, media));
			item.MediaSourceCount = item.MediaSources.length;
			item.MediaStreams = item.MediaSources[0]?.MediaStreams || [];
			item.Container = item.MediaSources[0]?.Container;
		}
		if (m.Chapter) {
			item.Chapters = list(m.Chapter).map((c) => ({Name: c.tag, StartPositionTicks: toTicks(c.startTimeOffset)}));
		}
		return item;
	};

	const itemsOf = (mc) => list(mc.Metadata).map(toItem).filter(Boolean);
	const page = (mc, start = 0) => {
		const Items = itemsOf(mc);
		return {Items, TotalRecordCount: mc.totalSize !== undefined ? mc.totalSize : Items.length, StartIndex: start};
	};

	// ---------- bibliotecas ----------

	const sections = async () => {
		if (!sectionsCache) {
			const mc = await http('/library/sections');
			sectionsCache = list(mc.Directory).filter((d) => SECTION_COLLECTION[d.type]);
		}
		return sectionsCache;
	};

	const sectionToItem = (d) => ({
		Id: `plexlib-${d.key}`,
		ServerId: base,
		Name: d.title,
		Type: 'CollectionFolder',
		CollectionType: SECTION_COLLECTION[d.type],
		IsFolder: true,
		ImageTags: {},
		BackdropImageTags: [],
		PlexSectionType: d.type
	});

	const sectionOf = (parentId) => String(parentId || '').startsWith('plexlib-') ? String(parentId).slice(8) : null;

	const genreKeys = async (sectionKey, names) => {
		if (!genreCache[sectionKey]) {
			const mc = await http(`/library/sections/${sectionKey}/genre`);
			genreCache[sectionKey] = list(mc.Directory);
		}
		const wanted = names.map((n) => n.toLowerCase());
		return genreCache[sectionKey].filter((g) => wanted.includes(String(g.title).toLowerCase())).map((g) => g.key);
	};

	const plexSort = (p) => {
		const by = csv(pick(p, 'SortBy', 'sortBy'))[0];
		if (!by) return undefined;
		const field = SORT[by];
		if (!field) return undefined;
		if (field === 'random') return 'random';
		const desc = String(pick(p, 'SortOrder', 'sortOrder') || '').startsWith('Desc');
		return `${field}:${desc ? 'desc' : 'asc'}`;
	};

	const filterParams = async (p, sectionKey) => {
		const out = {};
		const filters = csv(pick(p, 'Filters', 'filters'));
		if (filters.includes('IsPlayed') || String(pick(p, 'IsPlayed', 'isPlayed')) === 'true') out.unwatched = 0;
		if (filters.includes('IsUnplayed') || String(pick(p, 'IsPlayed', 'isPlayed')) === 'false') out.unwatched = 1;
		if (filters.includes('IsResumable')) out.inProgress = 1;
		const genreNames = String(pick(p, 'Genres', 'genres') || '').split('|').map((g) => g.trim()).filter(Boolean);
		if (genreNames.length && sectionKey) {
			const keys = await genreKeys(sectionKey, genreNames);
			if (!keys.length) return null;
			out.genre = keys.join(',');
		}
		const genreIds = csv(pick(p, 'GenreIds', 'genreIds')).map((g) => g.split('-').pop());
		if (genreIds.length) out.genre = genreIds.join(',');
		const years = pick(p, 'Years', 'years');
		if (years) out.year = csv(years).join(',');
		const person = csv(pick(p, 'PersonIds', 'personIds'))[0];
		if (person) out.actor = person.replace('plexperson-', '');
		return out;
	};

	const wantsFavorites = (p) => String(pick(p, 'IsFavorite', 'isFavorite')) === 'true' || csv(pick(p, 'Filters', 'filters')).includes('IsFavorite');

	const querySection = async (sectionKey, plexType, p, start, size) => {
		const filters = await filterParams(p, sectionKey);
		if (filters === null) return {Items: [], TotalRecordCount: 0};
		const mc = await http(`/library/sections/${sectionKey}/all`, {
			type: plexType,
			sort: plexSort(p),
			...filters,
			'X-Plex-Container-Start': start,
			'X-Plex-Container-Size': size
		});
		return page(mc, start);
	};

	const typesFor = (p, sectionType) => {
		const asked = csv(pick(p, 'IncludeItemTypes', 'includeItemTypes'));
		const allowed = sectionType === 'movie' ? ['Movie', 'BoxSet'] : ['Series', 'Season', 'Episode', 'BoxSet'];
		const types = asked.filter((t) => allowed.includes(t));
		if (asked.length && !types.length) return [];
		return types.length ? types : [sectionType === 'movie' ? 'Movie' : 'Series'];
	};

	const compareBy = (sort) => {
		if (!sort || sort === 'random') return null;
		const [field, dir] = sort.split(':');
		const key = {titleSort: 'SortName', addedAt: 'DateCreated', originallyAvailableAt: 'PremiereDate', year: 'ProductionYear',
			audienceRating: 'CommunityRating', rating: 'CriticRating', lastViewedAt: 'UserData.LastPlayedDate', viewCount: 'UserData.PlayCount',
			duration: 'RunTimeTicks', 'episode.addedAt': 'DateCreated', contentRating: 'OfficialRating'}[field];
		const get = (it) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), it);
		return (a, b) => {
			const x = get(a);
			const y = get(b);
			if (x === y) return 0;
			if (x === undefined || x === null) return 1;
			if (y === undefined || y === null) return -1;
			const r = x > y ? 1 : -1;
			return dir === 'desc' ? -r : r;
		};
	};

	const childrenOf = async (parentId, p, start, size) => {
		const type = itemTypes[parentId] || TYPE_TO_JF[list((await http(`/library/metadata/${parentId}`)).Metadata)[0]?.type];
		const asked = csv(pick(p, 'IncludeItemTypes', 'includeItemTypes'));
		let path = `/library/metadata/${parentId}/children`;
		if (type === 'BoxSet') path = `/library/collections/${parentId}/children`;
		if (type === 'Playlist') path = `/playlists/${parentId}/items`;
		if (type === 'Series' && asked.includes('Episode')) path = `/library/metadata/${parentId}/allLeaves`;
		const mc = await http(path, {'X-Plex-Container-Start': start, 'X-Plex-Container-Size': size});
		const result = page(mc, start);
		if (asked.length) result.Items = result.Items.filter((i) => asked.includes(i.Type));
		return result;
	};

	// ---------- busca e pessoas ----------

	const search = async (term, limit = 60) => {
		const mc = await http('/hubs/search', {query: term, limit: Math.min(limit, 30), includeCollections: 1});
		const Items = [];
		for (const hub of list(mc.Hub)) {
			if (['movie', 'show', 'episode', 'season', 'collection'].includes(hub.type)) {
				Items.push(...list(hub.Metadata).map(toItem).filter(Boolean));
			}
		}
		return {Items: Items.slice(0, limit), TotalRecordCount: Items.length, StartIndex: 0};
	};

	const getItems = async (p = {}) => {
		const start = Number(pick(p, 'StartIndex', 'startIndex') || 0);
		const size = Number(pick(p, 'Limit', 'limit') || 100);
		if (wantsFavorites(p)) return emptyPage();
		const ids = csv(pick(p, 'Ids', 'ids')).filter((i) => /^\d+$/.test(i));
		if (ids.length) {
			const mc = await http(`/library/metadata/${ids.join(',')}`);
			const byId = {};
			for (const it of itemsOf(mc)) byId[it.Id] = it;
			const Items = ids.map((i) => byId[i]).filter(Boolean);
			return {Items, TotalRecordCount: Items.length, StartIndex: 0};
		}
		const term = pick(p, 'SearchTerm', 'searchTerm', 'NameStartsWith');
		if (term) return search(term, size);
		const parentId = pick(p, 'ParentId', 'parentId');
		if (parentId && !sectionOf(parentId)) return childrenOf(String(parentId), p, start, size);

		const all = await sections();
		const targets = sectionOf(parentId) ? all.filter((d) => d.key === sectionOf(parentId)) : all;
		const jobs = [];
		for (const d of targets) {
			for (const t of typesFor(p, d.type)) {
				if (t === 'BoxSet') {
					jobs.push(http(`/library/sections/${d.key}/collections`, {'X-Plex-Container-Start': start, 'X-Plex-Container-Size': size}).then((mc) => page(mc, start)));
				} else {
					jobs.push(querySection(d.key, JF_TO_PLEX_TYPE[t], p, targets.length === 1 ? start : 0, targets.length === 1 ? size : start + size));
				}
			}
		}
		const results = await Promise.all(jobs.map((j) => j.catch(() => emptyPage())));
		if (results.length === 1) return results[0];
		const merged = [].concat(...results.map((r) => r.Items));
		const cmp = compareBy(plexSort(p));
		if (cmp) merged.sort(cmp);
		const total = results.reduce((n, r) => n + (r.TotalRecordCount || 0), 0);
		return {Items: merged.slice(start, start + size), TotalRecordCount: total, StartIndex: start};
	};

	const searchPeople = async (term, limit = 24) => {
		const mc = await http('/hubs/search', {query: term, limit: Math.min(limit, 30)});
		const Items = [];
		for (const hub of list(mc.Hub)) {
			if (hub.type === 'actor' || hub.type === 'director') {
				for (const d of list(hub.Directory)) Items.push({...toPerson(d, 'Person'), Type: 'Person', ImageTags: d.thumb ? {Primary: 'p'} : {}});
			}
		}
		return {Items: Items.slice(0, limit), TotalRecordCount: Items.length};
	};

	const getItemsByPerson = async (personId, limit = 100) => {
		const tag = String(personId).replace('plexperson-', '');
		const all = await sections();
		const results = await Promise.all(all.map((d) => http(`/library/sections/${d.key}/all`, {
			type: d.type === 'movie' ? 1 : 2, actor: tag, sort: 'originallyAvailableAt:desc', 'X-Plex-Container-Size': limit
		}).then((mc) => itemsOf(mc)).catch(() => [])));
		const Items = [].concat(...results).sort(compareBy('originallyAvailableAt:desc')).slice(0, limit);
		return {Items, TotalRecordCount: Items.length, StartIndex: 0};
	};

	// ---------- itens ----------

	const getItem = async (itemId) => {
		const section = sectionOf(itemId);
		if (section) {
			const d = (await sections()).find((s) => s.key === section);
			if (!d) throw Object.assign(new Error('Biblioteca não encontrada'), {status: 404});
			return sectionToItem(d);
		}
		if (String(itemId).startsWith('plexperson-')) {
			const person = people[itemId] || {};
			return {Id: itemId, Name: person.name || '', Type: 'Person', ImageTags: person.thumb ? {Primary: 'p'} : {}, ServerId: base};
		}
		const mc = await http(`/library/metadata/${itemId}`, {includeChapters: 1, includeMarkers: 1});
		const item = toItem(list(mc.Metadata)[0]);
		if (!item) throw Object.assign(new Error('Item não encontrado'), {status: 404});
		return item;
	};

	const onDeck = async () => {
		try {
			const mc = await http('/hubs/continueWatching/items', {count: 50});
			return itemsOf(mc);
		} catch (e) {
			return itemsOf(await http('/library/onDeck'));
		}
	};

	const getResumeItems = async (limit = 12) => {
		const Items = (await onDeck()).filter((i) => i.UserData.PlaybackPositionTicks > 0).slice(0, limit);
		return {Items, TotalRecordCount: Items.length};
	};

	const getNextUp = async (limit = 24, seriesId = null) => {
		if (seriesId) {
			const leaves = itemsOf(await http(`/library/metadata/${seriesId}/allLeaves`));
			let lastPlayed = -1;
			leaves.forEach((e, i) => {
				if (e.UserData.Played) lastPlayed = i;
			});
			const next = leaves.slice(lastPlayed + 1).find((e) => !e.UserData.Played);
			return {Items: next ? [next] : [], TotalRecordCount: next ? 1 : 0};
		}
		const Items = (await onDeck()).filter((i) => i.Type === 'Episode' && !i.UserData.PlaybackPositionTicks).slice(0, limit);
		return {Items, TotalRecordCount: Items.length};
	};

	const latest = async (libraryId, limit = 20) => {
		const section = sectionOf(libraryId);
		const d = (await sections()).find((s) => s.key === section);
		if (!d) return [];
		const mc = await http(`/library/sections/${section}/all`, {
			type: d.type === 'movie' ? 1 : 2, sort: d.type === 'movie' ? 'addedAt:desc' : 'episode.addedAt:desc', 'X-Plex-Container-Size': limit
		});
		return itemsOf(mc);
	};

	const setWatched = async (itemId, watched) => {
		await http(watched ? '/:/scrobble' : '/:/unscrobble', {key: itemId, identifier: 'com.plexapp.plugins.library'});
		return {Played: !!watched, PlaybackPositionTicks: 0, Key: String(itemId)};
	};

	// ---------- reprodução ----------

	const profileAllows = (profile, source) => {
		const video = source.MediaStreams.find((s) => s.Type === 'Video');
		const audio = source.MediaStreams.find((s) => s.Type === 'Audio' && s.IsDefault) || source.MediaStreams.find((s) => s.Type === 'Audio');
		return list(profile?.DirectPlayProfiles).some((dp) => {
			if (dp.Type && dp.Type !== 'Video') return false;
			const containers = csv(dp.Container).map((c) => c.toLowerCase());
			const vcodecs = csv(dp.VideoCodec).map((c) => c.toLowerCase());
			const acodecs = csv(dp.AudioCodec).map((c) => c.toLowerCase());
			const containerOk = !containers.length || containers.includes(source.Container) ||
				(source.Container === 'mkv' && containers.includes('matroska'));
			const videoOk = !video || !vcodecs.length || vcodecs.includes(video.Codec);
			const audioOk = !audio || !acodecs.length || acodecs.includes(audio.Codec);
			return containerOk && videoOk && audioOk;
		});
	};

	const selectStreams = async (source, audioIndex, subtitleIndex) => {
		const params = {allParts: 1};
		const audio = source.MediaStreams.find((s) => s.Type === 'Audio' && s.Index === audioIndex);
		if (audio) params.audioStreamID = audio.PlexStreamId;
		if (subtitleIndex !== undefined && subtitleIndex !== null) {
			const sub = source.MediaStreams.find((s) => s.Type === 'Subtitle' && s.Index === subtitleIndex);
			params.subtitleStreamID = sub ? sub.PlexStreamId : 0;
		}
		if (params.audioStreamID || params.subtitleStreamID !== undefined) {
			await http(`/library/parts/${source.PlexPartId}`, params, {method: 'PUT'}).catch(() => null);
		}
	};

	const transcodeUrl = (itemId, mediaIndex, session, body, burnSubtitles) => {
		const maxKbps = body.MaxStreamingBitrate ? Math.round(body.MaxStreamingBitrate / 1000) : 20000;
		return `/video/:/transcode/universal/start.m3u8?${query({
			hasMDE: 1,
			path: `/library/metadata/${itemId}`,
			mediaIndex,
			partIndex: 0,
			protocol: 'hls',
			fastSeek: 1,
			directPlay: 0,
			directStream: 1,
			directStreamAudio: 1,
			videoQuality: 100,
			maxVideoBitrate: maxKbps,
			videoResolution: '1920x1080',
			subtitleSize: 100,
			audioBoost: 100,
			subtitles: burnSubtitles ? 'burn' : 'none',
			location: 'wan',
			session,
			'X-Plex-Session-Identifier': session,
			'X-Plex-Client-Identifier': plexHeaders()['X-Plex-Client-Identifier'],
			'X-Plex-Product': plexHeaders()['X-Plex-Product'],
			'X-Plex-Platform': 'Chrome',
			'X-Plex-Client-Profile-Extra': 'add-transcode-target(type=videoProfile&context=streaming&protocol=hls&container=mpegts&videoCodec=h264,hevc&audioCodec=aac,ac3,eac3)',
			'X-Plex-Token': token
		})}`;
	};

	const getPlaybackInfo = async (itemId, body = {}) => {
		const mc = await http(`/library/metadata/${itemId}`, {includeChapters: 1, includeMarkers: 1});
		const meta = list(mc.Metadata)[0];
		if (!meta) throw Object.assign(new Error('Item não encontrado'), {status: 404});
		const item = toItem(meta);
		const session = randomId();
		const wanted = body.MediaSourceId ? String(body.MediaSourceId) : null;
		const sources = (item.MediaSources || []).filter((s) => !wanted || s.Id === wanted);
		const MediaSources = [];
		for (let i = 0; i < sources.length; i++) {
			const source = sources[i];
			const mediaIndex = (item.MediaSources || []).indexOf(source);
			const direct = body.EnableDirectPlay !== false && profileAllows(body.DeviceProfile, source);
			if (direct) {
				MediaSources.push({...source, SupportsDirectPlay: true, SupportsDirectStream: false, SupportsTranscoding: false});
				continue;
			}
			if (body.EnableTranscoding === false) continue;
			await selectStreams(source, body.AudioStreamIndex, body.SubtitleStreamIndex);
			// O HLS do Plex não leva faixa de legenda: legenda embutida escolhida é queimada no vídeo; a externa
			// continua vindo por URL (o app desenha).
			const sub = source.MediaStreams.find((s) => s.Type === 'Subtitle' && s.Index === body.SubtitleStreamIndex);
			const burn = !!sub && !sub.IsExternal;
			transcodeSessions[session] = true;
			MediaSources.push({
				...source,
				SupportsDirectPlay: false,
				SupportsDirectStream: false,
				SupportsTranscoding: true,
				TranscodingUrl: transcodeUrl(itemId, mediaIndex, session, body, burn),
				TranscodingSubProtocol: 'hls',
				TranscodingContainer: 'ts',
				MediaStreams: source.MediaStreams.map((s) => (s.Type === 'Subtitle' && !s.IsExternal ? {...s, DeliveryMethod: 'Encode'} : s))
			});
		}
		return {MediaSources, PlaySessionId: session};
	};

	const timeline = (data, state) => {
		const id = String(data.ItemId);
		const duration = durations[id] || 0;
		return http('/:/timeline', {
			ratingKey: id,
			key: `/library/metadata/${id}`,
			state,
			time: fromTicks(data.PositionTicks),
			duration,
			playbackTime: fromTicks(data.PositionTicks),
			'X-Plex-Session-Identifier': data.PlaySessionId
		}).catch(() => null);
	};

	const reportPlaybackStopped = async (data) => {
		await timeline(data, 'stopped');
		if (data.PlaySessionId && transcodeSessions[data.PlaySessionId]) {
			delete transcodeSessions[data.PlaySessionId];
			await http('/video/:/transcode/universal/stop', {session: data.PlaySessionId}).catch(() => null);
		}
		return {};
	};

	const getMediaSegments = async (itemId) => {
		const mc = await http(`/library/metadata/${itemId}`, {includeMarkers: 1});
		const meta = list(mc.Metadata)[0] || {};
		const Items = list(meta.Marker)
			.filter((mk) => MARKER_TYPE[mk.type])
			.map((mk) => ({Id: String(mk.id), ItemId: String(itemId), Type: MARKER_TYPE[mk.type], StartTicks: toTicks(mk.startTimeOffset), EndTicks: toTicks(mk.endTimeOffset)}));
		return {Items, TotalRecordCount: Items.length};
	};

	const getAncestors = async (itemId) => {
		const mc = await http(`/library/metadata/${itemId}`);
		const m = list(mc.Metadata)[0] || {};
		const out = [];
		if (m.type === 'episode') {
			out.push({Id: String(m.parentRatingKey), Name: m.parentTitle, Type: 'Season'});
			out.push({Id: String(m.grandparentRatingKey), Name: m.grandparentTitle, Type: 'Series'});
		} else if (m.type === 'season') {
			out.push({Id: String(m.parentRatingKey), Name: m.parentTitle, Type: 'Series'});
		}
		if (m.librarySectionID) out.push({Id: `plexlib-${m.librarySectionID}`, Name: m.librarySectionTitle, Type: 'CollectionFolder'});
		return out;
	};

	const genres = async (libraryId) => {
		const targets = sectionOf(libraryId) ? [sectionOf(libraryId)] : (await sections()).map((d) => d.key);
		const seen = {};
		const Items = [];
		for (const key of targets) {
			const mc = await http(`/library/sections/${key}/genre`).catch(() => ({}));
			genreCache[key] = list(mc.Directory);
			for (const g of genreCache[key]) {
				if (seen[g.title]) continue;
				seen[g.title] = true;
				Items.push({Id: `plexgenre-${key}-${g.key}`, Name: g.title, Type: 'Genre'});
			}
		}
		Items.sort((a, b) => a.Name.localeCompare(b.Name));
		return {Items, TotalRecordCount: Items.length};
	};

	const randomItems = async (contentType = 'both', limit = 10, parentId = null, genreName = null) => {
		const types = contentType === 'movies' ? 'Movie' : contentType === 'tv' || contentType === 'series' ? 'Series' : 'Movie,Series';
		return getItems({IncludeItemTypes: types, ParentId: parentId, Genres: genreName, SortBy: 'Random', Limit: limit, Recursive: true});
	};

	const account = {Id: String(userId || 'plex'), Name: userName || 'Plex', ServerId: base, HasPassword: true};

	const api = {
		getPublicInfo: async () => {
			const mc = await http('/identity');
			return {Id: mc.machineIdentifier, ServerName: 'Plex', Version: mc.version, ProductName: 'Plex Media Server'};
		},
		getPublicUsers: async () => [],
		getLibraries: async () => ({Items: (await sections()).map(sectionToItem)}),
		getAllLibraries: async () => ({Items: (await sections()).map(sectionToItem)}),
		getVirtualFolders: async () => (await sections()).map((d) => ({Name: d.title, ItemId: `plexlib-${d.key}`, CollectionType: SECTION_COLLECTION[d.type]})),
		getItems,
		getItem,
		getItemForDetail: getItem,
		getItemWithChapters: getItem,
		getItemMediaInfo: getItem,
		getAdjacentEpisodes: getItem,
		getMediaStreams: getItem,
		getUserConfiguration: async () => ({
			...account,
			Configuration: {
				AudioLanguagePreference: 'por', SubtitleLanguagePreference: 'por', SubtitleMode: 'Default', PlayDefaultAudioTrack: true,
				EnableNextEpisodeAutoPlay: true, RememberAudioSelections: true, RememberSubtitleSelections: true, HidePlayedInLatest: true,
				OrderedViews: [], MyMediaExcludes: [], LatestItemsExcludes: [], GroupedFolders: []
			},
			Policy: {IsAdministrator: false, EnableContentDeletion: false, EnableVideoPlaybackTranscoding: true, EnablePlaybackRemuxing: true, EnableLiveTvAccess: false}
		}),
		updateUserConfiguration: async () => ({}),
		getLatest: latest,
		getRecentlyReleased: async (libraryId, limit = 20, includeItemTypes = 'Movie,Series') =>
			getItems({ParentId: libraryId, IncludeItemTypes: includeItemTypes, SortBy: 'PremiereDate', SortOrder: 'Descending', Limit: limit, Recursive: true}),
		getCollections: async (limit = 50) => getItems({IncludeItemTypes: 'BoxSet', Limit: limit, Recursive: true}),
		getCollectionItems: async (collectionId, limit = 50) => childrenOf(String(collectionId), {}, 0, limit),
		getItemCollections: async () => ({Items: []}),
		getResumeItems,
		getResumeAudioItems: async () => emptyPage(),
		getNextUp,
		getSeasons: async (seriesId) => childrenOf(String(seriesId), {IncludeItemTypes: 'Season'}, 0, 500),
		getEpisodes: async (seriesId, seasonId = null) => (seasonId
			? childrenOf(String(seasonId), {}, 0, 2000)
			: childrenOf(String(seriesId), {IncludeItemTypes: 'Episode'}, 0, 5000)),
		getSimilar: async (itemId, limit = 15) => {
			const mc = await http(`/library/metadata/${itemId}/similar`, {count: limit}).catch(() => ({}));
			const Items = itemsOf(mc).slice(0, limit);
			return {Items, TotalRecordCount: Items.length};
		},
		getMoonfinSimilar: async (itemId, limit = 20) => api.getSimilar(itemId, limit),
		search,
		searchPeople,
		getPerson: getItem,
		getItemsByPerson,
		getGenres: genres,
		getItemsByGenre: async (genreId, libraryId, limit = 50) => getItems({ParentId: libraryId, GenreIds: genreId, Limit: limit, Recursive: true, IncludeItemTypes: 'Movie,Series'}),
		getQueryFilters: async (parentId) => ({Genres: (await genres(parentId)).Items.map((g) => g.Name), Years: [], Tags: [], OfficialRatings: []}),
		getRandomItems: randomItems,
		getRandomItem: async (includeTypes = 'Movie,Series') => getItems({IncludeItemTypes: includeTypes, SortBy: 'Random', Limit: 1, Recursive: true}),
		getPreviewItems: async (limit = 10) => getItems({IncludeItemTypes: 'Movie,Series', SortBy: 'Random', Limit: limit, Recursive: true}),
		getFavorites: async () => emptyPage(),
		setFavorite: async () => {
			throw Object.assign(new Error('Favoritos ainda não estão disponíveis em servidores Plex'), {status: 501, reason: 'plexNoFavorites'});
		},
		setWatched,
		getAncestors,
		getMediaSegments,
		getPlaybackInfo,
		reportPlaybackStart: (data) => timeline(data, 'playing'),
		reportPlaybackProgress: (data) => timeline(data, data.IsPaused ? 'paused' : 'playing'),
		reportPlaybackStopped,
		getPlaylists: async () => {
			const mc = await http('/playlists', {playlistType: 'video'});
			return page(mc);
		},
		getPlaylistItems: async (playlistId, limit = 300, startIndex = 0) => childrenOf(String(playlistId), {}, startIndex, limit),
		getLocalTrailers: async () => [],
		getSpecialFeatures: async () => [],
		getIntros: async () => emptyPage(),
		getThemeSongs: async () => emptyPage(),
		getAdditionalParts: async () => emptyPage(),
		getStudios: async () => emptyPage(),
		getLyrics: async () => null,
		getServerInfo: () => ({serverUrl: base, accessToken: token, userId: account.Id, serverType: 'plex'})
	};

	return api;
};

/** Métodos do contrato que não existem no Plex: respondem vazio, nunca com rota do Jellyfin. */
export const plexUnsupported = (name) => () => {
	if (/^(get|search)/.test(name)) return Promise.resolve(emptyPage());
	return Promise.reject(Object.assign(new Error(`${name} não existe em servidores Plex`), {status: 501}));
};
