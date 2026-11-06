---
name: "docs-adr-0858-contrato-conversao-os-integral-md"
description: "Documento Sinérgica SO: ADR 0858 — Contrato integral da conversão de Chamado em OS"
alwaysApply: false
---

# ADR 0858 — Contrato integral da conversão de Chamado em OS

O comando preparado 0324 não substitui a conversão legada: recebe subconjunto dos campos, força destino `convertido_os`, suprime a sincronização e não incorpora o movimento posterior no Hub. Adaptá-lo silenciosamente descartaria dados ou efeitos. O retry legado também não prova que OS encontrada corresponde ao comando que falhou.

A transição deve reutilizar `pcm.ordens_servico`, `pcm.chamados`, `pcm.chamados_eventos` e `pcm.chamado_os_comandos`, preservando o payload completo da abertura, `destino` e eventual movimento de Hub, com `requestId` e `osId` estáveis. O servidor deve comparar ator, Cliente, revisão e payload completo antes de devolver resultado idempotente; colisões divergentes falham. Escritas locais e seus eventos devem confirmar ou reverter juntas. Integração externa não deve ser disparada pela preparação ou por testes; o tratamento de outbox e o efeito de Hub precisam ser explicitamente preservados e provados antes da exposição.

Esta decisão não autoriza remover índice ou trigger legado, trocar o fluxo atual, abrir gates nem conceder execução ao núcleo. Enquanto não houver equivalência dos campos, destinos, efeitos, transição de numeração, leitores e escritores, o comando 0324 permanece incapaz de representar a conversão integral. É obrigatório testar rollback, identidade após timeout, conflitos de payload, autorização por Cliente, compatibilidade com código e número existentes e concorrência antes do rollout.

## Inventário local de efeitos e vínculos

`gerarOsDoChamadoNoStatus` usa abertura em `solicitacao`, marca o Chamado com destino e em seguida executa UPDATE de status da OS no Hub (`supabase-hub-os-adapter.ts`); o UPDATE aciona, entre outros, `trg_os_status_eventos` e guards de composição. Inserir já no status final não é comprovadamente equivalente a INSERT seguido de UPDATE. Ambos devem ser tratados no mesmo comando local ou sua divergência precisa ser explicitamente resolvida e testada.

No schema reconstruído até a base de diagnóstico, a OS não possui trigger `fn_auvo_enqueue`: a 0168 removeu o trigger de abertura automática por planejamento, e a abertura Auvo passou a ser explícita via `pcm-auvo-open-task`. Portanto não se deve inferir que inserir OS enfileira `auvo_sync_outbox`. Outras tabelas usam `fn_auvo_enqueue`, que além de outbox pode chamar `net.http_post` (0051); testes devem usar cluster isolado sem serviços externos nem cron. Conferir o schema efetivamente implantado antes de afirmar equivalência. A supressão em 0324 não prova equivalência de todas as integrações.

FK simples de `equipamento_id`, `origem_inspecao_item_id`, `pmoc_schedule_id`, `tecnico_funcionario_id` e `tipo_tarefa_id` não comprova pertencimento ao Cliente. Equipamento e item de inspeção têm `client_id`; PMOC usa `property_id`, cuja cadeia deve ser verificada; funcionário e tipo de tarefa têm ativação/remoção, mas não possuem Cliente direto no schema inspecionado. O comando novo não deve usar `SECURITY DEFINER` para contornar essas validações nem impor regra de vínculo inventada aos cadastros globais. Os campos e eventos do Chamado, o código existente e os dados históricos permanecem intactos.

Em cluster descartável, `E01-S167_inventario_conversao_efeitos.sql` passou 7/7 com ROLLBACK: INSERT seguido de UPDATE produziu dois eventos de status; INSERT direto no estado final produziu um; subtransação abortada reverteu OS e evento. O mesmo ensaio confirmou que FK isolada aceita equipamento e item de inspeção de outro Cliente. A fixture usa `app.auvo_sync_write=true`, portanto a ausência de outbox nesse ensaio não prova ausência de efeitos na operação normal. Na cadeia PMOC, `pmoc_schedules.property_id` referencia `pmoc_properties.client_id`, mas também existem vínculos de contrato e registro que exigem validação de consistência antes do comando.

O núcleo preparado será privado, usando `chamado_os_comandos` para identidade e comparação do payload integral. Não haverá tabela paralela nem grant ao cliente. A função mantém a barreira explícita enquanto o índice ou trigger singulares existirem, além do gate padrão fechado. O fluxo proposto executa INSERT em `solicitacao`, evento de Chamado e, quando solicitado, UPDATE de Hub na mesma transação; valida os vínculos antes da escrita. Essa preparação não habilita abertura em ambiente real: continuidade depende de testes reais, integração de UI, reconciliação de consumidores e avaliação de compatibilidade/efeitos.

O núcleo 1047 adota o formato `CH…-OS-UUID` para novas OS, como 0324 e o sufixo estável previsto no plano S167; não altera números antigos. Isso não demonstra compatibilidade: ADR-0014 e consumidores como `supabase/functions/_shared/auvo/os-from-task.ts` assumem número da OS igual ao do Chamado. Revisar e validar todos os consumidores, apresentação e integração antes de autorizar o formato ou liberar restrições. Não substituir esse teste por renumeração de dados históricos.

Em clone descartável, 1047 passou 4/4 para ACL, gate e bloqueio legado e 18/18 em prova de escrita, retry, revogação sequencial, integridade por Cliente, 1:N e rollback. No segundo teste, gate foi temporariamente aberto e índice/trigger removidos apenas na transação, sempre revertida; usou-se anti-sync. Faltam teste concorrente de retry/revogação, inspeção e PMOC em todos os ramos, validação de eventos e integrações reais, revisão adversarial e CI. O núcleo não possui mediação ou integração de interface; não utilizar em produção.
