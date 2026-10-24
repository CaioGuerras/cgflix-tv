import {createPlexApi} from './plexApi';
import {plexImageUrl, isPlexServerUrl, resetPlexImagesForTests} from './plexImages';
import {parseSubtitleText} from '../utils/subtitleText';

const SERVER = 'https://plex.example:32400';

const episode = {
	ratingKey: '501', type: 'episode', title: 'Piloto', index: 1, parentIndex: 1,
	parentRatingKey: '500', parentTitle: 'Season 1', grandparentRatingKey: '400', grandparentTitle: 'Série',
	grandparentThumb: '/library/metadata/400/thumb/1', grandparentArt: '/library/metadata/400/art/1',
	thumb: '/library/metadata/501/thumb/1', duration: 1500000, viewOffset: 300000, librarySectionID: 2,
	Guid: [{id: 'tmdb://123'}, {id: 'imdb://tt1'}],
	Role: [{id: 77, tag: 'Atriz', role: 'Ela', thumb: 'https://metadata-static.plex.tv/p.jpg'}],
	Marker: [{id: 9, type: 'intro', startTimeOffset: 1000, endTimeOffset: 61000}],
	Media: [{id: 601, container: 'mkv', videoResolution: '1080', Part: [{id: 701, key: '/library/parts/701/1/file.mkv', container: 'mkv', duration: 1500000,
		Stream: [
			{id: 1, streamType: 1, index: 0, codec: 'hevc'},
			{id: 2, streamType: 2, index: 1, codec: 'eac3', languageCode: 'por', default: true, channels: 6},
			{id: 3, streamType: 2, index: 2, codec: 'aac', languageCode: 'jpn'},
			{id: 4, streamType: 3, index: 3, codec: 'ass', languageCode: 'por'},
			{id: 5, streamType: 3, codec: 'srt', languageCode: 'por', key: '/library/streams/5'}
		]}]}]
};

const respond = (body) => Promise.resolve({ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({MediaContainer: body}))});

describe('plexApi', () => {
	let calls;
	beforeEach(() => {
		resetPlexImagesForTests();
		calls = [];
		global.fetch = jest.fn((url) => {
			calls.push(url);
			if (url.includes('/library/metadata/501')) return respond({Metadata: [episode]});
			if (url.includes('/library/sections')) return respond({Directory: [{key: '1', title: 'Filmes', type: 'movie'}, {key: '2', title: 'Séries', type: 'show'}, {key: '3', title: 'Fotos', type: 'photo'}]});
			return respond({});
		});
	});

	test('converte episódio para o formato do Jellyfin', async () => {
		const api = createPlexApi({serverUrl: SERVER, token: 'tok', userId: '1'});
		const item = await api.getItem('501');
		expect(item).toMatchObject({Id: '501', Type: 'Episode', SeriesId: '400', SeasonId: '500', IndexNumber: 1, ParentIndexNumber: 1,
			ProviderIds: {Tmdb: '123', Imdb: 'tt1'}, RunTimeTicks: 15000000000});
		expect(item.UserData.PlaybackPositionTicks).toBe(3000000000);
		expect(item.SeasonName).toBe('Temporada 1');
		expect(item.People[0]).toMatchObject({Id: 'plexperson-77', Name: 'Atriz', Type: 'Actor'});
		const audio = item.MediaSources[0].MediaStreams.filter((s) => s.Type === 'Audio');
		expect(audio.map((s) => s.Codec)).toEqual(['eac3', 'aac']);
		const external = item.MediaSources[0].MediaStreams.find((s) => s.IsExternal);
		expect(external.DeliveryUrl).toBe('/library/streams/5?X-Plex-Token=tok');
	});

	test('bibliotecas só de filmes e séries, com id próprio', async () => {
		const api = createPlexApi({serverUrl: SERVER, token: 'tok'});
		const {Items} = await api.getLibraries();
		expect(Items.map((l) => [l.Id, l.CollectionType])).toEqual([['plexlib-1', 'movies'], ['plexlib-2', 'tvshows']]);
	});

	test('getItems de uma biblioteca traduz tipo, ordem, filtro e página', async () => {
		const api = createPlexApi({serverUrl: SERVER, token: 'tok'});
		await api.getItems({ParentId: 'plexlib-1', IncludeItemTypes: 'Movie', SortBy: 'DateCreated', SortOrder: 'Descending', Filters: 'IsUnplayed', StartIndex: 40, Limit: 20});
		const url = calls.find((u) => u.includes('/library/sections/1/all'));
		expect(url).toContain('type=1');
		expect(url).toContain('sort=addedAt%3Adesc');
		expect(url).toContain('unwatched=1');
		expect(url).toContain('X-Plex-Container-Start=40');
		expect(url).toContain('X-Plex-Container-Size=20');
	});

	test('play direto quando o perfil da TV aceita, conversão HLS quando não', async () => {
		const api = createPlexApi({serverUrl: SERVER, token: 'tok'});
		const yes = {DirectPlayProfiles: [{Type: 'Video', Container: 'mkv,mp4', VideoCodec: 'h264,hevc', AudioCodec: 'aac,ac3,eac3'}]};
		const direct = await api.getPlaybackInfo('501', {DeviceProfile: yes});
		expect(direct.MediaSources[0]).toMatchObject({SupportsDirectPlay: true, SupportsTranscoding: false, PlexPartKey: '/library/parts/701/1/file.mkv'});
		const no = {DirectPlayProfiles: [{Type: 'Video', Container: 'mp4', VideoCodec: 'h264', AudioCodec: 'aac'}]};
		const hls = await api.getPlaybackInfo('501', {DeviceProfile: no, SubtitleStreamIndex: 3});
		const source = hls.MediaSources[0];
		expect(source.SupportsDirectPlay).toBe(false);
		expect(source.TranscodingSubProtocol).toBe('hls');
		expect(source.TranscodingUrl).toContain('/video/:/transcode/universal/start.m3u8?');
		expect(source.TranscodingUrl).toContain('subtitles=burn');
		expect(source.MediaStreams.find((s) => s.Index === 3).DeliveryMethod).toBe('Encode');
	});

	test('marcadores de abertura viram segmentos', async () => {
		const api = createPlexApi({serverUrl: SERVER, token: 'tok'});
		const {Items} = await api.getMediaSegments('501');
		expect(Items[0]).toMatchObject({Type: 'Intro', StartTicks: 10000000, EndTicks: 610000000});
	});

	test('favoritos não existem no Plex', async () => {
		const api = createPlexApi({serverUrl: SERVER, token: 'tok'});
		expect((await api.getItems({IsFavorite: true})).Items).toEqual([]);
		await expect(api.setFavorite('501', true)).rejects.toMatchObject({status: 501});
	});

	test('imagens vão pelo transcodificador de fotos do Plex', async () => {
		const api = createPlexApi({serverUrl: SERVER, token: 'tok'});
		await api.getItem('501');
		expect(isPlexServerUrl(SERVER)).toBe(true);
		const url = plexImageUrl(SERVER, '501', 'Primary', {maxWidth: 300});
		expect(url).toContain(`${SERVER}/photo/:/transcode?`);
		expect(url).toContain('url=%2Flibrary%2Fmetadata%2F501%2Fthumb%2F1');
		expect(url).toContain('X-Plex-Token=tok');
		expect(plexImageUrl(SERVER, 'plexperson-77', 'Primary')).toBe('https://metadata-static.plex.tv/p.jpg');
		expect(plexImageUrl(SERVER, '400', 'Backdrop')).toContain('url=%2Flibrary%2Fmetadata%2F400%2Fart%2F1');
	});
});

describe('parseSubtitleText', () => {
	test('SRT', () => {
		const {TrackEvents} = parseSubtitleText('﻿1\n00:00:01,500 --> 00:00:03,000\n<i>Olá</i>\nmundo\n\n2\n00:01:00,000 --> 00:01:02,250\nTchau\n');
		expect(TrackEvents).toEqual([
			{Id: '0', StartPositionTicks: 15000000, EndPositionTicks: 30000000, Text: '<i>Olá</i>\nmundo'},
			{Id: '1', StartPositionTicks: 600000000, EndPositionTicks: 622500000, Text: 'Tchau'}
		]);
	});

	test('WebVTT', () => {
		const {TrackEvents} = parseSubtitleText('WEBVTT\n\n00:01.000 --> 00:02.500 line:90%\nOi\n');
		expect(TrackEvents).toEqual([{Id: '0', StartPositionTicks: 10000000, EndPositionTicks: 25000000, Text: 'Oi'}]);
	});

	test('ASS sem estilos, com vírgula no texto', () => {
		const ass = '[Script Info]\nTitle: x\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' +
			'Dialogue: 0,0:00:05.10,0:00:07.00,Default,,0,0,0,,{\\i1}Olá,{\\i0} tudo\\Nbem?\n';
		const {TrackEvents} = parseSubtitleText(ass);
		expect(TrackEvents).toEqual([{Id: '0', StartPositionTicks: 51000000, EndPositionTicks: 70000000, Text: 'Olá, tudo\nbem?'}]);
	});
});
