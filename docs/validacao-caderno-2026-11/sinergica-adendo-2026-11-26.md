# Adendo de validação — 26/11/2026

- CT-23: em INSP-0044 do Escritório, filtro Equipamentos exibiu só primeiro item, Elétrico só segundo, Todos recuperou ambos com Não conforme / No backlog. Busca INSP-0044 não encontrou, mas campo informa busca por cliente ou título; não registrado como defeito.
- CT-38: com Superadmin, Lançamentos abriu e Novo lançamento exibiu Status Realizado por padrão; formulário foi cancelado sem gravar. Ciclo permanece sem execução; caderno exige competência aberta e valor combinado.
- CT-02 depende de credenciais válidas de teste e CT-04 de Operador PCM e Financeiro; sessão atual não prova essas condições.
- DEF-10: apuração inconclusiva; relatório e repasse no Desktop retornam TimeoutError 60 na leitura, inclusive para agentes. Não há evidência para afirmar salto nem perda.

- **CT-49 — Bloqueado: canal e contato Instagram de teste ausentes.** Em Atendimento > Config > Instagram, a tela informa 0 conexões e ‘Nenhuma conexão de Instagram configurada ainda’. As abas Messenger e Meta WA também têm nomes e estados vazios distintos, cada uma com 0 conexões. Passo 1 conferido; os testes de mensagem vazia, limite de bytes, janela e entrega não foram executados. Nenhuma conexão adicionada ou mensagem enviada. Sessão Superadmin; perfil Atendimento não validado.
