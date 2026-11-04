# ADR-0935 — Seleção explícita de aba de levantamento

Status: preparação local, não integrada ou homologada. Complementa ADR-0934.

## Decisão

Preparar leitura dos metadados de abas visíveis e, mediante nome explicitamente escolhido, uma prévia de estrutura com o digest dos bytes originais. A extração reutiliza o worker limitado existente; a seleção não escolhe a primeira aba automaticamente. A saída é somente diagnóstico, sem recepção ou aprovação de lote.

## Limites

A interpretação XML ainda é feita na thread principal, portanto cancelamento não interrompe seu processamento e um arquivo hostil pode esgotar recursos. O digest não comprova equivalência da matriz enviada ao servidor. Não conectar esta preparação a arquivo de usuário ou habilitar importação até isolamento completo, comprovação de recursos, verificação de proveniência, testes e revisão adversarial. Descartar a preparação não afeta arquivos nem registros.
