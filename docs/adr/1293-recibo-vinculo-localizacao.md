# ADR 1293 — Recibo do vínculo de localização

## Contexto

Uma resposta perdida após vincular localização existente deixa tentativa incerta. É necessário consultar o resultado sem criar outro vínculo.

## Decisão

Oferecer leitura do recibo ao ator original, sob o gate de vínculo e capacidade atual no Cliente do lote. Comparar requestId e payload integral e conferir que a incorporação aponta para a mesma entidade. Não repetir escrita nem retornar outros comandos. Ausência de recibo, inclusive durante commit, não prova falha.

## Implantação e retorno

Migration aditiva e flag desligada; desativar a flag para retorno. Preservar comandos e histórico. Validar canonicalização, permissão e revogação, transferência de lote, concorrência de commit, privacidade, RLS/FORCE, recuperação fora da linha e revisão adversarial antes de ativar.
