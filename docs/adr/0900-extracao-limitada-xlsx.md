---
name: "docs-adr-0900-extracao-limitada-xlsx-md"
description: "Documento Sinérgica SO: ADR-0900 — Extração experimental e limitada de XLSX"
alwaysApply: false
---

# ADR-0900 — Extração experimental e limitada de XLSX

Data: 2026-10-30 · Status: preparação; não ativar importação.

Preparar extração em memória usando `@zip.js/zip.js` 2.24.0, fixado localmente. Aplicar limites independentes ao arquivo comprimido, número de entradas, bytes por entrada e total efetivamente emitido; não confiar nos tamanhos declarados. Validar caminhos canônicos, entradas duplicadas, criptografia, métodos de compressão e opções de verificação de assinatura, sobreposição e cabeçalhos. Interromper quando limite for excedido e rejeitar o pacote inteiro. Não gravar arquivos extraídos em disco nem acionar rede ou staging.

A biblioteca permite saída por stream e verificação de cabeçalhos, mas isso não prova segurança global. O leitor deve ser executado em worker terminável com limite de tempo antes da integração à UI. Falhas de CRC, ZIP64, bombas, cabeçalhos divergentes e cancelamento exigem testes reais no navegador e revisão adversarial. Antes de liberar, conferir avisos da versão e comportamento de memória do codec; rollback consiste em não utilizar a função e manter o gate fechado. Nenhum arquivo de usuário é transportado ou persistido nesta etapa.
