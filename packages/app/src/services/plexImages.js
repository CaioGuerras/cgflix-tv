// CGFLIX: imagens dos servidores Plex.
//
// As telas montam imagem com getImageUrl(servidor, id, tipo), no formato do Jellyfin
// (/Items/{id}/Images/{tipo}). No Plex a imagem é um caminho próprio de cada item
// (thumb, art, clearLogo) servido pelo transcodificador de fotos. Este registro guarda,
// para cada servidor Plex conectado, o token e, para cada item já lido, o caminho de cada
// tipo de imagem. Assim getImageUrl resolve o Plex sem mexer nas telas.

const servers = {};
const images = {};

const trimSlash = (url) => (url || '').replace(/\/+$/, '');

export const registerPlexServer = (serverUrl, token) => {
	if (!serverUrl) return;
	servers[trimSlash(serverUrl)] = token;
};

export const unregisterPlexServer = (serverUrl) => {
	delete servers[trimSlash(serverUrl)];
};

export const isPlexServerUrl = (serverUrl) => !!serverUrl && Object.prototype.hasOwnProperty.call(servers, trimSlash(serverUrl));

export const plexTokenFor = (serverUrl) => servers[trimSlash(serverUrl)] || null;

// tipo do Jellyfin -> caminho no Plex; null apaga
export const rememberPlexImages = (itemId, paths) => {
	if (!itemId || !paths) return;
	const current = images[itemId] || {};
	for (const key of Object.keys(paths)) {
		if (paths[key]) current[key] = paths[key];
	}
	images[itemId] = current;
};

export const plexImagePath = (itemId, imageType) => images[itemId]?.[imageType] || null;

const DEFAULT_PATH = {
	Primary: (id) => `/library/metadata/${id}/thumb`,
	Thumb: (id) => `/library/metadata/${id}/art`,
	Backdrop: (id) => `/library/metadata/${id}/art`,
	Logo: (id) => `/library/metadata/${id}/clearLogo`
};

const query = (params) => Object.keys(params)
	.filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
	.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
	.join('&');

/**
 * URL de imagem de um item Plex. `options` segue o getImageUrl (maxWidth, maxHeight).
 * Caminho absoluto (foto de ator no plex.tv) volta como está.
 */
export const plexImageUrl = (serverUrl, itemId, imageType = 'Primary', options = {}) => {
	const base = trimSlash(serverUrl);
	const token = servers[base];
	// id de biblioteca e de pessoa sem foto não têm imagem no servidor
	if (String(itemId).startsWith('plexlib-')) return null;
	let path = plexImagePath(itemId, imageType === 'Backdrop' ? 'Backdrop' : imageType);
	if (!path && /^\d+$/.test(String(itemId)) && DEFAULT_PATH[imageType]) path = DEFAULT_PATH[imageType](itemId);
	if (!path) return null;
	if (/^https?:\/\//i.test(path)) return path;
	const width = options.maxWidth || options.width || (options.maxHeight ? Math.round(options.maxHeight * 1.5) : 600);
	const height = options.maxHeight || options.height || Math.round(width * 1.5);
	return `${base}/photo/:/transcode?${query({
		url: path,
		width,
		height,
		minSize: 1,
		upscale: 1,
		'X-Plex-Token': token
	})}`;
};

export const resetPlexImagesForTests = () => {
	for (const k of Object.keys(servers)) delete servers[k];
	for (const k of Object.keys(images)) delete images[k];
};
