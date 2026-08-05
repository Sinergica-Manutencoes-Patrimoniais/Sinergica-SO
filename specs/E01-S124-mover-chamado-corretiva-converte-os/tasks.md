---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Mover Chamado (Solicitação) para Corretiva converte em OS

> Tier pequeno (fix + reuso do fluxo de conversão). Code-only. Cuidado: não quebrar o drag de OS
> reais já existentes. Verificar a interação com E01-S125 (Planejamento pergunta Auvo).

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Roteador de drop: se `ehCardChamadoAberto(id)` → conversão (Gerar OS no status destino); senão troca de status normal | AC-1 | — | typecheck | todo |
| 2 | Application: `gerarOsDoChamado(chamadoId, statusDestino)` reusa fluxo de E01-S118; mapeia coluna→status | AC-1 | 1 | vitest | todo |
| 3 | Feedback: OS aparece na coluna destino após refetch; erro de conversão exibido (não engolido) | AC-2,AC-3 | 2 | typecheck | todo |
| 4 | Guardas: só-leitura não converte (AC-4); drop na própria coluna = no-op (AC-borda) | AC-4 | 1 | vitest | todo |
| 5 | Destino Backlog usa caminho GUT obrigatório (E01-S94); destino Planejamento aciona E01-S125 | AC-borda | 1 | typecheck | todo |
| 6 | e2e: arrastar Chamado da Solicitação pra Corretiva vira OS real com mesmo CH | AC-1 | — | playwright (Lucas) | todo |

## Plano de teste
- Unidade: roteamento drop (sintético vs OS real); mapa coluna→status; guarda de permissão.
- Aceite: Playwright — card na Solicitação → Corretiva → some sintético, aparece OS real; falha volta o card.

## Riscos
- Não converter acidentalmente uma OS real ao arrastar (só cards `chamado-aberto:` convertem).
- Concorrência: dois drops do mesmo Chamado → idempotência da conversão (Chamado já convertido não duplica OS).

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas) — este é o sintoma reportado, testar de verdade
- [ ] ROADMAP.md + STATE.md atualizados
