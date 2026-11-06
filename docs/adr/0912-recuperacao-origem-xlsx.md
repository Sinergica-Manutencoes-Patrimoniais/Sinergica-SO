# ADR-0912 — Recuperação de origem XLSX após perda de IDs locais

Data: 2026-10-30 · Status: preparação, gate fechado.

O staging já impõe unicidade por Cliente, tipo e identificação da origem; arquivo idêntico não deve criar lote paralelo. Para recuperar uma tentativa em outro dispositivo ou após perda de armazenamento local, oferecer consulta restrita por Cliente e fonte, com autorização atual, gates de mediação e origem, e mesma trava transacional por origem usada na recepção. A consulta retorna apenas ID do lote, revisão e hash para confronto, sem bytes, matriz, request anterior ou identidade de terceiros. Origem legada ou CSV sem custódia XLSX retorna estado de reconciliação, não deve ser reinterpretada automaticamente.

Resposta ausente não reserva a origem: a recepção canônica continua a arbitrar concorrência e conflitos. Outro ator não reutiliza request alheio; qualquer continuação com novo request deve passar pelas regras do comando e autorização de banco. Hash igual é indicação de conteúdo, não aprovação ou execução. Gate permanece fechado; rollback é revogar acesso à nova função e manter as entradas existentes intactas. Testar transações concorrentes, autorização real e revisão adversarial antes de ativar.
