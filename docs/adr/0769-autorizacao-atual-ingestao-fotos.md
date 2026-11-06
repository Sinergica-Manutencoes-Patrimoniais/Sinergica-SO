# ADR-0769 — Autorização atual na ingestão e leitura de fotos

## Problema

A RPC de serviço da 0973 aceita autorização já revogada quando chamada em REPEATABLE READ com snapshot anterior. Como a resolução de foto é STABLE, somente inserir um lock seria insuficiente para atualizar o snapshot da instrução em READ COMMITTED. As operações de upload, download e SQL são transações separadas.

## Decisão

Nas duas RPCs de serviço, antes de avaliar o usuário ou consultar gates, recusar qualquer isolamento exceto READ COMMITTED com SQLSTATE 25001; adquirir sem espera o lock compartilhado do protocolo da 0319 e falhar com 55P03 se houver escritor de autorização. Bloquear, nessa ordem, os gates de ingestão e fotos com FOR SHARE até fim de transação e verificar os valores após lock. Tornar a resolução VOLATILE para permitir snapshot atualizado por comando. Preservar assinatura, credenciais, ACL, validações, audit e dados, e manter os núcleos não concedidos.

## Limitações e rollout

O protocolo cobre somente fontes de autorização protegidas pela 0319, não garante revogação instantânea do token externo nem atomicidade entre banco, upload e download: o cliente continua revalidando depois de acessar Storage. O gate do processo Edge não participa no lock do banco. Reservas pendentes e objetos órfãos após falha necessitam de reconciliação segura própria; não reusar ou apagar arquivos automaticamente. Testar corridas e diferentes ordens, segurança de papéis, integridade dos bytes e isolamento entre Clientes. A mudança de isolamento pode impactar consumidores fora de READ COMMITTED. Reverter a 0973 reabre o defeito: manter gates desligados durante rollback. Não é homologação nem autorização para deploy.
