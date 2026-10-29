---
name: corretor-provas
description: Manter e evoluir o app "Corretor de Provas" (correção de provas de múltipla escolha por foto do cartão-resposta, com login criptografado, gráficos da turma, versão instalável/PWA, APK Android e página publicada no Claude). Use esta skill sempre que o pedido envolver este app ou este repositório, mesmo sem citar o nome, por exemplo, "a leitura não funcionou com a minha foto", "mudar o cartão-resposta", "adicionar um campo/gráfico/relatório", "gerar o APK de novo", "publicar a nova versão", "o login sumiu", "o professor quer…", "corrigir provas pela câmera", "gabarito", "OMR".
---

# Corretor de Provas

App para professores corrigirem provas de múltipla escolha fotografando um cartão-resposta. O professor cadastra o gabarito, cola o cartão na prova (Word) ou imprime a folha A4, fotografa as provas preenchidas e o app lê, dá a nota, guarda a correção com a imagem e mostra gráficos da turma.

O usuário é professor, não programador, e usa o app no celular (Android pelo APK; iPhone pelo site instalado). Escreva para ele em português simples, sem jargão, e explique o que ele precisa fazer com passos curtos e numerados. Ele gostou do app como está: preserve o visual e o jeito de usar, mude só o que for pedido.

O estado atual (versões publicadas, pendências, histórico de pedidos) está em `references/estado-atual.md`. Leia no começo de qualquer conversa sobre o app e atualize ao terminar uma mudança.

## Mapa do projeto

| Caminho | O que é |
|---|---|
| `index.html` | **O app inteiro** (HTML + CSS + JS num arquivo). É a única fonte: edite aqui. |
| `tools/build_pwa.py` | Gera `docs/` (versão instalável/PWA) a partir de `index.html`. |
| `tools/sw.template.js` | Service worker (funcionar sem internet). |
| `tools/vendor/jspdf.umd.min.js` | jsPDF 2.5.1 embutido para o PDF funcionar offline. |
| `docs/` | Gerado. Publicado pelo GitHub Pages. Não edite à mão. |
| `android/` | App Android (WebView) que embute `docs/`. `android/keystore/` fica fora do git. |
| `.github/workflows/apk.yml` | Compila o APK no GitHub e publica em Releases. |

O mesmo `index.html` roda em três lugares, e o código detecta onde está:
- **Página publicada no Claude** (Artifact): existe `window.claude.use`. Usa as capacidades `db` + `user` (armazenamento permanente na conta Claude) e `downloads`.
- **PWA** (navegador / tela inicial): sem `window.claude`. Dados em `localStorage` + IndexedDB; `navigator.storage.persist()`.
- **APK Android**: existe `window.AndroidBridge` (salvar arquivos em Downloads). Carregado de `https://appassets.androidplatform.net/` para ter contexto seguro (Web Crypto exige).

**Sincronização entre aparelhos** (PWA e APK, fora do Claude): ligada quando `SUPA.url` e `SUPA.key` estão preenchidos em `index.html`. Usa o Supabase do professor só como depósito de dados já cifrados; detalhes em `references/sincronizacao.md`.

## Fluxo de trabalho para qualquer mudança

1. Edite `index.html`.
2. Rode os testes: `node .claude/skills/corretor-provas/scripts/testar_app.js` (precisa de Playwright; o Chromium já vem no ambiente). Todos devem dar OK. Se mexeu na leitura óptica, rode antes e depois para comparar. Se mexeu em salvar, login, contas ou sincronização, rode também `python3 tools/build_pwa.py && node .claude/skills/corretor-provas/scripts/testar_sincronizacao.js` (dois aparelhos + servidor simulado).
3. Regenere a versão instalável: `python3 tools/build_pwa.py`.
4. Publique onde o usuário usa (veja `references/publicar.md`): Artifact no Claude, GitHub Pages (`docs/`) e/ou APK (aumente `versionCode`/`versionName` em `android/app/build.gradle`).
5. Faça commit. Nunca envie `android/keystore/`.

Antes de entregar, olhe a tela: tire um screenshot com Playwright (largura 400px, claro e escuro) das telas que mudaram.

## Regras que não podem quebrar

Estas regras existem porque cartões já impressos e dados já salvos dependem delas.

- **Geometria do cartão** (`BLK`, `blockLayout`, `unitBitX`, `codeBitsOf`, `finderSVG`): mudar qualquer número invalida os cartões que os professores já imprimiram ou colaram nas provas. Se precisar mudar, crie um formato novo e mantenha a leitura do antigo, ou avise claramente o usuário que é preciso reimprimir. Detalhes em `references/leitura-optica.md`.
- **Nada de borda/moldura ligando os marcadores**: os 4 marcadores precisam ser manchas separadas para serem encontrados. As molduras do formato "Blocos de 5" ficam a ≥ 2,5 mm deles.
- **Formato "colunas" é o original e não pode mudar**; formatos novos entram como outro valor de `layout`. Depois de mexer em `blockLayout`, compare a geometria de `colunas` com a versão anterior (todas as combinações de questões e alternativas).
- **Formato do cofre** (`sealVault`/`openVault`, `PREFIX`, `acctId`, nomes `conta-<id>` e `img-<conta>-<resultado>` no db): mudar sem migração faz o professor perder o acesso. Leia ambos os formatos e grave o novo.
- **Toda alteração de dados passa por `stamp(item)` e toda exclusão por `tomb(id)`**, seguidas de `persist()`. Sem isso a sincronização não sabe qual versão é a mais nova e itens apagados "ressuscitam" vindos do outro aparelho.
- **O servidor só recebe dado cifrado.** A senha do Supabase é `authSecret(usuário, senha)` (PBKDF2 com outro sal), nunca a senha real nem a chave do cofre.
- **A senha nunca é gravada.** Tudo (gabaritos, notas, imagens) é cifrado com AES-GCM e chave PBKDF2 da senha. Não adicione "lembrar senha" que guarde a chave.
- **Gabaritos com provas corrigidas não mudam o número de questões/alternativas** (o editor bloqueia). Mudar as respostas recalcula as notas salvas: isso é desejado.

## Armadilhas já encontradas (não repita)

- **Artifact**: `localStorage` some ao fechar o app do Claude. Por isso o cofre vai para o `db` em `data/users/<id>/` (privado por pessoa). Só o dono e quem tem nível Contribuidor gravam; outros visitantes ficam só no navegador. Documento máximo 256 KiB: o cofre é comprimido com gzip antes de cifrar.
- **Artifact**: sem `window.print()`, `alert/confirm/prompt`, `<a download>` nem câmera ao vivo. Use modais próprios, a capacidade `downloads` e `<input type=file capture=environment>` (abre a câmera nativa). Ao republicar com `capabilities`, mande o conjunto completo (`downloads`, `db`, `user`).
- **`box-sizing`**: fora do Claude não há reset; sem `*{box-sizing:border-box}` os campos com `width:100%` + padding passam da caixa e se sobrepõem (aconteceu no cadastro de gabarito no APK). Mantenha a regra no topo do CSS.
- **Telas em coluna única no celular**: o professor pediu o gabarito "todo na vertical" (uma questão por linha) ao marcar as respostas certas (`.bubbles.vertical` no editor). Não volte a usar várias colunas ali.
- **Sem zoom** (pedido do professor): campos com fonte < 16px fazem o celular dar zoom ao tocar; por isso `input, select, textarea { font-size: 16px !important }` e `html { touch-action: manipulation }`. A PWA usa `maximum-scale=1, user-scalable=no` e o APK desliga zoom e `setTextZoom(100)`. O único zoom permitido é o da tela "Marcar os cantos" (botões − / +).
- **Cores**: use sempre `var(--accent)`, `--accent-soft`, `--accent-ink` e `--seq1..4`; a aba Conta → Aparência troca esses valores (`CORES`, `aplicarAparencia`, guardado no aparelho em `corretor-provas.aparencia`). Não escreva a cor azul fixa em componentes novos. No APK, `AndroidBridge.setBarColor` pinta as barras do sistema.
- **`[hidden]`**: classes com `display:grid/flex` vencem o atributo `hidden`; a regra `[hidden]{display:none!important}` precisa estar no CSS do próprio arquivo (fora do Claude não existe o reset da plataforma).
- **Código do cartão**: a área amostrada em cada bit precisa ser pequena (±0,004 em coordenadas unitárias); maior que isso pega papel branco em cartões altos (100 questões).
- **Fotos reais**: o desfoque transforma o marcador vazado em quadrado cheio. Há uma última tentativa que aceita quadrados cheios, mas só se o código do cartão confirmar (senão daria falsos positivos com bolinhas pintadas).
- **Cartões da versão 1** (quadrados pretos cheios, folha A4 inteira) não são mais lidos. Se o professor reclamar que "não lê", pergunte primeiro se o cartão foi gerado na versão atual (cantos em forma de alvo).
- **Ambiente na nuvem**: `dl.google.com` costuma estar bloqueado, então o SDK Android não instala aqui; compile o APK pelo GitHub Actions ou peça para liberar o domínio. Não tente espelhos de terceiros.
- **Push no GitHub** recusado com "Claude doesn't have GitHub access": o app do Claude no GitHub não tem acesso a esse repositório. O usuário libera em github.com/settings/installations → Claude → Configure → adicionar o repositório.

## Quando a leitura falha numa foto real

1. Peça a foto e o print da tela de erro (ela mostra quantos marcadores foram achados, em laranja).
2. Reproduza: carregue a foto num teste com Playwright (`fileToCanvas` → `scanPhoto`) e inspecione `locateBlock(canvas).cands`.
3. Ajuste parâmetros com cuidado (limiares de `findFinders`, escalas em `locateBlock`, limites em `readBubbles`) e rode a suíte inteira, porque melhorar um caso costuma piorar outro.
4. Se possível, transforme a foto num caso de teste no script.

## Referências

- `references/leitura-optica.md`: especificação do cartão e do algoritmo de leitura (leia antes de mexer em OMR ou no desenho do cartão).
- `references/publicar.md`: como publicar no Claude (Artifact), GitHub Pages, APK e como o professor instala no Android e no iPhone.
- `references/estado-atual.md`: versões publicadas, pendências e histórico do que o professor pediu.
- `references/sincronizacao.md`: como funciona a sincronização (Supabase), configuração e problemas comuns.
