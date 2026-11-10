---
name: "docs-adr-0930-validacao-antecipada-referencias-xlsx-md"
description: "Documento Sinérgica SO: ADR-0930 — Referências da aba XLSX antes do DOM experimental"
alwaysApply: false
---

# ADR-0930 — Referências da aba XLSX antes do DOM experimental

## Contexto

A validação do leitor de cronograma acontece depois da construção do DOM. Uma aba compacta pode conter grande quantidade de linhas ou células inválidas e esgotar a memória antes que as regras existentes sejam aplicadas. ADR-0929 rejeita filhos inválidos de `sheetData`, mas não valida referências de linhas e células antecipadamente.

## Decisão

No processador Edge experimental, validar incrementalmente as referências de linhas e células diretas antes de construir o DOM: linha entre 1 e 10000, uma ocorrência por número de linha, célula pertencente à linha, coluna até 500, referência única e máximo de 100000 células. Os limites de linha, coluna e célula já são usados pelo leitor; a unicidade de linhas impede documentos ambíguos que repitam o mesmo índice. Não se altera o formato de saída nem se conecta o endpoint ou se abrem gates.

## Limites e rollout

Isto não garante limite de memória para todos os XML válidos ou para outros documentos do arquivo, nem substitui parser incremental completo e isolamento. Antes de liberar, validar compatibilidade com os arquivos de origem, documentos adversos, limites do runtime e revisão adversarial. O comportamento para linhas duplicadas muda para rejeição explícita. Reverter o código experimental e este ADR por nova decisão, mantendo o gate fechado.
