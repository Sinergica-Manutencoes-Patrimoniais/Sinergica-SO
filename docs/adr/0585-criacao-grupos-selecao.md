# ADR-0585 — Criação selecionada de Grupos Quantitativos

Status: proposta; gate fechado, não homologada.

Até 50 linhas são selecionadas explicitamente, com retrato, Local, categoria, Sistema opcional, quantidade e revisão de código em staging. O comando canônico 0397 valida Cliente, hierarquia, aprovação e duplicidade. Atributos não suportados são recusados. Nenhum código individual é atribuído; linhas que informam código permanecem bloqueadas para não perder dados.

A transação é integral, com resultados individuais e retry idempotente. O GUC de supressão de sincronização é mantido durante a operação, mas todos os gatilhos e a ausência de efeitos externos exigem revisão e teste integrado. Gate e RPC permanecem fechados; interface e homologação pendentes.
