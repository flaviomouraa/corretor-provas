# Publicar e instalar

## 1. Página no Claude (Artifact)

- Link atual: https://claude.ai/artifact/XXH4UAdMZHsmb9qsreS3U6 (de outra conversa, publique com `url` desse link para manter o endereço; leia antes com `action: "read"`).
- Publique `index.html` com `capabilities: {"downloads": true, "db": {}, "user": {}}`. Sem `db`/`user`, o login some ao fechar o app do Claude.
- O conteúdo é publicado sem `<!doctype>/<html>/<head>/<body>`: o `index.html` do projeto já está nesse formato.
- Os dados de cada pessoa ficam em `data/users/<id>/` (privado, nem o dono vê). Para conferir depois de publicar: `ArtifactData` `list` em `data/users/me`.

## 2. Versão instalável (PWA) no GitHub Pages

```bash
python3 tools/build_pwa.py
git add -A && git commit -m "..." && git push -u origin main
```

- Repositório: `flaviomouraa/corretor-provas` (público, exigido pelo Pages gratuito). Endereço: https://flaviomouraa.github.io/corretor-provas/
- Ativar uma vez: Settings → Pages → Build and deployment → **Deploy from a branch**, Branch **main**, pasta **/docs**.
- Atualizações chegam sozinhas: o service worker busca a página na rede e cai no cache sem internet. O nome do cache muda a cada build (hash do HTML).

Instalar no celular:
- **Android (Chrome)**: abrir o endereço → menu ⋮ → **Instalar app**.
- **iPhone (Safari)**: abrir o endereço → **Compartilhar** → **Adicionar à Tela de Início**. No iPhone os arquivos (PDF, backup) saem pelo menu de compartilhar.

## 3. APK Android

O APK é só para Android. No iPhone use a PWA (App Store exige conta Apple de US$ 99/ano).

- Projeto em `android/`: `MainActivity.java` abre `docs/` (embutido como assets) via `WebViewAssetLoader`, liga `<input capture>` à câmera (FileProvider, sem permissão de câmera) e expõe `AndroidBridge.saveFile(nome, base64, mime)` (Downloads › Corretor de Provas; Android 9 ou anterior: compartilhar).
- **Pelo GitHub (recomendado)**: o workflow `.github/workflows/apk.yml` roda a cada push que muda o app ou `android/` (ou manualmente em Actions → Gerar APK → Run workflow) e publica `corretor-de-provas.apk` em **Releases**.
- **Assinatura**: para instalar atualizações por cima sem perder dados, todas as versões precisam da mesma chave. Ela foi gerada em `android/keystore/corretor.jks` (senha em `senha.txt`), fora do git, e se perde quando a sessão na nuvem acaba. Para o GitHub usar a mesma chave, crie os segredos do repositório (Settings → Secrets and variables → Actions):
  - `ANDROID_KEYSTORE_B64` = saída de `base64 -w0 android/keystore/corretor.jks`
  - `ANDROID_KEYSTORE_PASS` = conteúdo de `android/keystore/senha.txt`
  Sem esses segredos, o workflow assina com uma chave de depuração descartável; nesse caso, atualizar exige desinstalar (e o professor perde os dados se não tiver backup).
- **Localmente**: só funciona se `dl.google.com` estiver liberado na rede do ambiente (SDK Android). Depois: instalar o SDK (platform 34, build-tools), `cd android && ./gradlew assembleRelease`.
- A cada versão nova, aumente `versionCode` e `versionName` em `android/app/build.gradle`.

Instalar o APK: baixar no celular, abrir o arquivo e permitir "instalar apps desconhecidos" para o navegador ou o app de arquivos.
