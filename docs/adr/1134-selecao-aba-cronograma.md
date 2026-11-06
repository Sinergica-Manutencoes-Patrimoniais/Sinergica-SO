---
name: "docs-adr-1134-selecao-aba-cronograma-md"
description: "Documento Sinérgica SO: ADR-1134 — Seleção da aba na leitura incremental do cronograma"
alwaysApply: false
---

# ADR-1134 — Seleção da aba na leitura incremental do cronograma

Status: proposta local, não homologada.

O leitor experimental faz duas passagens pelo mesmo arquivo copiado. Na primeira, valida todas as entradas ZIP e retém somente livro e relacionamentos; identifica a aba CRONOGRAMA pelas relações OOXML. Na segunda, valida novamente todas as entradas e retém somente a aba selecionada e as strings compartilhadas. Nenhum resultado parcial é persistido.

Isso reduz a retenção simultânea de abas não usadas, mas aumenta descompressão e CPU; não é garantia de teto de memória ou tempo, não substitui isolamento e não autoriza receber arquivos de usuários. Entrada comprimida, XML, células e matriz ainda são materializados. Manter endpoint e gates fechados até medir tempo e pico de memória, comparar os leitores e fontes originais, testar ZIP/XML adversarial e cancelamento, e concluir revisão adversarial.
