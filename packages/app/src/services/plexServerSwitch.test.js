// CGFLIX: trocar do Plex para o Jellyfin não pode deixar o endereço do Jellyfin registrado como Plex
// (as imagens do Jellyfin iam para o adaptador do Plex e sumiam; TV do Caio, 25/10).
import {setServer, setServerType, setAuth} from './jellyfinApi';
import {isPlexServerUrl, resetPlexImagesForTests} from './plexImages';
import {getImageUrl} from '../utils/helpers';

const PLEX = 'https://1-2-3-4.abc.plex.direct:32400';
const JELLYFIN = 'https://jellyfin.example.com';

describe('troca de servidor Plex -> Jellyfin', () => {
	beforeEach(() => {
		resetPlexImagesForTests();
		global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('')}));
	});

	test('o endereço do Jellyfin não fica registrado como Plex e as imagens voltam ao Jellyfin', () => {
		setServerType('plex');
		setServer(PLEX);
		setAuth('1', 'token-plex');
		expect(isPlexServerUrl(PLEX)).toBe(true);
		// mesma ordem do switchUser: servidor, depois tipo, depois credenciais
		setServer(JELLYFIN);
		setServerType('jellyfin');
		setAuth('u-jf', 'token-jf');
		expect(isPlexServerUrl(JELLYFIN)).toBe(false);
		expect(isPlexServerUrl(PLEX)).toBe(true);
		expect(getImageUrl(JELLYFIN, '7ed74dc74ba6676ce9b5e4a2d8cae5dd', 'Primary', {maxHeight: 300}))
			.toBe(`${JELLYFIN}/Items/7ed74dc74ba6676ce9b5e4a2d8cae5dd/Images/Primary?maxHeight=300`);
	});
});
