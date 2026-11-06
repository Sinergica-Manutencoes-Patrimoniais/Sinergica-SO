# Prévia de Calendário com comparação obsoleta

Usar stack descartável em rede interna, com Auth e PostgREST sintéticos, e migrations até 1745. Preparar a fixture de comparação de Calendário até antes do bloco final, criar a senha sintética e autenticar normalmente. Chamar diretamente o PostgREST, sem proxy de UI, com `sso_prever_novas_datas_calendario`, Cliente, Plano, revisão e preparada da fixture, janela válida de 30 dias e `p_comparacao={}`.

Antes da 1745, a chamada atingiu timeout de seis segundos. Após aplicá-la, retornou em 11–12 ms com HTTP 500 e corpo `code=P0010`, `message=comparacao_obsoleta`. O código HTTP é o mapeamento observado no PostgREST de ensaio. A tela trata o erro e descarta as opções de prévia.

O SQL `manual_E01-S165_previa_comparacao_obsoleta_1745.sql` cobre a prévia de Visita em clone e transação revertida. Remover a stack descartável ao concluir. Não há chamadas Auvo nem dados reais.
