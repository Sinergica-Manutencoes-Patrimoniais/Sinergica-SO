# Data Model — E01-S177

## Aggregates and Constraints

Registro de código associa tipo/UUID do ativo, código atual ou alias e reserva única no namespace de códigos públicos. Lock de identidade registra aprovação/sync/etiqueta/referência OS (qualquer um trava). Substituição gera código atual e alias anterior na mesma transação; motivo/ator/data obrigatórios. Política Equipment por categoria/natureza é configurável; vínculo remoto existente é preservado.

## State and history

### US1 — Proteger identidade a partir do primeiro uso

- AC-1: Dado rascunho nunca usado, quando ajustar código, então valida formato/unicidade e permite; aprovação, sync, etiqueta ou OS tornam edição comum proibida no servidor e UI.
- AC-2: Dado ativo protegido, quando renomear/mover, então UUID e código não mudam; registro legado com prova de uso é protegido sem criar novo ativo.
- AC-3: Dado código atual ou alias de outro ativo, quando reservar/criar, então impede colisão inclusive em concorrência e preserva códigos legados sem renumeração em massa.

### US2 — Corrigir excepcionalmente e sincronizar só onde necessário

- AC-4: Dado administrador autorizado com motivo, quando substituir, então cria código substituto e alias anterior atomicamente, guarda ator/data/motivo e ambos localizam o mesmo ativo/histórico.
- AC-5: Dado QR repetido ou reimpressão, quando consultar, então resolve mesmo Sistema/ativo; código antigo não é apagado nem reciclado e falha de sync mostra pendência de reconciliação.
- AC-6: Dada política por categoria, quando sincronizar, então Sistema é Equipment Auvo, Componentes/Grupos normalmente ficam só no SO e equipamentos controlados sincronizam quando configurado; vínculos externos já existentes são preservados e não excluídos automaticamente.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
