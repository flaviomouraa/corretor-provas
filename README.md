# Corretor de Provas

App para professores corrigirem provas de múltipla escolha fotografando o cartão-resposta com o celular.

- Login com usuário e senha; gabaritos, notas e imagens ficam criptografados (AES-256) no aparelho.
- Cartão-resposta compacto para colar em qualquer prova do Word, ou folha A4 pronta em PDF.
- Leitura óptica no próprio celular, com conferência e correção manual.
- Provas corrigidas salvas, planilha de notas e gráficos da turma.
- Funciona sem internet depois de instalado.

## Estrutura

- `index.html`: código-fonte do app (um único arquivo).
- `tools/build_pwa.py`: gera a versão instalável em `docs/`.
- `docs/`: o app publicado pelo GitHub Pages (não editar à mão).

Depois de alterar `index.html`, rode:

```bash
python3 tools/build_pwa.py
```

## Publicar no GitHub Pages

Settings → Pages → Build and deployment → Source: **Deploy from a branch**, Branch: **main**, pasta **/docs**.

## Instalar no celular

- **Android (Chrome):** abra o endereço do app, toque no menu ⋮ e em **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar** e em **Adicionar à Tela de Início**.
