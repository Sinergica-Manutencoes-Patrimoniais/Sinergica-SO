---
name: "supabase-manual-tests-e01-s167-cancelado-corrida-instrucoes-md"
description: "Documento Sinérgica SO: Ensaio de concorrência S167 — somente cluster descartável"
alwaysApply: false
---

# Ensaio de concorrência S167 — somente cluster descartável

Restaurar schema sem dados, sem serviços externos e sem cron. Aplicar migrations 1026, 1028, 1040 e 1043; executar `E01-S167_guardar_cancelado_corrida_setup.sql`. Os gates são habilitados apenas nesse clone. Nunca executar este setup em ambiente compartilhado.

Para criação direta, preparar a parcela apontando para OS legada `...022`, desvincular OS direta `...021` e mudar o número desta OS sintética para `OS-S167-LIVRE`. Iniciar `E01-S167_cancelado_corrida_cancelamento_primeiro.sql` com `psql -v request=<uuid>`; após o resultado da função, antes do commit, iniciar `E01-S167_cancelado_corrida_criacao.sql`. O segundo deve aguardar e rejeitar `chamado_cancelado_requer_tratamento_formal`.

Restaurar o Chamado sintético a `aberto`. Iniciar criação; após `INSERT 0 1`, iniciar `E01-S167_cancelado_corrida_cancelamento_segundo.sql` com outro request. Cancelamento deve aguardar e rejeitar `escopo_ou_os_pendente`.

Para referência, desvincular a OS direta `...023` e criar OS sintética `...024` sem Chamado, em execução. Repetir as duas ordens usando `E01-S167_cancelado_corrida_referencia.sql`. Cancelamento primeiro rejeita a troca; troca primeiro faz cancelamento rejeitar `revisao_obsoleta`. Usar request diferente em cada decisão, restaurando `aberto` entre cenários apenas no clone. Remover todo o cluster ao terminar.

Os scripts usam pausas curtas para observação e devem ser coordenados pela saída indicada; verificar que a segunda sessão permaneceu pendente até a primeira confirmar. O teste não altera nem substitui gates de homologação.
