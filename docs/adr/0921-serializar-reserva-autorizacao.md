# ADR-0921 — Serialização da autorização na reserva interna

Data: 2026-10-30 · Status: preparado, não aplicado ou homologado.

## Contexto

O ensaio isolado combinou a RPC 0751 com autorização 0246 e gatilhos de alteração 0319: após a última checagem da RPC, uma concessão foi revogada e confirmada enquanto a gravação era retida; a reserva ainda foi criada. O ensaio usa tabelas simplificadas e barreira de teste, mas exercita a função de autorização e o trigger de revogação reais.

## Decisão

Antes de inserir documento interno, uma guarda transacional aditiva tentará adquirir a trava compartilhada usada em 0319 pelos escritores das fontes de autorização. Caso a trava exclusiva esteja ocupada, falhar imediatamente para evitar espera circular; após obtê-la, revalidar `faturavel.efetivar` para o Cliente do documento. A trava permanece até commit ou rollback. Revogação iniciada depois da aquisição aguarda o término; revogação confirmada antes da aquisição será vista pela revalidação. A guarda não habilita os gates ou dá privilégios.

Aplicar a todos os inserts da tabela, inclusive caminhos privilegiados, sem exceção silenciosa. Isso pode bloquear manutenção ou backfill sem identidade e capacidade adequadas: inventariar produtores e planejar manutenção autorizada antes de rollout. Não alterar dados existentes. O esquema de erros passa a incluir `autorizacao_em_alteracao` (55P03) e `sem_acesso` (42501).

## Limites e rollout

A 0319 cobre tabelas de concessões, usuários, perfis, módulos, grupos e Clientes identificadas em 0246/0142; verificar inventário completo, caminhos de administração e alterações diretas antes da implantação. A trava não comprova revogação de sessão externa, segurança de RLS, concorrência de outras RPCs financeiras ou ausência de deadlocks gerais. Provar as duas ordens e rollback em testes concorrentes com fontes reais e executar revisão adversarial. Manter todas as flags e grants fechados até aprovação operacional. Nenhuma publicação, cobrança ou deploy neste trabalho.

## Reversão

Não aplicar; caso implantada, desabilitar gates financeiros primeiro e usar nova migration revisada para remover apenas o trigger e a função, sem apagar documentos, seleções, autorizações ou auditoria. A remoção reabre a corrida e não deve ser tratada como estado seguro.
