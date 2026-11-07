---
name: "docs-adr-1175-inicio-efeito-t24-md"
description: "Documento Sinérgica SO: ADR-1175 — Início único do efeito T−24"
alwaysApply: false
---

# ADR-1175 — Início único do efeito T−24

Status: proposta local, não aplicada nem homologada.

Preparar comando privado de serviço que, na mesma transação, confere gate de execução, reserva não expirada, outbox, fence, janela, ator atual, confirmação e ciência, além de fontes atuais por protocolo. Após essas conferências, registra evento imutável de início e retira a reserva. A primeira resposta pode autorizar uma única tentativa do executor; repetição do requestId devolve `autorizaEnvio=false`. Se a resposta for perdida, o efeito é incerto e deve seguir para reconciliação, nunca novo POST automático.

O gate nasce fechado; função não recebe EXECUTE nem é chamada por worker. Sua ativação exige prova do contrato Auvo e isolamento de todos os escritores legados. Mudanças após o início, callbacks tardios, cancelamento e falha de rede exigem reconciliação; transação de banco não pode segurar lock durante HTTP. Validar ordens de locks, todas as fontes e gates, permissões, relógio, precisão, RLS/FORCE, concorrência e revisão adversarial antes de qualquer liberação.
