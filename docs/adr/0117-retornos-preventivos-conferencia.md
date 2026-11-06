# ADR-0117 — Referências de retorno preventivo para conferência

## Estado

Proposta local não homologada; complementa ADR-0100 sem alterar seus gates. Migration 0341 não aplicada.

## Decisão

Expor ao PCM autorizado somente referências paginadas dos registros do espelho preventivo já vinculado ao Plano do Cliente: avaliação, Ocorrência, vencimento e identificação textual da pergunta quando informada. Nenhum resultado é interpretado, validado, classificado como Não OK ou gravado como Pendência. Não expor fotos, dados brutos, texto de resposta ou informações de outro Cliente nesta consulta; documentos e evidências dependem de contrato privado próprio.

## Limites

Esse inventário não é a fila de Pendências nem comprova alvo histórico, versão do questionário, completude ou validação PCM. Sem contrato confiável de E01-S168 não existe fonte autorizada para materialização automática. Persistência de Pendências, classificação, decisões, promoção parcial, anexos e segurança integrada permanecem bloqueadas por ADR-0100 e dependências. Antes de ativar, testar RLS, revogação, isolamento, paginação, limites e revisão adversarial; sem chamada real ao Auvo.
