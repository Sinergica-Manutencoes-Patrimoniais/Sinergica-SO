# Data Model — E01-S176

## Aggregates and Constraints

Preservar pcm.areas/locais/equipamentos/sistemas/sistema_itens. parent_item_id é pai recursivo mesmo Cliente, sem ciclo nem autoparente; Componente continua em no máximo um Sistema vigente. Grupo Quantitativo identifica categoria/nome, Local, quantidade positiva e atributos, sem individualizar TAG por unidade. Sistema distribuído lista Locais dos membros e vínculos funcionais; mover membro não redefine identidade.

## State and history

### US1 — Modelar ativos e grupos preservando estrutura

- AC-1: Dada árvore Cliente/Área/Local/filhos, quando cadastrar/mover, então preserva níveis flexíveis e separa posição física da composição funcional; mantém nomes UI Componentes/Sistemas e códigos existentes.
- AC-2: Dado pai/filho, quando salvar, então exige mesmo Cliente e rejeita ciclo/autoparente no servidor inclusive em concorrência; mantém histórico de movimentação e exclusão lógica.
- AC-3: Dado grupo de 20 luminárias homogêneas, quando cadastrar, então é um Grupo por Local com quantidade, características e histórico, sem vinte TAGs ou cadastros remotos individuais.

### US2 — Navegar por Sistema e por Local

- AC-4: Dado Sistema distribuído, quando compor, então reúne membros de Locais diferentes do mesmo Cliente e cada membro tem no máximo um Sistema vigente; segundo vínculo é rejeitado.
- AC-5: Dado Local, quando abrir detalhe, então lista Componentes individuais e Grupos agrupados por Sistema/tipo, com fotos, quantidade, breadcrumb e acesso a histórico.
- AC-6: Dado Sistema/ativo, quando abrir detalhe, então mostra árvore funcional, Locais atendidos, composição, identificação, completude, criticidade/atributos técnicos e vínculos de Planos/OS/Pendências já disponíveis; fonte inexistente tem vazio explícito.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
