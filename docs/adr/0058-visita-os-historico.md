# ADR-0058 — Fundação aditiva de Visita e associação de OS

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

Visita é agregado próprio, sem substituir `pcm.agenda_tecnico` ou alterar identidade de `pcm.ordens_servico`. Guarda Cliente, posição física, janela UTC, fuso IANA, natureza, estado e revisão. Contrato e Área usam chaves compostas ao Cliente; Local é conferido contra a Área no cadastro. Mudança posterior de Local dentro do mesmo Cliente preserva a Área histórica da Visita; movimento para outro Cliente é bloqueado enquanto houver referência. Identidade de Visita e Cliente não mudam.

Associação OS–Visita conserva histórico, exige que ambas pertençam ao mesmo Cliente por chaves compostas e permite no máximo uma associação vigente por OS. Encerramento registra data, responsável e motivo; vínculo encerrado e exclusões são imutáveis. Nenhuma associação ou mudança gera envio Auvo neste incremento. Índices/constraints adicionais em tabelas legadas exigem avaliação de locks, volume e compatibilidade antes de produção.

A leitura inicial é limitada a `visita.confirmar` no Cliente e não implica concessão automática. Escrita direta permanece fechada até existirem comandos autorizados e auditados. Equipe, confirmação, regras de transição, vínculo com calendário e controle de intenção externa serão implementados em etapas próprias; não tratar a estrutura como homologação da story.
