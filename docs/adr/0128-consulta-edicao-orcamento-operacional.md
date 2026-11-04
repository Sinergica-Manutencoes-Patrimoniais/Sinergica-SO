# ADR-0128 — Edição contextual de orçamento operacional

## Estado

Proposta para E01-S181. A consulta e a edição permanecem bloqueadas para papéis de aplicação; não autoriza aplicação ou liberação.

## Decisão

Na OS existente, uma consulta interna projeta apenas a identidade da proposta vinculada, sua versão e a identidade e revisão da lista. Reutiliza a consulta autorizada de E01-S181 e nunca devolve custos. A interface só oferece edição de uma proposta vinculada em rascunho e passa as duas revisões ao comando preparado em 0339; nenhum identificador ou revisão é inferido ou digitado manualmente. Não cria proposta, oportunidade, OS, cobrança ou tarefa Auvo. O comando continua sem EXECUTE para papéis de aplicação e a interface depende de flag desativada.

## Gates

Antes de conceder execução: revisar permissões e revogação concorrente, RLS e todas as rotas legadas, provar isolamento de Clientes e integridade dos vínculos, retry idempotente, revisão da proposta/lista e proteção de custos. A edição não cobre criação inicial, congelamento, envio, decisão, exceção de piso ou histórico legado. Testes integrados, CI e revisão adversarial são obrigatórios antes da homologação.
