---
name: biome-baseline-temporaria
description: Dívida temporária do Biome e regras para controle na CI.
alwaysApply: false
---

# Baseline temporária do Biome

A integração acumulada foi autorizada com uma baseline para evitar uma reformatação em massa. Em 2026-11-06, o Biome registrou 2.405 diagnósticos em 1.026 arquivos. A baseline não significa revisão funcional, aprovação de segurança ou homologação das stories.

A maior parte envolve formatação (1.018), elementos semânticos de acessibilidade (403), asserções non-null (357), organização de imports (256) e templates de string (187). Há também alertas de acessibilidade, correção e código suspeito; devem ser triados, não tratados como simples formatação. Os diagnósticos completos podem ser obtidos com `pnpm exec biome check . --max-diagnostics=100000`.

`scripts/biome-baseline.json` associa cada arquivo com dívida ao hash do seu conteúdo e aos identificadores dos diagnósticos. A CI executa `node scripts/biome-baseline.mjs`: qualquer diagnóstico novo, alteração em arquivo que ainda tenha dívida, relatório incompleto ou falha de execução reprova o gate. Arquivos totalmente corrigidos saem automaticamente da comparação. A verificação cobre o repositório na mesma configuração do Biome anterior, substituindo também o lint duplicado dos pacotes afetados.

Antes de alterar um arquivo da baseline, corrija seus apontamentos. Excepcionalmente, quando não for viável, uma atualização explícita por `node scripts/biome-baseline.mjs --write-baseline` deve acompanhar justificativa e revisão da diferença; atualizar a baseline pode aceitar dívida nova, portanto não é correção automática. Reduzir a dívida em lotes e retirar esta exceção são trabalhos pendentes.

Esta exceção não dispensa CI, revisão arquitetural, confirmação do histórico e backup das migrations, nem autoriza deploy ou tarefas reais no Auvo.
