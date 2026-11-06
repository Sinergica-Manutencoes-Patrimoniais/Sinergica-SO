# ADR-1084 — Acesso às interfaces de cópia de Rotina

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar concessão de execução ao papel autenticado para as quatro funções já usadas pelas interfaces de cópia e conferência de Rotina. Cada função mantém seus gates fechados, verificação de capacidade e escopo no servidor; a concessão não abre os gates nem concede acesso às tabelas. A cópia permanece em rascunho e não aprova Plano ou gera execução.

## Antes de habilitar

Testar todos os perfis, origem e destino em Clientes distintos, revogação concorrente, FORCE RLS do proprietário, exposição de conteúdo da origem, integridade da conferência e revisão adversarial. Avaliar impactos do trigger de aprovação de cópias. Uma migração de concessão não constitui autorização para ativar ou implantar.
