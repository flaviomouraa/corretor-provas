# Cartão-resposta e leitura óptica

## O cartão (unidades em mm, tamanho original)

Gerado por `blockSVG(g)` / `blockLayout(nQ, nAlt)` em `index.html`.

- **Marcadores** nos 4 cantos, 9×9 mm, formato "alvo": anel preto de 1,5 mm, vão branco de 1,5 mm e miolo preto de 3×3 mm. O formato com miolo separado é o que distingue o marcador de bolinhas pintadas, marcadores de lista, letras e imagens da prova.
- **Barra de orientação**: retângulo 20×4 mm no meio da borda de cima, centrado na altura dos marcadores. Serve para saber qual lado é o de cima (a foto pode estar girada).
- **Código** (12 bits) na faixa de baixo, entre os marcadores de baixo: 9 bits de identificação do gabarito (1 a 511) + 3 bits de verificação (soma dos bits % 8). Quadrados de 3,6 mm. As posições são **frações** da distância entre os centros dos marcadores (`unitBitX`), para serem lidas antes de saber o tamanho do cartão: 6 à esquerda e 6 à direita do centro, deixando o centro branco (é onde a orientação compara "barra" × "vazio").
- **Bolinhas**: raio 2,2 mm, 6 mm entre alternativas, 7 mm entre linhas, número da questão à esquerda, letras A–E em cima de cada coluna. Até 60 questões usa colunas de 15 linhas; acima disso, colunas de 25 (máximo 100 questões, 4 colunas).
- **Letra clarinha dentro de cada bolinha** (desde a 1.3.1, pedido do professor): `LETRA_BOLHA` (cinza #C9C9C9, 2,3 mm). Não muda a geometria; cartões antigos sem letra continuam sendo lidos. Testado com letras até #888888 (fotocópia escura) em 108 fotos sem erro, porque a leitura compara cada bolinha com a mais clara da mesma questão. Não escureça mais do que isso nem aumente a letra.
- Largura mínima 84 mm (para caber o código). O PNG para o Word sai a 300 dpi com bloco `pHYs`, então entra no Word no tamanho real.

## Algoritmo (funções em `index.html`)

1. `fileToCanvas`: abre a foto (respeitando EXIF) limitada a 3000 px.
2. `locateBlock`: várias tentativas (escalas 1600/1100/2400/800 px e limiares 0,62–0,85):
   - `findFinders`: tons de cinza → limiar adaptativo (média local por imagem integral, janela = maior lado/20, pixel escuro se < média × limiar) → componentes conectados → marcador = componente com bbox quase quadrada, preenchimento 0,2–0,85, cujo centro cai num **outro** componente (o miolo) com área 7–65% do anel, contido e centrado. Também separa `solids` (quadrados cheios) para o caso de foto borrada.
   - `pickQuad`: monta quadriláteros candidatos (extremos x+y / x−y por grupos de tamanho parecido; com até 14 candidatos, todas as combinações de 4), ordena por área, testa orientação (`orient`: a barra de cima deve ser bem mais escura que o centro da faixa de baixo) e lê o código. Retorna o primeiro que tem código válido; senão o primeiro com orientação válida.
   - Última tentativa: candidatos + `solids`, aceitando **só** se o código for válido.
3. `finishScan`: com o código acha o gabarito (ou usa o escolhido na tela), calcula a homografia mm → foto com os centros dos marcadores e chama `readBubbles`.
4. `readBubbles`: média de cinza num disco dentro de cada bolinha; referência = max(mais clara da questão, percentil 75 geral); escuridão d = (ref − média)/ref. Marcada se d ≥ 0,22; duas marcas com a segunda > 60% da primeira → anulada (−1); nada → em branco (null). "Verificar" quando os valores estão na zona de dúvida.
5. `rectify`: gera a imagem do cartão "endireitada" (4 px/mm), que é salva cifrada e mostrada com as marcações.

Plano B: `renderManual` deixa o professor tocar nos 4 marcadores (com zoom); `refinePoint` procura o marcador perto do toque; `scanCorners` força a orientação de maior contraste.

## Testes

`scripts/testar_app.js` gera fotos sintéticas com `samplePhoto(g, seed, escalaDoCartão)` (página de prova com texto, marcadores de lista e imagem; cartão colado embaixo; foto inclinada sobre uma mesa, com sombra) e aplica rotação, perspectiva, desfoque, ruído, pouca luz e baixa resolução. O caso conhecido que ainda falha é cartão a 50% **e** desfoque de 3,5 px: o plano B cobre.

Respostas codificadas: índice 0–4 = A–E, `null` = em branco, `-1` = anulada (duas marcas).
