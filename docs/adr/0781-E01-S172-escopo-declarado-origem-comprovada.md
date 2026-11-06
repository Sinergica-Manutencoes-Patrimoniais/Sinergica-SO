---
name: "docs-adr-0781-e01-s172-escopo-declarado-origem-comprovada-md"
description: "Documento Sinérgica SO: ADR-0781: declaração versionada de escopo com origem comprovada"
alwaysApply: false
---

# ADR-0781: declaração versionada de escopo com origem comprovada

Status: preparação interna, gates fechados, sem homologação.

## Contexto

A demanda efetiva depende de origem e escopo restantes, mas vínculos não demonstram execução ou equivalência de quantidades. O resolvedor 0726 valida univocidade da origem legada, Cliente, alvo, snapshot e, se aplicável, origem contratual da Visita. Propostas S167 e seus minutos restantes têm semântica própria e não podem ser reescritos ou automaticamente convertidos para HH.

## Decisão

Para OS com origem legada resolvida por 0726, registrar declarações versionadas append-only de texto de escopo declarado como executado e/ou restante, além da referência verificada pelo resolvedor e justificativa. A revisão e o requestId são concorrentes e idempotentes; alterações geram nova versão, não atualizam eventos anteriores. O rótulo é declaração humana, não confirmação de execução, quantidade, horas restantes ou equivalência OS/ocorrência. Não atualiza OS, Chamado, ocorrência, status, tarefa ou contagem de demanda.

O comando interno exige gates próprios e do resolvedor, autorização atual `execucao.validar`, trava de autorização 0319 em READ COMMITTED, alvo e Cliente conferidos, revisão esperada e auditoria na mesma transação. O resolvedor valida a origem; o consumidor deve usar sua identidade, sem deduplicar por data ou alvo. Nenhum EXECUTE ou escrita direta é concedido aos papéis de aplicação.

## Limites

OS sem origem resolvida e Grupo Quantitativo não são cobertos por esta primeira fatia. Textos declarados não comprovam execução ou esforço restante, nem tornam seguro somar demanda. UI, homologação, reconciliação com S167, estado de execução, fontes de Grupo/Visita, calendário programado e validação concorrente permanecem pendentes. Nenhum gate deve ser aberto antes de testes completos e revisão adversarial.
