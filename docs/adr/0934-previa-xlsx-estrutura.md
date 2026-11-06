# ADR-0934 — Prévia de planilha estruturada para levantamento

Status: preparação local, sem integração, testes ou habilitação.

## Decisão

Preparar conversão das células OOXML já extraídas de uma aba escolhida explicitamente para o mesmo diagnóstico usado pelo modelo CSV de estrutura. O cabeçalho deve corresponder ao modelo, fórmulas e erros não são interpretados, identificadores e códigos numéricos são recusados para não perder zeros, e conteúdo fora das colunas ou limite do lote é recusado. Linhas e atributos continuam sujeitos à conferência PCM; a conversão não grava nem aprova cadastro.

## Limites

Esta preparação não processa arquivos diretamente, não escolhe aba por suposição, não prova o vínculo entre arquivo e matriz e não controla recursos do parser de XML. Antes de conectar à interface ou persistência, exigir extração e interpretação isoladas com limites, guarda da origem, testes adversariais, autorização e revisão adversarial. O fluxo CSV existente e os gates não são alterados.
