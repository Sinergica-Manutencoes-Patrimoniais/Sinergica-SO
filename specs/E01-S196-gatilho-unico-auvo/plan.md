# Plano técnico — E01-S196

Ver ADR-1694 pra decisão completa. Resumo de alcance:

## Caminho de navegação (AC-F1)

Kanban/Operação → card de OS → menu "Abrir no Auvo" (`AbrirOsAuvoModal.tsx`, já existente) →
preview → campo "Motivo da abertura manual (contingência auditada)" (novo) → "Confirmar
abertura". Capacidade `execucao.contingencia_auvo` precisa de concessão explícita (mesmo padrão
E01-S170) — sem ela, o servidor recusa com `sem_acesso` mesmo que o botão apareça habilitado no
preview (preview não checa a capacidade de contingência, só a confirmação).

## Flags (AC-F2)

Nenhuma `VITE_SSO_*` nova — o modal `AbrirOsAuvoModal` já existe e está sempre ativo; a mudança é
só a exigência adicional no servidor (capacidade + motivo), não um recurso gated por flag de
frontend.

## "Disponível, não ativado" (AC-F3)

N/A — não há gate de banco fechado por padrão aqui (a capacidade nova é concedida
individualmente, não um gate on/off). Quem não tem a concessão recebe erro nomeado
("Sem capacidade de contingência Auvo para este Cliente"), nunca tela em branco.

## Gate novo (AC-F4)

Nenhum gate de banco novo nesta story — `execucao.contingencia_auvo` é capacidade (concessão
individual), não gate. Reverso: ver cabeçalho da migration 1855.

## Linha de ativação (AC-F5)

Falta conceder `execucao.contingencia_auvo` pra quem hoje usa "Abrir no Auvo" em produção —
sem a concessão, o caminho manual fica indisponível (nenhuma OS nova sai por ali), o que é
correto por design (é contingência, não fluxo normal) mas precisa de decisão humana sobre quem
recebe a concessão antes do primeiro uso real.

## Achados e SPEC_DEVIATION

Ver ADR-1694: AC-1 a AC-8 (mecânica T−24) confirmados por leitura, não reproduzidos em teste
próprio desta story (a mecânica já tem cobertura da E01-S168); AC-11 (monitor de exceções) só
parcial (contingência consolidada; Visita não confirmada/falha de envio/tarefa órfã não têm
consulta consolidada em lugar nenhum do sistema, achado novo, registrado pra continuação).
