# CGFLIX nas TVs LG (webOS) — beta 2.1.0

Pacote: `CGFLIX_webOS_v2.1.0.ipk` (id `br.com.docaio.cgflix.tv`). Entra com Jellyfin (servidor do CGFLIX) ou com a
conta Plex (botão **Entrar com Plex**, código em `plex.tv/link`). Não substitui o Moonfin, se já houver um instalado.

A LG não deixa instalar app fora da loja sem o **Modo Desenvolvedor**. São três partes: conta de desenvolvedor, TV e PC.

## 1. Conta de desenvolvedor LG (grátis, uma vez)
No PC ou celular, crie a conta em https://webostv.developer.lge.com (Sign In → Create Account).

## 2. Na TV
1. Abra a **LG Content Store**, procure **Developer Mode** e instale.
2. Abra o app Developer Mode e entre com a conta do passo 1.
3. Ligue **Dev Mode Status** → a TV reinicia.
4. Abra o Developer Mode de novo e ligue **Key Server**. Anote o **IP** e a **passphrase** mostrados na tela.

O Modo Desenvolvedor vale por **50 horas** e precisa ser renovado (botão **Extend** no app Developer Mode). Se vencer, o
app some e é preciso instalar de novo.

## 3. No PC (mesma rede da TV)

**Jeito fácil (com janela):** instale o **webOS Dev Manager** (https://github.com/webosbrew/dev-manager-desktop/releases),
adicione a TV com o IP e a passphrase, e use **Install** com o arquivo `.ipk`.

**Jeito por linha de comando:** com o Node.js instalado:
```
npm install -g @webos-tools/cli
ares-setup-device --add tv -i "host=IP_DA_TV" -i "port=9922" -i "username=prisoner"
ares-novacom --device tv --getkey          # pede a passphrase
ares-install --device tv CGFLIX_webOS_v2.1.0.ipk
ares-launch --device tv br.com.docaio.cgflix.tv
```

## Observações
- **Testado no navegador** (Chrome simulando o navegador de uma LG, 1920×1080): login Jellyfin/Plex, Início, fichas,
  bibliotecas, temporadas. **Não testado numa LG de verdade** (a reprodução usa o player da TV).
- Para não depender do prazo de 50 h existe o **Homebrew Channel** (https://www.webosbrew.org), que só funciona em
  algumas versões do sistema da TV.
