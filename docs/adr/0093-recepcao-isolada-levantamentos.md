# ADR-0093 — Recepção isolada de levantamentos

## Estado

Proposta local para E01-S178. Não autoriza implantação, incorporação à estrutura oficial ou envio ao Auvo. Complementa ADR-0028.

## Contexto

O executor legado grava diretamente nos cadastros e pode alimentar integrações; não constitui staging. A recepção precisa preservar linhas e identidade de origem antes da aprovação, com acesso restrito ao Cliente e retry seguro. Capacidades E01-S170 e cadastros/códigos E01-S176/S177 permanecem pré-requisitos de integração.

## Decisão

Criar armazenamento aditivo isolado por Cliente para lote e linhas tipadas, com RLS FORCE e sem grants diretos de leitura ou escrita aos usuários. Uma RPC de recepção para sessão PCM autorizada por `cadastro.gerir` valida limites, identidade externa, tipos e chaves de linha, persiste lote e linhas como pendentes e registra evento de auditoria e resposta idempotente na mesma transação. Identidade externa é única por Cliente e origem; reentrega idêntica não duplica, conteúdo divergente exige revisão explícita futura. RequestId repetido com ator ou conteúdo divergente é conflito; autorização atual é verificada antes de qualquer retry. O payload e resultado devem ser minimizados; auditoria registra identificação, contagem e correlação, não o texto das linhas.

Recepção não cria Componentes, Sistemas, Locais, Grupos, códigos, tarefas ou decisões. Nenhuma permissão é concedida automaticamente. Leitura, edição, revisão de linha, vínculos entre linhas, aprovação parcial, reversão, recebimento Auvo e Campo e acesso a fotos exigem contratos e provas próprias; não podem ser inferidos da tabela ou da função de recepção. A entrada inicial não aceita objetos ou caminhos de evidências. A ausência dessas funções não invalida o histórico legado.

## Compatibilidade e reverso

Adicionar tabelas sem alterar leitores ou escritores legados. Rollout exigirá migrações na ordem, testes de autorização e concorrência, monitoramento e revisão adversarial. Para recuar, desabilitar o consumidor e revogar a execução da RPC, preservando dados, comandos e auditoria; não apagar registros ou tabelas como rollback operacional. Não há backfill automático nem mudança dos códigos existentes.

## Gates

Verificar FORCE RLS, acesso direto negado inclusive service_role, uso de permissões atuais com sessão antiga, isolamento de Cliente, limites, entradas malformadas, tentativas concorrentes e rollback de lote/auditoria. Teste de transação isolada não prova implantação ou proteção contra corrida de revogação no meio da operação. Armazenamento de fotos e a integração real ainda estão bloqueados; homologação da story exige todos os AC e revisão adversarial.
