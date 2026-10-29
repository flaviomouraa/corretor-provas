# Estado atual do Corretor de Provas

Atualize este arquivo ao terminar cada mudança (versão, data, o que mudou, pendências).

## Onde o app está publicado

| Onde | Endereço | Versão |
|---|---|---|
| APK Android (o professor usa este) | https://github.com/flaviomouraa/corretor-provas/releases (tag mais recente) | 1.5.2 (versionCode 10), assinado com a chave permanente: + chave de recuperação, cofre v3, Fale conosco, boas-vindas, aceite dos termos, páginas públicas |
| Site instalável / iPhone | https://flaviomouraa.github.io/corretor-provas/ | gerado de `docs/`; Pages **ativo** (confirmado em 29/10/2026) |
| Página no Claude | https://claude.ai/artifact/XXH4UAdMZHsmb9qsreS3U6 | mesmo código da versão atual, capacidades `db`, `downloads`, `user`; link compartilhado como "qualquer pessoa com o link" |
| Apresentação / Privacidade / Termos | https://flaviomouraa.github.io/corretor-provas/apresentacao/index.html (e /privacidade/, /termos/) | 1.5 |
| Código | https://github.com/flaviomouraa/corretor-provas (público, ramo `main`) | |

## Pendências

- **Rodar de novo o `supabase/configurar.sql`** (1.5 acrescentou `recuperacao`, `recuperar_conta` e `sugestoes`). Sem isso: "Fale conosco" falha e a recuperação só funciona no próprio aparelho.
- ~~Chave de assinatura permanente~~: **feita** em 29/10/2026 (APK 1.5.2, `apk-11`). A 1.5.2 foi a última instalação que exigiu desinstalar; daqui em diante, atualizações instalam por cima.
- **Textos legais**: completar identificação do responsável (nome/CNPJ/e-mail) e revisar com advogado antes do lançamento amplo.
- **Plano comercial** (conversado em 29/10): etapa 1 feita na 1.5; próximas: teste com 10–30 professores, repositório privado + Cloudflare/Netlify, Play Store, plano Pro (Mercado Pago/Stripe), painel da coordenação.

- **Sincronização entre aparelhos**: **funcionando com o servidor real** desde 29/10/2026 (conta `flavio.moura` criada no site pelo PC, aba Conta mostrou "ativa"). Foi preciso desligar "Confirm email" e apagar o usuário pendente no Supabase. Falta confirmar que o professor entrou no celular com a mesma conta (Entrar, não Criar conta) e, se havia dados antigos só no celular, trouxe pelo backup (Conta → Restaurar backup, que junta).
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
11. 1.3: o app "dava zoom" em alguns momentos no celular → zoom desligado; opção de **mudar a cor do app** (6 cores + automático/claro/escuro, na aba Conta).
12. 1.3.1: **letras clarinhas dentro das bolinhas** do cartão-resposta, para facilitar a marcação dos alunos.
13. 1.4: **formato do cartão à escolha** no cadastro do gabarito (Colunas, Uma coluna, Horizontal, Blocos de 5), com prévia.
15. Quer tornar o app **comercial**: pediu a "etapa 1" (pronto para outros professores testarem) → 1.5.
14. "Gostei bastante do resultado" (29/10/2026, sobre a 1.4): aprovou os 4 formatos, as cores e as letras nas bolinhas. Mantenha esse padrão de entrega (veja "Como entregar uma versão" no SKILL.md).

## Funcionalidades atuais (resumo)

- Criar conta: aceite dos termos → chave de recuperação → boas-vindas (explorar com exemplos ou começar do zero). "Esqueci a senha" com a chave. "Fale conosco" na entrada e na aba Conta.
- Contas locais com usuário e senha (PBKDF2 + AES-GCM); sai sozinho após 10 min sem uso; espera crescente após 3 senhas erradas.
- Gabaritos (1–100 questões, A–D ou A–E, valor da prova), respostas ocultas até tocar em "Ver respostas", preenchimento rápido digitando "ABDCE…".
- Cartão-resposta em 4 formatos (escolhido por gabarito): imagem PNG 300 dpi para o Word e folha A4 em PDF; código do gabarito impresso no cartão.
- Correção: foto (câmera ou galeria) → conferência com a imagem lida, toque para corrigir, aluno e turma, salvar e fotografar a próxima; plano B de marcar os cantos com zoom.
- Resultados: filtros por prova e turma; média, maior e menor nota; gráficos de notas por aluno, distribuição, **pizza (faixas / tipo de resposta)**, evolução da turma; tabela de alunos (abre o cartão salvo); acertos por questão; planilha CSV; baixar gráficos em PNG.
- Conta: aparência (cor e claro/escuro, por aparelho), sincronização, backup criptografado (inclui imagens), restaurar, trocar senha, apagar conta.
- Exemplos (2 provas, 14 alunos da "6º B (exemplo)") em toda conta nova, com botão "Apagar exemplos".
