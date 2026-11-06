---
name: "docs-adr-1060-limites-estruturais-xlsx-incremental-md"
description: "Documento Sinérgica SO: ADR-1060 — Limites estruturais do leitor incremental XLSX"
alwaysApply: false
---

# ADR-1060 — Limites estruturais do leitor incremental XLSX

**Status:** preparação isolada, não homologada. Complementa ADR-0940/0941.

O leitor SAX limita profundidade XML a 128 e elementos a 2.000.000 por parte, além dos limites existentes de bytes, linhas, colunas e células. O acúmulo de trechos de uma célula é limitado durante a leitura, antes de concatenar, a 4.000 unidades de texto e 10.000 trechos. Planilhas que ultrapassarem esses limites estruturais serão rejeitadas explicitamente, mesmo que ainda estejam dentro do limite de células; não há truncamento silencioso.

Esses limites não demonstram orçamento de CPU/memória ou equivalência com o leitor anterior, nem fornecem isolamento por requisição. O parser continua fora da rota operacional; a incompatibilidade de Worker no Edge permanece. Testar arquivos originais, ricos, profundos, comprimidos e adversariais, concorrência, cancelamento e runtime real antes de qualquer integração ou liberação.
