# ADR-0039 — Fundação aditiva do Plano de Manutenção

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

`pcm.planos_preventivos` legado mantém um alvo por plano e possui ocorrências próprias. Para representar o Plano amplo da ADR-0026 sem modificar identidades ou materializar operações, `pcm.planos_manutencao` inicia com identidade, Cliente, nome, estado e revisão. Versões e Rotinas serão acrescentadas por migrations posteriores; este rascunho vazio não é aprovável nem gera ocorrências, OS, tarefas ou outbox. Legado não é convertido automaticamente e eventual ponte exige origem comprovada.

O comando transacional de rascunho exige `plano.gerir` individual e atual, com escopo do Cliente, revisão, `requestId` e auditoria. Escrita direta é negada; repetição não duplica eventos, e autorização atual continua obrigatória. Enquanto a política de leitura mais ampla não estiver integrada e testada, a leitura direta desta fundação limita-se aos gestores autorizados: não considerar AC de consulta de outros perfis concluído. RLS FORCE e contratos são aditivos. Integração com S170/S176, versões, Rotinas, migração de legado e revisão adversarial permanecem gates antes de PASS ou publicação.
