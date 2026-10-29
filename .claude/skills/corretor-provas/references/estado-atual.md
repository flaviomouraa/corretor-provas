# Estado atual do Corretor de Provas

Atualize este arquivo ao terminar cada mudança (versão, data, o que mudou, pendências).

## Onde o app está publicado

| Onde | Endereço | Versão |
|---|---|---|
| APK Android (o professor usa este) | https://github.com/flaviomouraa/corretor-provas/releases (tag mais recente) | 1.2 (versionCode 3), com sincronização |
| Site instalável / iPhone | https://flaviomouraa.github.io/corretor-provas/ | gerado de `docs/`; **Pages ainda não foi ativado** (`has_pages: false` em 28/10/2026) |
| Página no Claude | https://claude.ai/artifact/XXH4UAdMZHsmb9qsreS3U6 | versão 4, capacidades `db`, `downloads`, `user`; link compartilhado como "qualquer pessoa com o link" |
| Código | https://github.com/flaviomouraa/corretor-provas (público, ramo `main`) | |

## Pendências

- **Sincronização entre aparelhos**: ligada na versão 1.2 com o projeto Supabase `imkikvxszvxucdowyvyl` (URL e publishable key em `SUPA`, `index.html`). O domínio supabase.co é bloqueado no ambiente na nuvem, então **ainda não foi confirmado com o servidor real**: não deu para verificar daqui se o professor rodou `supabase/configurar.sql` e desligou "Confirm email". Se o professor relatar erro ao entrar/criar conta, comece por esses dois passos.
- **Ativar o GitHub Pages** (o professor faz; passos em `publicar.md`). Depois confirmar com a API e guiar a instalação no iPhone.
- **Chave de assinatura permanente do APK**: ainda não configurada. Os segredos `ANDROID_KEYSTORE_B64` e `ANDROID_KEYSTORE_PASS` não existem; cada build sai com chave de depuração descartável. A chave gerada na sessão original (`android/keystore/`) estava fora do git e pode ter se perdido: se não existir, gere outra com `keytool` (alias `corretor`) e guie o professor a criar os dois segredos. Oferecido ao professor em 28/10/2026, sem resposta ainda.
- **Teste em aparelho real**: o APK e a leitura com fotos reais ainda não foram confirmados pelo professor. Se ele mandar uma foto que falhou, siga "Quando a leitura falha numa foto real" no SKILL.md.

## Histórico de pedidos do professor (o que ele valoriza)

1. App de celular que corrige provas pela câmera, com gabarito salvo e acessível só pelo professor.
2. Login com **usuário e senha**; cada professor com sua conta.
3. Marcadores **só em volta do cartão-resposta**, para colar a imagem do cartão em qualquer prova do Word.
4. Provas corrigidas **salvas para consultar depois**; **gráficos das notas da turma**.
5. "Não está lendo" → leitura mais tolerante + plano B de marcar os cantos manualmente. "Login some ao fechar" → armazenamento permanente.
6. Usar **sem conta Claude, como app de verdade** → PWA + **APK Android**. Perguntou do iPhone → PWA pelo Safari (APK não funciona no iOS).
7. Transformar o trabalho numa **skill** (esta) e mantê-la atualizada.
8. Versão 1.1: campos do cadastro não podem se sobrepor; **gabarito todo na vertical** ao marcar as respostas certas; **gráfico de pizza** em Resultados (notas por faixa / tipo de resposta).
9. "Gostei bastante do app": manter o visual e o funcionamento atuais.
10. Abrir o app no **computador** com os mesmos dados do celular → escolheu a opção de **sincronização própria** (Supabase, dados cifrados no aparelho).

## Funcionalidades atuais (resumo)

- Contas locais com usuário e senha (PBKDF2 + AES-GCM); sai sozinho após 10 min sem uso; espera crescente após 3 senhas erradas.
- Gabaritos (1–100 questões, A–D ou A–E, valor da prova), respostas ocultas até tocar em "Ver respostas", preenchimento rápido digitando "ABDCE…".
- Cartão-resposta: imagem PNG 300 dpi para o Word e folha A4 em PDF; código do gabarito impresso no cartão.
- Correção: foto (câmera ou galeria) → conferência com a imagem lida, toque para corrigir, aluno e turma, salvar e fotografar a próxima; plano B de marcar os cantos com zoom.
- Resultados: filtros por prova e turma; média, maior e menor nota; gráficos de notas por aluno, distribuição, **pizza (faixas / tipo de resposta)**, evolução da turma; tabela de alunos (abre o cartão salvo); acertos por questão; planilha CSV; baixar gráficos em PNG.
- Conta: backup criptografado (inclui imagens), restaurar, trocar senha, apagar conta.
- Exemplos (2 provas, 14 alunos da "6º B (exemplo)") em toda conta nova, com botão "Apagar exemplos".
