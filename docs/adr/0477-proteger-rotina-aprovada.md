# ADR-0477 — Imutabilidade de Rotina aprovada

Status: preparado, gate desligado, não aplicado nem homologado. A revisão existente 0274 copia Rotinas para novo rascunho preservando identidade lógica; 0271 congela snapshot e 0342/0345 preparam a nova vigência. A defesa adicional, sob gate, recusa inserção, edição ou remoção de Rotina ligada a versão aprovada, inclusive mover uma Rotina para dentro ou fora dela. Rascunhos permanecem editáveis.

Não autoriza aprovação nem resolve impactos ou política de fuso. A ordem de locks com escritores legados e migrações de correção deve ser revisada; operações administrativas excepcionais exigem procedimento separado. Com gate desligado não altera comportamento. Testes de concorrência, histórico e revisão adversarial pendentes.
