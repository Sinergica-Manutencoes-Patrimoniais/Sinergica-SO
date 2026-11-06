# ADR-0042 — Referência do tempo da Rotina

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

Tempo estimado mantém minutos e referência explícita `total` ou `por_unidade`; referência ausente significa não validada, sem inferência a partir do alvo. A edição nova grava valor e referência na mesma transação e inclui ambos na identidade do pedido/auditoria. Tempo zero/ausente segue pendente; positivo sem referência também não pode ser usado para validar capacidade.

O comando anterior mantém compatibilidade: se não mudar o valor, preserva referência existente; se mudar o valor sem informá-la, limpa a referência para impedir pressuposição. Pedidos anteriores mantêm formato e resultado idempotente. A sentinel de compatibilidade fica em função interna não executável pelo cliente. Nenhuma referência é preenchida retroativamente. Aprovação, cálculo de capacidade e migração de dados continuam sujeitos aos seus gates.

Respostas idempotentes gravadas antes do aviso `tipo_tempo_a_validar` mantêm seu resultado histórico. Consumidores não podem tratar ausência desse aviso antigo como validação: devem consultar os dados atuais e exigir referência explícita.
