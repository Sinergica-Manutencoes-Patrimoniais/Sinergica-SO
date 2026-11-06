# ADR-0973 — Nova promoção de retorno por ciclo

Status: preparação privada, não homologada.

O retorno aguardando pode originar novo Chamado com uma parcela para a Pendência devolvida, sem alterar Chamado, parcela ou OS anteriores. A transação valida autorização, revisão, estado do ciclo anterior e vínculo da Pendência, cria Chamado e parcela, encerra a disponibilidade do retorno, cria ciclo novo ativo e grava recibo e eventos imutáveis. O mesmo pedido recupera o resultado; unicidade do ciclo ativo e bloqueios impedem duas promoções simultâneas neste caminho. Não cria OS ou tarefa remota.

A implementação é restrita à parcela integral declarada não executada que já tenha passado pelo caminho 1109. OS terminal e reconciliação declarada não provam interrupção remota nem impedem que consumidores legados executem o vínculo anterior. O novo ciclo não substitui `sso_backlog_parcelas`: migrar e bloquear coordenadamente todos os leitores/escritores antigos antes de qualquer operação. Não trata execução parcial nem devolução de múltiplas parcelas em lote. Gate novo, demais gates e EXECUTE ficam fechados. Revisar numeração, ciclo de vida do Chamado, ordem global de locks, fontes de execução/autorizações, idempotência, RLS, provas da parada e concorrência, com revisão adversarial antes de ativar. Não aplicar em produção nem disparar Auvo.
