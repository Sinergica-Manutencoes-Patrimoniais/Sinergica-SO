# ADR-1219 — Paginação separada do histórico pré-OS

## Decisão

Aplicar ao histórico pré-OS a separação de orçamentos e decisões do ADR-1218, com entradas e gate próprios. Cada orçamento deve estar sem OS e vinculado a uma requisição do Cliente; as decisões são consultadas apenas após conferir orçamento e requisição atuais. Não são expostos custos ou itens e não há reemissão.

As consultas são independentes, não snapshot. Se o orçamento ganhar OS ou mudar de Cliente entre chamadas, a leitura pré-OS pode ser recusada; nenhum vínculo é presumido.

## Gates

Manter flag e gate fechados até testes de isolamento, RLS/FORCE, autorização/revogação, vínculo da requisição, múltiplas decisões, paginação concorrente e revisão adversarial.
