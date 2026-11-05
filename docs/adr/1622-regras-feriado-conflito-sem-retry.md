# ADR 1622 — Revisão de regra e decisão de feriado

Status: aceito para implementação; homologação pendente.

As guardas explícitas de revisão na criação e alteração de regra contratual e na decisão de feriado por calendário usam `P0018` em vez de `40001`. São conflitos de negócio, não erros reais de serialização. As funções mantêm autorização, replay e operações anteriores; os consumidores devem atualizar o contrato de erro em conjunto. A tela de decisão de feriado distingue rejeição inicial comprovada de replay incerto.
