# ADR-0647 — Correção atômica de código informado em staging

Status: proposta; gate fechado, não homologada.

O código informado e o candidato de Sistema/Equipamento/Componente podem divergir nos comandos existentes, impedindo incorporação. O PCM corrige ambos atomicamente enquanto a linha segue em staging, com retrato anterior, motivo, confirmação, revisões e requisições idempotentes. A edição inicia novo ciclo de conferência e os comandos existentes bloqueiam cadastros incorporados/rejeitados. Não altera código oficial usado nem cria alias: a informação anterior fica no histórico de auditoria do levantamento.

RPC e gates permanecem fechados. A unicidade efetiva continua verificada na incorporação; correção de código já utilizado exige processo administrativo separado. Interface, testes de concorrência e aplicação pendentes.
