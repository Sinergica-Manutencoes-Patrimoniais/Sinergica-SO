# ADR 1285 — Diagnóstico de ancestral ausente no levantamento

## Contexto

A conferência paginada de hierarquia identifica pai direto ausente, mas não identifica, na linha descendente, uma referência ausente em um ancestral presente no mesmo lote. Isso pode dificultar a revisão pelo PCM. Referências são chaves temporárias do lote; não provam identidade de cadastro oficial.

## Decisão

Adicionar uma consulta versionada que reutiliza a autorização, o gate, a revisão e a paginação da consulta mediada existente e complementa seus alertas com `ancestral_nao_encontrado_no_lote`. A nova consulta não altera lote, aprovação, códigos ou cadastros. O consumidor usa a versão nova apenas sob flag de interface desligada por padrão. A consulta antiga continua intacta para clientes anteriores.

O alerta não afirma que o ancestral esteja ausente da estrutura oficial. Ciclos e cadeias extensas mantêm seus alertas existentes; uma página não representa fotografia de páginas anteriores. Não ampliar privilégios da consulta original.

## Implantação e retorno

Aplicar primeiro a migration aditiva; manter a nova flag desligada até testes de autorização, revisão, paginação, ciclos, concorrência e volume. Depois habilitar a interface compatível. Para retorno, desligar a flag: a consulta antiga permanece disponível. Não remover dados ou funções existentes. Revisão adversarial e homologação continuam obrigatórias.
