// CGFLIX: login na conta Plex pela TV (plex.tv/link) e escolha do servidor.
//
// Fluxo: pede um código ao plex.tv, mostra na tela e consulta a cada 3 s até a pessoa digitar o
// código em plex.tv/link. Com o token da conta, lista os servidores (o próprio e os de amigos),
// acha um endereço que responde e entra pelo loginWithToken, como o Emby Connect faz.
import {useCallback, useEffect, useRef, useState} from 'react';
import * as plexTv from '../../services/plexTv';

const POLL_MS = 3000;

const errorMessage = (err) => {
	switch (err?.reason) {
		case 'noServers': return 'Nenhum servidor Plex nesta conta.';
		case 'noReachableAddress': return 'O servidor Plex não respondeu. Confira se ele está ligado e com acesso remoto.';
		case 'expired': return 'O código expirou. Gere outro.';
		default: return 'Não foi possível falar com o Plex. Confira a internet da TV e tente de novo.';
	}
};

const usePlexLogin = ({loginWithToken, finishLogin, isAdding, setStep, setStatus, setError, setIsConnecting}) => {
	const [plexCode, setPlexCode] = useState(null);
	const [plexServers, setPlexServers] = useState([]);
	const [plexAccount, setPlexAccount] = useState(null);
	const timer = useRef(null);
	const pinRef = useRef(null);

	const stopPlexPolling = useCallback(() => {
		if (timer.current) clearInterval(timer.current);
		timer.current = null;
	}, []);

	useEffect(() => stopPlexPolling, [stopPlexPolling]);

	const enterServer = useCallback(async (server, account) => {
		setError(null);
		setIsConnecting(true);
		setStatus(`Conectando a ${server.name}...`);
		try {
			const uri = await plexTv.findReachableUri(server);
			const result = await loginWithToken(
				uri,
				{User: {Id: account.id, Name: account.name}, AccessToken: server.accessToken},
				{serverName: server.name, serverType: 'plex', isAddingNewServer: isAdding, switchToNewUser: true}
			);
			setIsConnecting(false);
			setStatus(null);
			finishLogin(result);
		} catch (err) {
			setIsConnecting(false);
			setStatus(null);
			setError(errorMessage(err));
		}
	}, [loginWithToken, finishLogin, isAdding, setError, setIsConnecting, setStatus]);

	const afterLink = useCallback(async (token) => {
		setStatus('Buscando seus servidores Plex...');
		const account = await plexTv.getAccount(token);
		const servers = await plexTv.getServers(token);
		setStatus(null);
		if (!servers.length) throw Object.assign(new Error('no servers'), {reason: 'noServers'});
		setPlexAccount(account);
		if (servers.length === 1) {
			await enterServer(servers[0], account);
			return;
		}
		// Os servidores próprios primeiro, depois os de amigos, por nome.
		setPlexServers(servers.slice().sort((a, b) => (Number(b.owned) - Number(a.owned)) || a.name.localeCompare(b.name)));
		setStep('plex-servers');
	}, [enterServer, setStatus, setStep]);

	const newPin = useCallback(async () => {
		stopPlexPolling();
		setPlexCode(null);
		setError(null);
		try {
			const pin = await plexTv.createPin();
			pinRef.current = pin;
			setPlexCode(pin.code);
			timer.current = setInterval(async () => {
				const current = pinRef.current;
				if (!current) return;
				if (Date.now() > current.expiresAt) {
					stopPlexPolling();
					setError(errorMessage({reason: 'expired'}));
					return;
				}
				try {
					const token = await plexTv.checkPin(current.id);
					if (!token) return;
					stopPlexPolling();
					pinRef.current = null;
					await afterLink(token);
				} catch (err) {
					stopPlexPolling();
					setStatus(null);
					setError(errorMessage(err));
				}
			}, POLL_MS);
		} catch (err) {
			setError(errorMessage(err));
		}
	}, [afterLink, setError, setStatus, stopPlexPolling]);

	const handlePlexStart = useCallback(() => {
		setPlexServers([]);
		setPlexAccount(null);
		setStatus(null);
		setStep('plex-link');
		newPin();
	}, [newPin, setStatus, setStep]);

	const handlePlexServerClick = useCallback((e) => {
		const index = parseInt(e.currentTarget.dataset.index, 10);
		const target = plexServers[index];
		if (target && plexAccount) enterServer(target, plexAccount);
	}, [plexServers, plexAccount, enterServer]);

	const resetPlex = useCallback(() => {
		stopPlexPolling();
		pinRef.current = null;
		setPlexCode(null);
		setPlexServers([]);
	}, [stopPlexPolling]);

	return {plexCode, plexServers, handlePlexStart, handlePlexServerClick, newPin, resetPlex, plexLinkUrl: plexTv.PLEX_LINK_URL};
};

export default usePlexLogin;
