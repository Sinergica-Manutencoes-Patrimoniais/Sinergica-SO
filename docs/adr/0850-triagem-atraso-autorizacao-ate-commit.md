# ADR-0850 — Serialização da autorização na triagem de atraso

Status: preparação; gate permanece fechado e revisão adversarial pendente.

## Contexto

Triagem S166 revalida `plano.gerir`, mas anteriormente não retinha a
autorização nem o gate até o commit. Um ensaio sintético em duas sessões
reproduziu quatro falhas: revogação e fechamento de gate confirmáveis depois
da decisão, e decisão possível durante ambas as alterações não confirmadas.

## Decisão

Reutilizar a trava transacional global das fontes de autorização, com aquisição
compartilhada sem espera e revalidação, sob READ COMMITTED. Reter o gate de
triagem `FOR SHARE NOWAIT` até o final da transação. Inserir a guarda na função
existente após validação de parâmetros e antes de consultar ou persistir
resultado, preservando assinatura, OID, ACL, idempotência e gate. Definição
inesperada aborta migration. Sem alteração de RLS ou integração externa.

## Limites

Não comprova todas as fontes de vínculo, relação inversa Plano/Cliente,
alterações privilegiadas de DDL ou JWT externo, concorrência com os demais
escritores de ocorrência, nem fluxo operacional integral. Avaliar contenção e
ordem de travas e executar revisão adversarial antes de homologar ou aplicar.
