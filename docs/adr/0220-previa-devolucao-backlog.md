# ADR-0220 — Prévia conservadora de devolução de escopo

## Decisão

Preparar diagnóstico paginado das parcelas vinculadas ao Backlog/Chamado, mostrando estado registrado, eventual OS de atendimento e presença de OS não finalizadas. Não considerar parcela apta à devolução sem prova de suspensão do Chamado e ausência de trabalho em curso sobre aquela parcela; o modelo atual não comprova ambos, portanto cada parcela retorna `nao_comprovada`. A consulta não altera estado.

## Limites

Contagem de OS não estabelece atribuição parcela→OS nem prova de trabalho concluído. Não é comando de devolução, não libera unicidade de vínculos e não infere suspensão por status legado. Consulta revogada e UI sob flag desligada; sem aplicação/testes.
