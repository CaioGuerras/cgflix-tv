/* global Buffer */
// Teste ao vivo contra um Plex real. Só roda com PLEX_URL e PLEX_TOKEN no ambiente; nunca imprime o token.
import {createPlexApi} from './plexApi';
import {plexImageUrl} from './plexImages';

const URL_ = process.env.PLEX_URL;
const TOKEN = process.env.PLEX_TOKEN;
const live = URL_ && TOKEN ? describe : describe.skip;

// fetch mínimo sobre o http do Node (o ambiente jsdom do teste não tem fetch)
const nodeFetch = (url, options = {}) => new Promise((resolve, reject) => {
	const lib = url.startsWith('https') ? require('https') : require('http');
	const req = lib.request(url, {method: options.method || 'GET', headers: options.headers || {}}, (res) => {
		const chunks = [];
		res.on('data', (c) => chunks.push(c));
		res.on('end', () => {
			const body = Buffer.concat(chunks).toString('utf8');
			resolve({ok: res.statusCode < 400, status: res.statusCode, headers: {get: (h) => res.headers[h.toLowerCase()]},
				text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body))});
		});
	});
	req.on('error', reject);
	req.end();
});
global.fetch = nodeFetch;
const TV = {DirectPlayProfiles: [{Type: 'Video', Container: 'mkv,mp4,m4v,mov,ts,webm', VideoCodec: 'h264,hevc,vp9,av1,mpeg4', AudioCodec: 'aac,ac3,eac3,mp3,opus,flac,vorbis,dts'}]};

live('Plex ao vivo', () => {
	jest.setTimeout(60000);
	const api = createPlexApi({serverUrl: URL_, token: TOKEN, userId: 'teste'});
	const report = {};
	afterAll(() => {
		// eslint-disable-next-line no-console
		console.log(JSON.stringify(report, null, 1));
	});

	test('fluxo completo', async () => {
		const info = await api.getPublicInfo();
		report.servidor = info.ProductName + ' ' + info.Version;
		const {Items: libs} = await api.getLibraries();
		report.bibliotecas = libs.map((l) => `${l.Name} (${l.CollectionType})`);
		expect(libs.length).toBeGreaterThan(0);

		const movies = libs.find((l) => l.CollectionType === 'movies');
		const shows = libs.find((l) => l.CollectionType === 'tvshows');
		expect(movies).toBeTruthy();
		expect(shows).toBeTruthy();
		{
			const page = await api.getItems({ParentId: movies.Id, IncludeItemTypes: 'Movie', Recursive: true, SortBy: 'DateCreated', SortOrder: 'Descending', Limit: 5});
			report.filmes = {total: page.TotalRecordCount, primeiros: page.Items.map((i) => `${i.Name} (${i.ProductionYear})`)};
			expect(page.Items.length).toBeGreaterThan(0);
			const movie = await api.getItemForDetail(page.Items[0].Id);
			report.ficha = {nome: movie.Name, generos: movie.Genres, elenco: movie.People.slice(0, 3).map((p) => p.Name), ids: movie.ProviderIds,
				fontes: (movie.MediaSources || []).map((s) => `${s.Container} ${s.MediaStreams.filter((x) => x.Type === 'Audio').map((x) => x.Codec + ':' + x.Language).join('/')}`)};
			const play = await api.getPlaybackInfo(movie.Id, {DeviceProfile: TV});
			const src = play.MediaSources[0];
			report.play = {direto: src.SupportsDirectPlay, container: src.Container, parte: !!src.PlexPartKey};
			const fileUrl = `${URL_}${src.PlexPartKey}?X-Plex-Token=${TOKEN}`;
			const head = await fetch(fileUrl, {headers: {Range: 'bytes=0-1023'}});
			report.play.arquivo = `${head.status} ${head.headers.get('content-type')}`;
			expect([200, 206]).toContain(head.status);
			const hls = await api.getPlaybackInfo(movie.Id, {DeviceProfile: {DirectPlayProfiles: []}});
			const m3u8 = await fetch(`${URL_}${hls.MediaSources[0].TranscodingUrl}`);
			report.play.hls = `${m3u8.status} ${(await m3u8.text()).slice(0, 7)}`;
			await api.reportPlaybackStopped({ItemId: movie.Id, PlaySessionId: hls.PlaySessionId, PositionTicks: 0});
			const img = await fetch(plexImageUrl(URL_, movie.Id, 'Primary', {maxWidth: 300}));
			report.imagem = `${img.status} ${img.headers.get('content-type')}`;
			expect(img.status).toBe(200);
		}
		{
			const page = await api.getItems({ParentId: shows.Id, IncludeItemTypes: 'Series', Recursive: true, SortBy: 'SortName', Limit: 3});
			const series = page.Items[0];
			const seasons = await api.getSeasons(series.Id);
			const episodes = await api.getEpisodes(series.Id, seasons.Items[0]?.Id);
			const segs = await api.getMediaSegments(episodes.Items[0].Id);
			report.series = {total: page.TotalRecordCount, serie: series.Name, temporadas: seasons.Items.length, eps_t1: episodes.Items.length,
				ep1: `${episodes.Items[0].SeriesName} T${episodes.Items[0].ParentIndexNumber}E${episodes.Items[0].IndexNumber}`, marcadores: segs.Items.map((s) => s.Type)};
			expect(seasons.Items.length).toBeGreaterThan(0);
		}
		const term = (report.filmes?.primeiros?.[0] || 'a').split(' ')[0];
		const found = await api.search(term, 10);
		report.busca = {termo: term, achados: found.Items.length};
		const resume = await api.getResumeItems(5);
		const next = await api.getNextUp(5);
		report.continuar = resume.Items.length;
		report.proximos = next.Items.length;
		const genres = await api.getGenres(null);
		report.generos = genres.Items.length;
		const all = await api.getItems({IncludeItemTypes: 'Movie,Series', Recursive: true, SortBy: 'DateCreated', SortOrder: 'Descending', Limit: 10});
		report.recentes_todas = all.Items.map((i) => i.Type[0] + ':' + i.Name).slice(0, 5);
	});
});
