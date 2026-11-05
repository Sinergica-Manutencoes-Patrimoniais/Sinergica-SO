# ADR-1646: conflito de revisão da decisão de impacto

## Contexto

Os núcleos de decisão Calendário e Visita usam `40001` para revisão de decisão obsoleta. Esse código também identifica serialização real e pode levar a repetição automática da transação no PostgREST.

## Decisão

Trocar somente a guarda explícita `revisao_decisao_obsoleta` por `P0014`. As funções mantêm assinatura, ACL, autorização e replay anteriores à guarda. A interface trata o par código/mensagem como rejeição definitiva apenas na primeira tentativa; serialização real e pedidos incertos permanecem preservados.

## Consequências

O banco e a interface precisam ser atualizados de modo coordenado. A migração e a interface ainda exigem ensaio antes de homologação.
