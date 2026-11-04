# ADR-1523 — Data civil de transição e vencidos

## Contexto

A geração e a aprovação podem usar o fuso congelado da versão. Suspensão, encerramento, retomada e decisão de vencido ainda usavam sempre a data em São Paulo, o que diverge perto da meia-noite para Plano configurado em outro fuso.

## Decisão

Reutilizar a data civil do snapshot da versão aplicável para as três ações e para decisão individual de vencido. A transição exige uma única versão aprovada vigente na data informada; decisão de vencido usa a versão identificada no próprio comando. Não há fuso presumido quando os gates existentes indicam uso de snapshot, nem alteração de âncora, vencimento, ocorrências, OS ou Auvo.

## Compatibilidade e limites

Com ambos os gates existentes de data civil e snapshot desligados, preservar o cálculo anterior em São Paulo. Com configuração parcial, versão ambígua ou fuso histórico ausente, recusar e pedir reconciliação. A transição continua limitada ao dia atual, sem agendamento futuro ou alteração automática de OS. A guarda 1045 permanece. Validar fuso histórico, limites de dia, revogação e concorrência antes de ativar.
