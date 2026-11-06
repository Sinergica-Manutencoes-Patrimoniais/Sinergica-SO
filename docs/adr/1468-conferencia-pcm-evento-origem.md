# ADR-1468 — Conferência PCM de evento de origem

Status: preparação local; gates fechados, não homologada. Complementa ADR-1467.

Uma edição posterior da OS impede aplicação automática do evento. Preparar uma conferência explícita por operador autorizado, que compare os campos atuais e os declarados pelo último evento aceito. A confirmação deve carregar a revisão da OS acompanhada e a ordem do evento mostradas na prévia; qualquer mudança concorrente ou evento mais novo invalida a confirmação. O histórico registra ator, motivo e identidade do evento.

A confirmação atualiza somente os campos de origem expressamente apresentados. Não altera vínculo da OS, estado operacional, validação PCM, Chamado nem tarefa remota. OS antigas sem fotografia inicial, Cliente divergente, contrato modificado ou desabilitado permanecem pendentes para reconciliação própria. A edição humana é preservada até uma confirmação informada; nenhuma decisão é inferida a partir do texto. Retentativas devem reutilizar o mesmo requestId e verificar o recibo.

A implementação permanece sob gate próprio e depende dos gates de origem, da autorização `execucao.validar` e da trava de autorização. Revisar todos os escritores de OS, ordem de locks, compatibilidade da revisão, concorrência com revogação, replay, isolamento entre Clientes e RLS/FORCE antes de ativação ou homologação. Nenhum cron, deploy ou envio ao Auvo é autorizado por esta decisão.
