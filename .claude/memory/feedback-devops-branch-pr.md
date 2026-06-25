---
name: feedback-devops-branch-pr
description: NUNCA fazer push direto para main — sempre branch → PR → merge via @devops
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f5f215d0-bb44-4034-b748-086da2842008
---

Nunca fazer `git push origin main` diretamente. O fluxo obrigatório é:

1. Criar branch descritiva (`git checkout -b feat/E0N-S0N-descricao`)
2. Fazer os commits na branch
3. Push da branch (`git push origin feat/E0N-S0N-descricao`)
4. Abrir PR via `gh pr create`
5. Merge apenas após PR aprovado

**Why:** Lucas corrigiu após push direto para main na sessão de 2026-06-25. Push direto para main bypassa code review, quebra o histórico de PRs rastreável e viola o papel do `@devops` no processo Triviaiox.

**How to apply:** Sempre que for fazer push, verificar se estou em uma branch que não seja `main`. Se estiver em `main`, criar branch antes de pushar. Isso vale mesmo para chores e fixes pequenos.
