---
name: "docs-planejamento-plano-manutencao-avaliacao-leitura-xlsx-segura-md"
description: "Documento Sinérgica SO: E01-S169 — avaliação de leitura XLSX no navegador"
alwaysApply: false
---

# E01-S169 — avaliação de leitura XLSX no navegador

Avaliação em 30/10/2026. A entrada CSV existente continua disponível para conferência local; XLSX ainda não está liberado. Não foi adicionada dependência nem alterado o fluxo de aprovação.

## Evidências

- O leitor legado carrega SheetJS `xlsx@0.18.5` por CDN e está proibido por SEC-008. Os avisos [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) e [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) incluem essa versão. Não reutilizá-la.
- [read-excel-file](https://github.com/catamphetamine/read-excel-file) oferece leitura local no navegador, licença MIT e usa `fflate` para ZIP. A documentação consultada não demonstra limite verificável de bytes descompactados antes de alocá-los. O [CVE-2026-45820](https://github.com/advisories/GHSA-px8p-9vwx-vf98) afeta versões de `fflate`; qualquer adoção requer conferir a versão transitiva e seus avisos. Isso não prova que toda versão do leitor seja vulnerável.
- [ExcelJS](https://github.com/exceljs/exceljs/blob/master/LICENSE) tem licença MIT. Sua [implementação](https://github.com/exceljs/exceljs/blob/master/lib/xlsx/xlsx.js) utiliza `JSZip.loadAsync`; um [aviso publicado pelo mantenedor de um fork](https://github.com/mateocallec/exceljs-hardened/security/advisories/GHSA-7cvf-3r55-r39q) relata amplificação de recursos em `Workbook.xlsx.load`. Não se demonstrou um limite de extração adequado para entrada não confiável.
- [zip.js](https://github.com/gildas-lormeau/zip.js/blob/master/LICENSE), licença BSD-3-Clause, é candidato para extração controlada, não um leitor XLSX completo. Seus [releases](https://github.com/gildas-lormeau/zip.js/releases) incluem correções de validação de caminhos; selecionar uma versão exige nova revisão de avisos e dependências no momento da adoção.

## Critérios para implementação

Antes de habilitar XLSX, demonstrar em testes que a implementação local limita entradas e bytes efetivamente emitidos pela descompressão, por arquivo e no total; não confiar apenas nos tamanhos declarados no ZIP. Rejeitar arquivos malformados, caminhos ambíguos/duplicados e entradas excessivas; limitar tempo de execução, memória, abas, linhas, colunas e matriz final. O parser OOXML também precisa tratar com segurança XML e referências, preservar valores e distinguir fórmulas, datas e valores ausentes sem inventar resultados. A seleção de aba e a conferência permanecem explícitas, sem gravar automaticamente.

Uma opção a avaliar é `zip.js` com leitura limitada por fluxo e parser OOXML adequado, ambos fixados localmente e revisados; não há prova suficiente para instalá-los ou declarar esse conjunto seguro agora. Testar arquivos normais com múltiplas abas e zeros, limites de matriz, ZIP bomb, ZIP64 malformado, XML hostil, cancelamento e erros sem gravação. Worker, isoladamente, não estabelece limite de memória.
