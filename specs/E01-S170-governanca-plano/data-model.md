# Data Model — E01-S170

## Aggregates and Constraints

Concessão de capacidade vincula usuário/perfil, ação e escopo Cliente; perfis acumuláveis reutilizam grupos. Gestão de Plano tem concessão individual específica; política de autoaprovação permite criador quando possui concessão. Capacidade é checada com estado atual no servidor. Evento auditável append-only inclui motivo, ator, antes/depois e correlação. Técnico não ganha acesso SSO.

## State and history

### US1 — Configurar e aplicar capacidades atuais

- AC-1: Dado usuário com escrita PCM mas sem capacidade crítica, quando chamar ação diretamente, então servidor nega e UI oculta/desabilita; perfil/acesso de módulo isolado não autoriza ação.
- AC-2: Dado Administrador, quando conceder/revogar perfil/capacidade por usuário e escopo, então permissões atuais governam novas ações inclusive com sessão antiga; configurações são editáveis e acumuláveis, sem nomes fixos.
- AC-3: Dado Cliente, Compras, Comercial, Financeiro, Supervisor e PCM, quando acessar, então cada um vê apenas campos/ações/Clientes autorizados; técnico segue somente Auvo, e custo/margem não aparecem para Cliente.

### US2 — Gerir Plano e validar execução conforme decisão do Fabrício

- AC-4: Dado planejador com permissão específica de gestor atribuída individualmente, quando aprovar próprio Plano, suspender/encerrar ou autorizar cancelamento, então ação é permitida e auditada; sem concessão é negada.
- AC-5: Dado supervisor ou operador PCM com permissão de validação, quando validar/rejeitar/reabrir execução, então registra decisão, evidências verificadas, observação e motivo de devolução/reabertura.
- AC-6: Dada auditoria, quando tentar alterar/excluir evento inclusive com service_role, então operação é negada; ações críticas guardam ator/data/motivo/antes/depois/correlação.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
