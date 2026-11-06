---
name: "docs-adr-0830-estudo-ponte-secundaria-chamado-os-md"
description: "Documento Sinérgica SO: ADR-0830 — Estudo de ponte secundária Chamado–OS"
alwaysApply: false
---

# ADR-0830 — Estudo de ponte secundária Chamado–OS

Status: hipótese em avaliação; **não aprovada para criação operacional**. Não introduz schema, liberação de gate nem alteração dos vínculos existentes. Complementa ADR-0107 e ADR-0815.

## Problema comprovado

O índice 0171 impede duas OS ativas com o mesmo `chamado_id`. Uma hipótese aditiva seria manter a primeira OS com vínculo direto e gravar outra OS com `chamado_id` nulo, vinculada ao Chamado por ponte nova. Isso preservaria índice/trigger, porém os consumidores atuais não conhecem a ponte. Não é seguro criar a segunda OS enquanto houver qualquer consumidor relevante que dependa exclusivamente do campo legado.

Teste `supabase/manual-tests/E01-S167_ponte_secundaria_inventario.sql`, com ponte temporária, duas OS sintéticas (primeira finalizada, segunda em execução), gate temporariamente habilitado e rollback integral, demonstrou: a leitura 0312 omite a segunda; `operacao_itens` devolve `chamado_id` nulo para ela; o avaliador 0330 relata zero OS não finalizadas. O predicado de encerramento 0333 também examina apenas OS diretas: ainda que o teste não execute o encerramento completo, este pode ignorar a OS secundária. O frontend classifica `chamadoId=null` como pré-triagem. A ponte hipotética, portanto, não satisfaz a exigência de não omitir relações.

## Plano de transição proposto

1. Inventariar consumidores e contratos atuais no banco realmente implantado, frontend, Portal e funções externas. Busca estática inicial identificou 46 migrations candidatas; não significa 46 funções ativas, nem é inventário completo. Avaliar versões substituídas, SQL dinâmico, importações e acesso direto. Classificar cada leitor/escritor por cardinalidade, autorização, locks e tratamento de vínculo legado.
2. Antes de qualquer OS secundária, definir modelo canônico explícito com unicidade por OS, Cliente consistente, proibição de vínculos conflitantes, precedência e deduplicação de ponte singular/direta, histórico imutável, autorização e ordem de locks. Formalizar representação de OS secundária sem confundi-la com pré-triagem. Assegurar compatibilidade de RLS, revogação concorrente, idempotência, rastreamento por requestId e ausência de efeitos externos.
3. Preparar consulta comum autorizada que reconcilie vínculo direto, ponte singular e ponte secundária, falhando fechado para inconsistências; adaptar todos os leitores e escritores dependentes antes de introduzir dados secundários. Enquanto a ponte não existir ou não tiver dados, demonstrar equivalência com legado, inclusive OS removida e vínculos divergentes. Consultas paginadas precisam de fotografia consistente ou contagem integral server-side.
4. Atualizar transações de criação, enumeração, encerramento, reabertura, continuidade, parcelas, retorno, pendências, Visita, Portal e importação/sincronização Auvo; nenhum encerramento pode omitir OS pendente. Atualizar read model, filtros, navegação, busca e textos para não classificar secundária como pré-triagem. Preservar números públicos já existentes; definir numeração nova sem quebrar índice/trigger legados ou inferir equivalência.
5. Com consumidores adaptados e gates ainda fechados, testar transações e concorrência reais, migração de dados e rollback sem apagar relações; executar CI/db-tests, testes de segurança, performance, integração e revisão adversarial. Só então avaliar ativação e requisitos separados de autorização operacional. Nenhum envio Auvo está autorizado por esta ADR.

## Matriz mínima de cobertura antes de ativar

- Leitura e resumo: 0208/0178, 0312, 0376, 1010; zero, uma, múltiplas OS; ponte duplicada; filtros, paginação, Cliente divergente e permissão revogada.
- Encerramento e retomada: 0330/0333, 0611/0617/0621/0623; primeira finalizada e secundária ativa, cancelada ou excluída; nenhuma decisão falsa de aptidão.
- Continuidade e parcelas: 0379/0382, 0450/0453/0456/0458, 0609/0613/0618/0619, 0446; vínculo indireto, histórico, concorrência e idempotência.
- Visita, retorno, pendência e Grupo: 0823/0827/0833, 0903–0907, 0583/0586; relações secundárias e Cliente divergente sem perda de origem.
- Legado e integrações: 0134/0135/0151/0171/0209/0321/0324/0929, conversão web, Portal, webhook e importações Auvo; números, referência singular, dois Clientes, duplicação e recuperação de requestId, sem executar serviço externo real.

Essa matriz é ponto de partida, não confirmação de cobertura integral. Não há migration nem criação 1:N implementada por esta decisão; ambas dependem da conclusão do inventário e da prova dos contratos.

## Inspeção adicional da base diagnóstica

Consulta ao texto das funções instaladas nos schemas `pcm`, `comercial` e `portal`, procurando simultaneamente `chamado_id` e `ordens_servico`/`operacao_itens`, retornou 39 funções candidatas. Entre elas, `sso_listar_ordens_chamado` tem EXECUTE de `authenticated`, e `sso_diagnosticar_transicao_chamado_os` de `service_role`; diversas funções internas sem EXECUTE direto ainda podem ser alcançadas por comandos `security definer` ou triggers. Portanto privilégio negado ao papel não demonstra que um consumidor é irrelevante. A consulta não detecta SQL dinâmico, aliases sem o padrão pesquisado, views, acesso direto ou serviços fora do banco, e não é inventário completo.

O teste temporário também executou a 1010 na mesma transação e confirmou que seu resumo reporta somente a OS direta. A alteração de cada leitor isolado seria insuficiente: antes de gravar a ponte, é necessário cobrir também consumidores transacionais que não recebem relação explícita, ou garantir bloqueio comprovado de todos eles. Nenhuma adaptação parcial é habilitada por esta ADR.
