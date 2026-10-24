# Plex no CGFLIX TV (Tizen) — versão 2.1.0 (24/10/2026)

Base: P17 (`cdb9a72`, ramo `cgflix/p5-fileiras`). Ramo deste trabalho: `cgflix/p18-plex`.

## Como entra
O app inteiro fala com o servidor pelo objeto `api` de `services/jellyfinApi.js` e lê respostas no formato do Jellyfin.
O Plex entra como mais um **tipo de servidor** (`serverType: 'plex'`, como o Emby), por um **adaptador** com o mesmo
contrato. Telas e player não foram duplicados.

| Arquivo | Papel |
|---|---|
| `services/plexTv.js` | Conta plex.tv: código para `plex.tv/link`, conta, servidores da conta e escolha do endereço que responde (local → remoto → relay) |
| `services/plexApi.js` | Adaptador: itens Plex → formato Jellyfin, consultas (biblioteca, filhos, ordem, filtros, gêneros, pessoa, busca, páginas), play direto × HLS, timeline, marcadores |
| `services/plexImages.js` | Imagens: `getImageUrl` reconhece servidor Plex e usa o transcodificador de fotos dele |
| `utils/subtitleText.js` | Legenda externa do Plex (SRT/VTT/ASS crua) → mesmo JSON do Jellyfin (`TrackEvents`) |
| `utils/serverCapabilities.js` | O que cada tipo de servidor sabe fazer (hoje: favoritos) |
| `views/Login/usePlexLogin.js` + `Login.js` | Botão **Entrar com Plex**, tela do código, escolha do servidor |

Ids: biblioteca `plexlib-{seção}`, pessoa `plexperson-{tag}`, gênero `plexgenre-{seção}-{chave}`; itens usam o `ratingKey`.

## Reprodução
- **Direto:** o adaptador compara contêiner e codecs do arquivo com o `DeviceProfile` que o app já manda; se a TV aceita,
  o AVPlay toca o arquivo original (`/library/parts/...`). Legenda embutida: o AVPlay mostra; externa: vem do Plex
  (`/library/streams/{id}`) e o app desenha (ASS com estilo pelo renderizador ASS do app).
- **Conversão:** quando a TV não aceita (ou o play direto falha e o app pede de novo sem ele), o Plex gera HLS
  (`/video/:/transcode/universal/start.m3u8`). Legenda embutida escolhida é queimada no vídeo (o HLS não leva faixa).
- **Progresso:** `/:/timeline` a cada 10 s (tocando/pausado/parado); o Plex marca assistido sozinho perto do fim.
  Abertura e créditos vêm dos marcadores do Plex (pular abertura funciona quando o servidor detectou).

## Fora desta versão
- **Favoritos:** o Plex não tem favorito por item (o equivalente é a Watchlist da conta plex.tv). O botão some em servidor Plex.
- TV ao vivo, música, edição de metadados e as fileiras do plugin Moonfin (respondem vazio no Plex).
- Usuários gerenciados do Plex Home (troca de perfil com PIN da conta plex.tv).

## Testes
- `src/services/plexApi.test.js`: conversão, consultas, decisão de play, segmentos, imagens, legendas (sem rede).
- `src/services/plexApi.live.test.js`: contra um Plex real, só com `PLEX_URL` e `PLEX_TOKEN` no ambiente (token nunca impresso).
  Em 24/10, contra o Plex do CGSERVER: bibliotecas, 1.079 filmes, ficha com elenco e ids, arquivo 206 `video/x-matroska`,
  HLS 200 `#EXTM3U`, imagem 200, séries/temporadas/episódios, busca, continuar, próximos, gêneros.
- Interface no Chrome 1920×1080 por `file://` (VPS, `tizen/cgftv_plex.py`): login pelo código, lista com o servidor próprio
  primeiro e os de amigos, Início, ficha de filme, biblioteca Séries (158) e ficha de série com temporadas.
- **Não testado:** reprodução no AVPlay de uma TV de verdade (o navegador da VPS não tem AVPlay).
