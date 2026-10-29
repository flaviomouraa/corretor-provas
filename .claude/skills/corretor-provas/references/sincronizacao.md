# Sincronização entre aparelhos (Supabase)

Objetivo do professor: abrir o app no celular, no computador e no iPhone com o mesmo usuário e senha e ver os mesmos gabaritos, notas e imagens.

## Como funciona

- Só fora do Claude (PWA e APK). No Claude continua o `db` da conta Claude. Ligada quando `SUPA.url`/`SUPA.key` (início do bloco "Sincronização" em `index.html`) estão preenchidos; a chave é a *publishable/anon key*, pública por natureza (a proteção vem das regras de acesso por linha).
- Conta no Supabase: e-mail fictício `u<acctId>@corretor-provas.app` e senha `authSecret(usuário, senha)` = PBKDF2(senha, "corretor-provas/sync/<usuário>", 150 mil). O servidor nunca vê a senha real nem a chave do cofre.
- Tabelas (`supabase/configurar.sql`): `cofres` (1 linha por professor: `blob` = o mesmo cofre cifrado do aparelho, `t` = hora da gravação) e `imagens` (id da prova, `iv`, `ct`). RLS: cada usuário só lê/grava as próprias linhas.
- Sem biblioteca: `fetch` direto na API do Supabase (`/auth/v1/signup`, `/auth/v1/token?grant_type=password`, `PUT /auth/v1/user`, `/rest/v1/cofres`, `/rest/v1/imagens` com `Prefer: resolution=merge-duplicates`).
- Fluxo: `persist()` grava local e marca `sync.dirty`; `syncNow()` (fila única) chama `doSync()`: baixa o cofre do servidor; se mudou desde a última vez (`t > sync.remoteT`), abre com a chave atual e junta (`mergeData`); envia se havia mudança local. Roda a cada 60 s, ao voltar para o app e quando a internet volta.
- `mergeData`: por id, fica a versão com maior `upd` (ou `edited`/`created`); `deleted` guarda exclusões (id → hora) por 180 dias e vence versões mais antigas.
- Login (`login` → `syncStart`): abre o cofre local se houver; entra no servidor; se a conta não existe lá mas abriu localmente, cria (`syncSignUp`) e envia; se existe, baixa e junta. Sem internet, entra com o cofre local e sincroniza no próximo login online.
- Troca de senha: primeiro muda a senha no servidor, depois recriptografa imagens e envia o cofre com o sal novo. Outros aparelhos percebem o sal diferente e saem com o aviso "A senha desta conta foi trocada em outro aparelho". Imagem guardada com a chave antiga é buscada de novo no servidor (`imageBytes`).
- Apagar conta: apaga as linhas do professor no servidor (o usuário do Auth fica; o mesmo nome de usuário só volta a funcionar com a mesma senha).

## Desde a 1.5

- Cofre v3 (ver SKILL.md): `mesmaChave(blob)` compara o `kid`; se outro aparelho converteu o cofre (kid diferente), este aparelho sai e pede login. Troca de senha não derruba os outros aparelhos na hora: eles saem quando a sessão do Supabase vence (`authFail` no `syncSignIn`).
- `recuperacao` (hash do verificador da chave) + função `recuperar_conta(p_email, p_verificador, p_nova_senha)` (security definer, `extensions.crypt` + `gen_salt('bf')`). "Esqueci a senha" (`recuperarConta`): RPC → entra → baixa o cofre → `openWithRecovery` → nova senha. Sem servidor, recupera só o cofre local.
- `sugestoes`: "Fale conosco" grava tipo, texto, contato opcional, versão e aparelho (anon e logado podem inserir; ninguém lê pela API, só pelo Table Editor). **Não é cifrado**: o app pede para não colocar nomes de alunos.
- O professor precisa **rodar o `configurar.sql` de novo** a cada versão que acrescentar tabelas (o arquivo é seguro para rodar várias vezes).

## Configuração (o professor faz, com orientação)

1. Criar conta em https://supabase.com e um projeto (região São Paulo, plano gratuito).
2. SQL Editor → colar `supabase/configurar.sql` → Run.
3. Authentication → Sign In / Providers → Email: **desligar "Confirm email"** (os e-mails são fictícios).
4. Project Settings → API (ou "API Keys"): copiar **Project URL** e a **publishable key** (ou "anon public"). Nunca pedir a *secret/service_role key*.
5. Colocar os dois valores em `SUPA` no `index.html`, rodar os testes, `build_pwa.py`, subir `versionCode`, commit e push (gera o APK).

## Problemas comuns

- Primeiro uso real (29/10/2026): "Não consegui criar a conta no servidor" genérico. Desde a 1.2.1 o app mostra o motivo (`explain`) e **não bloqueia**: a conta fica no aparelho, `sync.authPw` fica em memória e `doSync` tenta `syncConnect(null)` a cada minuto até o servidor aceitar. Se o aparelho criou o cofre separado de outro (sal diferente), pede para sair e entrar de novo (`relogin`) para juntar com a senha.
- **"email rate limit exceeded"** (visto no primeiro uso real): "Confirm email" ligado; cada cadastro tenta mandar e-mail (2/hora no plano grátis). Solução: desligar Confirm email **e apagar em Authentication → Users o usuário `u…@corretor-provas.app` que ficou sem confirmar** (senão o login dá "Email not confirmed"); depois "Tentar de novo" na aba Conta recria a conta no servidor.
- Dois aparelhos que criaram a conta separados juntam os dados de exemplo dos dois: o botão "Apagar exemplos" resolve.

- "pede confirmação de e-mail": passo 3 não foi feito.
- Login diz senha incorreta logo após ativar: a conta pode ter sido criada em outro aparelho com outra senha; use a senha daquele aparelho.
- Plano gratuito do Supabase pausa o projeto após ~7 dias sem uso: o app continua funcionando localmente e mostra "Não consegui sincronizar"; o professor reativa no painel do Supabase (Restore project).
- Limite gratuito: 500 MB de banco. Cada imagem de cartão cifrada ocupa ~40–60 KB.
- Teste local: `scripts/testar_sincronizacao.js` sobe um servidor que imita o Supabase (o domínio supabase.co costuma estar bloqueado no ambiente na nuvem).
