# ADR-0112 — Substituição administrativa e proteção transitória de código

## Estado

Proposta não homologada; complementa ADR-0110. Migration 0332 não aplicada; ativação bloqueada até conciliação, testes de banco e revisão adversarial.

## Decisão

Serializar reservas de código e impedir alteração direta de códigos atuais em Sistemas e Componentes. Novo comando restrito a superadmin com capacidade `codigo.substituir`, motivo, identidade da requisição e código anterior conferido cria alias anterior, muda código e audita na mesma transação. Repetição exige permissão atual e retorna resultado idêntico; conteúdo divergente conflita. A guarda compara códigos normalizados para evitar variantes concorrentes, mas não altera nem normaliza os códigos existentes.

## Limites e gates

Guarda bloqueia inclusive edição de rascunho até existir prova confiável dos marcos de uso: é medida transitória conservadora, não satisfaz AC-1. Conflitos legados impedem substituir código afetado e devem ser resolvidos sem renumeração automática. Validar ordem de locks e deadlocks, RLS/revogação, formato e interoperabilidade Auvo, cliente e referências cruzadas, replay e rollback. Clientes que escrevem códigos devem ser migrados antes de qualquer implantação; guardas podem quebrar sincronização e cadastro legados. Falta política por categoria, Grupo Quantitativo, emissão/QR e identificação de uso. Sem envio ao Auvo ou rollout nesta etapa.
