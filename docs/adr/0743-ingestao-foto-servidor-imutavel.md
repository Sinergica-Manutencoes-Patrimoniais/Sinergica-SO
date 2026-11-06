# ADR 0743 — Ingestão de foto com versão imutável verificável

## Decisão

Preparar fluxo separado de ingestão pelo servidor, desabilitado por padrão e sem substituir a via legada. O servidor autentica e autoriza lote/linha, limita e valida bytes, calcula SHA-256 dos bytes recebidos e registra a intenção por requestId. O adaptador de armazenamento deve gerar nome único no servidor, usar `upsert:false` e fornecer uma versão imutável comprovável; o servidor lê essa versão, compara o digest, revalida autorização e somente então confirma o vínculo. Replay concluído exige a mesma identidade, contexto e digest, com permissão atual; tentativa pendente ou conteúdo divergente não dispara novo upload automático.

O handler preparado é um **contrato experimental não exposto**: não há endpoint, adaptador de produção, gate ou migration conectados. Uma string rotulada como versão não comprova imutabilidade. A implementação de produção deve demonstrar que o identificador fixa os bytes mesmo sob substituição privilegiada e que a confirmação transacional vincula exatamente a versão verificada. Sem essa prova, a integração deve falhar fechada. Storage e banco não são uma única transação; falhas intermediárias podem deixar objetos órfãos e reservas pendentes, que não devem ser apagados ou vinculados automaticamente.

## Compatibilidade e verificação

Arquivos e uploads legados continuam sem integridade comprovada até reconciliação auditada; não criar hash retroativo como prova da versão aprovada. Testes atuais usam doubles e não comprovam a identidade, ACL, versão ou comportamento real do provedor. Antes de conectar a interface, são necessários persistência auditada de reserva/replay, RLS e gate desligado, testes de duas sessões e de alteração concorrente, limites de memória/taxa, proteção contra abuso, revisão de segurança e política de tratamento de pendências e órfãos. Não fazer deploy nem ativar enquanto qualquer garantia não estiver comprovada.

## Adendo — verificação por digest em cada leitura

O versionamento S3 de buckets não é suportado pelo Supabase; uploads para novo caminho, sem sobrescrita, são a orientação documentada ([compatibilidade S3](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/s3/compatibility.mdx), [uploads padrão](https://supabase.com/docs/guides/storage/uploads/standard-uploads)). Portanto, a exigência anterior de versão imutável do provedor não é tratada como disponível.

O experimento alternativo calcula SHA-256 no servidor ao receber bytes, exige adaptador que gere nome único e não sobrescreva, relê e compara o objeto antes da confirmação. Para cada leitura pelo novo fluxo, compara o digest dos bytes efetivamente baixados ao digest confiável persistido e revalida referência e autorização antes de responder. Alteração do objeto no mesmo caminho é detectada na leitura, não impedida; não se afirma imutabilidade contra usuário privilegiado. A garantia depende da proteção do digest, de todas as leituras usarem a nova rota e da correção transacional da confirmação. Rotas e arquivos legados não estão cobertos.

Os dois handlers seguem isolados e sem adaptador, persistência, endpoint ou gate operacional; os testes com doubles não demonstram integração real. Permanecem necessários: armazenamento auditado e imutável do digest, nome/owner confiáveis, autorização na confirmação, contenção de memória e taxa, testes de concorrência e vazamento, protocolo para reservas incertas e órfãos, e revisão antes de qualquer exposição. Uma falha ou ausência de digest deve permanecer fechada, não gerar garantia retroativa.
