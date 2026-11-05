# ADR-1634: conflito de revisão na transição de Plano

## Contexto

Suspensão, encerramento e retomada rejeitam revisão desatualizada com `40001`, código também usado para falhas reais de serialização. A chamada mediada por PostgREST repetia a transação e não respondia dentro de sete segundos em ensaio isolado de suspensão.

## Decisão

Alterar somente a guarda explícita `revisao_obsoleta` dos dois núcleos privados para `P0011`. A autorização e o replay permanecem anteriores à guarda, e as demais falhas de serialização permanecem inalteradas. A interface só descarta pedido na primeira rejeição específica; após tentativa incerta preserva o identificador e o payload para replay.

## Consequências

O cliente pode reconferir a revisão após rejeição definitiva sem tratar falhas reais de serialização como conflito de negócio. Não modifica gates, permissões, histórico ou integrações externas.
