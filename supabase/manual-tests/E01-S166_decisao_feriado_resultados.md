# S166 — decisão de feriado em rotina por calendário

O teste `E01-S166_decisao_feriado_calendario.test.sql` passou 9/9 com fixture
sintética: acesso negado, decisão `manter_para_pcm`, replay, conflito,
revisão obsoleta e preservação do vencimento original. Foi executado em
transação revertida, tanto antes quanto com a 1042 temporária.

Em clone `sso_s166_feriado_prova` com gates e fixture apenas sintéticos,
`E01-S166_decisao_feriado_concorrencia.sql` registrou 6 falhas em 8 antes da
1042: autorização e ambos os gates não estavam serializados em duas ordens.
Feriado declarado já era protegido pela trava de linha existente. Com 1042
aplicada apenas no clone, passaram 8/8; transações do teste foram revertidas.

Não demonstra vínculo contratual de feriado específico nem fonte oficial,
todos escritores de Plano/Cliente, JWT externo, carga ou revisão adversarial.
Gates permanecem fechados no banco compartilhado; sem deploy ou Auvo real.
