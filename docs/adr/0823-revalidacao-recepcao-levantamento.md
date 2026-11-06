# ADR 0823 — Revalidar autorização na recepção de levantamento

Em duas sessões na base sintética isolada, a função 0320 autorizou antes de aguardar o advisory de request; a concessão foi revogada e confirmada durante a espera, mas a recepção ainda retornou sucesso. A tentativa de teste foi revertida.

Manter assinatura, privilégios, proveniência manual, staging e contratos de replay. Exigir READ COMMITTED para não trabalhar com snapshot antigo; revalidar `cadastro.gerir` após adquirir a trava do request (inclusive replay) e novamente após a trava da chave de origem antes de qualquer inclusão. Revalidação não substitui um protocolo transacional completo para qualquer revogação que ocorra depois da última consulta. Nenhum cadastro oficial ou serviço externo é alterado.

Teste concorrente com ambas as travas, replay, permissão e revisões deve preceder homologação. Reversão: restaurar definição 0320 sem alterar privilégios, mantendo o risco explícito; não alterar dados já recebidos.
