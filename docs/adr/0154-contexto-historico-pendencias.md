# ADR-0154 — Contexto e histórico de Pendências

## Decisão

Preparar consulta paginada por Cliente para nomes do alvo quando o cadastro atual comprova o mesmo Cliente, e consulta paginada sob demanda das decisões imutáveis de uma Pendência. Resposta original e sua observação continuam distintas das decisões; nenhum texto é interpretado como evidência ou correção. Retornos indisponíveis são apresentados como ausentes, não como OK. Acesso exige capacidade vigente do Cliente e as funções permanecem revogadas.

## Limites

Nome é atual, não snapshot histórico. Fotografias, técnico e data de execução não estão presentes no retorno preparado; nenhuma URL de foto é emitida. Falta provar segurança/RLS e concorrência, integridade do vínculo original e autenticação do retorno, além da autorização específica de Pendência. Não aplicar nem habilitar até validação e revisão.
