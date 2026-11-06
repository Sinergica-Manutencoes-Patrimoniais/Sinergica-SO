# ADR-0741 — Coordenação entre retorno e vínculo de OS a Grupo

## Status

Investigação; não autoriza ativação dos gates ou a liberação de consumidores Grupo.

## Evidência

A guarda 0960 rejeita a associação quando já enxerga retorno ou Pendência. Em banco descartável, duas sessões confirmaram retorno e vínculo da mesma OS: A inseriu retorno sem confirmar; B não o enxergou, associou Grupo e confirmou; A confirmou. A inserção de retorno foi direta como proprietário para exercitar a guarda de tabela: não prova a execução ponta a ponta da RPC 0402. Os scripts `supabase/tests/manual_s173_concorrencia_*.sql` registram essa reprodução; usam commits e não devem ser executados em banco compartilhado.

## Protocolo candidato

Para cada OS, serializar antes de consultar origem ou inserir qualquer relação de Grupo, retorno, decisão, Pendência ou finalização. Todos os caminhos devem obter uma chave de coordenação transacional comum por OS antes de adquirir locks de linha; o caminho que não puder respeitar a ordem deve falhar fechado e permitir retry. Após a coordenação, revalidar vínculo, Cliente, estado, autorização e revisão, e só então gravar. O vínculo não pode ser criado se houver retorno ou Pendência anterior não reconciliada. A opção por advisory lock exige namespace estável, todos os escritores cobertos e teste de colisões, ordem e deadlock; trigger que roda após o escritor já ter bloqueado linhas não demonstra ordem global.

Escritores identificados para auditoria de definições finais: associação `0823`, entrada `0402` e adaptações `0803/0903`, decisões `0348`, Pendências `0371/0906`, finalização `0607`, atualização de atestação `0601`, conferência `0530/0552`, operações diretas de OS e integrações que escrevam nessas tabelas. As guardas `0903` e `0960` fazem verificações em INSERT; não coordenam mutuamente as transações. A análise não demonstra que esse inventário seja exaustivo.

Antes de qualquer liberação: mapear todos os escritores e locks adquiridos antes da fronteira, implementar mediação compatível sob gate desligado, testar as duas ordens com sessões independentes e commits, timeout e retry, testar autorização revogada e falha/rollback, e verificar legados. Não usar a guarda sequencial como prova de concorrência. Fixture confirmada deve existir somente em banco descartável; seus registros append-only exigem descarte da base, não desativação de triggers em ambiente compartilhado.
