// CGFLIX: o que cada tipo de servidor sabe fazer. O Plex não tem favoritos por item
// (lá o equivalente é a Watchlist da conta plex.tv), então o botão some em vez de dar erro.
import {getServerType} from '../services/jellyfinApi';
import {isPlexServerUrl} from '../services/plexImages';

export const isPlexItem = (item) => item?._serverType === 'plex' ||
	(item?._serverUrl ? isPlexServerUrl(item._serverUrl) : getServerType() === 'plex');

export const supportsFavorites = (item) => !isPlexItem(item);
