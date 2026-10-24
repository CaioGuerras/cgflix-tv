// CGFLIX: conta Plex (plex.tv). Login por código, como os apps de TV fazem: a TV mostra um
// código de 4 letras, a pessoa abre plex.tv/link no celular e digita. Depois, lista os
// servidores da conta (o próprio e os compartilhados por amigos) e acha um endereço que
// responde para cada um.

export const PLEX_LINK_URL = 'plex.tv/link';
const PLEX_TV = 'https://plex.tv';
const TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 5000;

let device = {clientId: 'cgflix-tv', product: 'CGFLIX TV', version: '2', deviceName: 'TV Samsung', platform: 'Tizen'};

export const setPlexDevice = (info) => {
	device = {...device, ...info};
};

export const plexHeaders = (token) => {
	const headers = {
		Accept: 'application/json',
		'X-Plex-Client-Identifier': device.clientId,
		'X-Plex-Product': device.product,
		'X-Plex-Version': device.version,
		'X-Plex-Device': device.deviceName,
		'X-Plex-Device-Name': device.deviceName,
		'X-Plex-Platform': device.platform,
		'X-Plex-Model': 'Tizen'
	};
	if (token) headers['X-Plex-Token'] = token;
	return headers;
};

const timed = (url, options, ms) => new Promise((resolve, reject) => {
	const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), {reason: 'timeout'})), ms);
	fetch(url, options).then((r) => {
		clearTimeout(timer);
		resolve(r);
	}, (e) => {
		clearTimeout(timer);
		reject(e);
	});
});

const plexTv = async (path, {method = 'GET', token} = {}) => {
	const r = await timed(`${PLEX_TV}${path}`, {method, headers: plexHeaders(token)}, TIMEOUT_MS);
	if (!r.ok) throw Object.assign(new Error(`plex.tv ${r.status}`), {status: r.status});
	return r.json();
};

/** Pede um código para o plex.tv/link. Volta {id, code, expiresAt}. */
export const createPin = async () => {
	const pin = await plexTv('/api/v2/pins?strong=false', {method: 'POST'});
	return {id: pin.id, code: pin.code, expiresAt: Date.now() + (pin.expiresIn || 900) * 1000};
};

/** Token da conta quando a pessoa já digitou o código; null enquanto não digitou. */
export const checkPin = async (pinId) => {
	const pin = await plexTv(`/api/v2/pins/${pinId}`);
	return pin.authToken || null;
};

export const getAccount = async (token) => {
	const u = await plexTv('/api/v2/user', {token});
	return {id: String(u.id), uuid: u.uuid, name: u.title || u.username || u.email, thumb: u.thumb || null};
};

const rank = (c) => (c.relay ? 3 : c.local ? 0 : c.protocol === 'https' ? 1 : 2);

/** Servidores da conta, cada um com a lista de endereços em ordem de preferência. */
export const getServers = async (token) => {
	const list = await plexTv('/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=0', {token});
	return (list || [])
		.filter((r) => (r.provides || '').split(',').includes('server'))
		.map((r) => ({
			name: r.name,
			machineId: r.clientIdentifier,
			owned: !!r.owned,
			accessToken: r.accessToken || token,
			connections: (r.connections || []).slice().sort((a, b) => rank(a) - rank(b)).map((c) => c.uri)
		}));
};

/** Primeiro endereço do servidor que responde a /identity. */
export const findReachableUri = async (server) => {
	for (const uri of server.connections) {
		try {
			const r = await timed(`${uri}/identity`, {headers: plexHeaders(server.accessToken)}, PROBE_TIMEOUT_MS);
			if (r.ok) return uri.replace(/\/+$/, '');
		} catch (e) { void e; }
	}
	throw Object.assign(new Error('Nenhum endereço do servidor respondeu'), {reason: 'noReachableAddress'});
};
