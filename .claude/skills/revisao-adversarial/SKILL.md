---
name: revisao-adversarial
description: Use antes de dar PASS em story de tier arquitetural (schema em produção, integração externa, RLS, financeiro) — assume que a feature está quebrada e tenta provar. Gate verde prova o caminho feliz, não a correção. Acione com /revisao-adversarial.
---

# /revisao-adversarial

Assuma que a feature está **quebrada** e tente provar. Leia `spec.md` (AC-N), `tasks.md` e o diff da branch
(`git diff origin/main...HEAD`). Não elogie; liste só achados.

## Ataque, nesta ordem
1. **Borda:** vazio, nulo, muito grande, unicode, datas/fuso, dinheiro em centavos, paginação na última página.
2. **Erro parcial:** falha no meio (rede, timeout, Auvo/Evolution/OpenRouter fora) — fica estado inconsistente? Há retry idempotente (`request_id`/`externalId`)?
3. **Concorrência:** duas sessões/requests juntos, duplo clique, webhook repetido/fora de ordem, corrida em contador ou sequência.
4. **Segurança/abuso:** usuário de outro tenant/papel lê ou escreve? RLS FORCE + pgTAP negado existe? `service_role`/segredo vazando? input sem Zod? HMAC de webhook? PII em log?
5. **Buraco na spec:** caso que nenhum AC-N cobre; "fora de escopo" invadido; `SPEC_DEVIATION` silencioso.
6. **Performance:** query sem índice em tabela grande, N+1, lista sem paginação, `useEffect` buscando dado de servidor (deve ser TanStack Query).
7. **Migration:** aditiva? reversível? quebra o código que ainda está em produção durante o deploy?

## Saída
Uma linha por achado: `arquivo:linha — severidade (alta/média/baixa) — problema — como reproduzir`.
Achado **reproduzido** vira teste que falha e volta ao dev; não reproduzido vira "hipótese", não bloqueia.
Sem achado alto/médio aberto = PASS. Registre o resultado em 3 linhas no PR.
