# S168 — concorrência da finalização individual

Em 30/10/2026, no banco diagnóstico isolado 55522, a migration 0969 foi aplicada diretamente, sem atualizar histórico de migrations. A 0968 ainda não estava aplicada; a 0969 não depende dela. Sem rede externa e com `app.auvo_sync_write=true`.

- `E01-S168_finalizacao_fixture_real.test.sql`: quatro verificações passaram em transação revertida: rejeição de OS e Cliente divergentes, fechamento e retry. As FKs e triggers ficaram ativos.
- `manual_s168_finalizacao_concorrencia_setup.sql` gravou fixtures sintéticas; o histórico de aprovação foi semeado, portanto não prova que um PCM revisou ou que o fluxo de aprovação tenha sido executado.
- A sessão A finalizou a OS e permaneceu oito segundos com transação aberta. A sessão B enviou o mesmo request durante esse intervalo; `pg_stat_activity` registrou `Lock|advisory`. Após o commit de A, B devolveu o mesmo resultado. Verificou-se uma finalização e status `finalizado` na OS sintética.
- `manual_s168_finalizacao_concorrencia_restaurar.sql` restaurou os cinco gates ao estado original `false` e revogou EXECUTE para `authenticated`; confirmado após o teste.
- Fixtures e eventos append-only com prefixo `16891000` permanecem na base descartável; não foram apagados nem houve bypass de triggers. A migration 0969 permanece aplicada nessa base apenas.

O experimento cobre um escalonamento de requisições idênticas, não todas as corridas possíveis; não comprova homologação, aprovação humana, sequência oficial de migrations nem integração com Auvo.
