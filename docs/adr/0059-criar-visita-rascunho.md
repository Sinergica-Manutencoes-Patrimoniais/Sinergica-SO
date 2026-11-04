# ADR-0059 — Criação de Visita em rascunho

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

A criação inicial de Visita é um comando atômico, sem OS ou equipe, protegido pela capacidade atual `visita.confirmar` e escopo do Cliente. É uma política conservadora para o incremento inicial: não concede capacidade automaticamente nem pretende substituir a futura distinção entre planejar, visualizar e confirmar. Recebe requestId, revisão esperada zero, identidade, janela UTC, fuso, natureza e vínculos opcionais; posição e contrato são conferidos no banco. Resultado idempotente e auditoria são gravados na mesma transação.

Criar rascunho não confirma Visita, não gera Ocorrência, não cria tarefa e não envia Auvo. Modificação, equipe, associação, ciência e confirmação continuam dependentes de comandos e testes específicos. O Cliente recebido é verificado contra a concessão e os vínculos reais; token ou UI não bastam como autoridade.
