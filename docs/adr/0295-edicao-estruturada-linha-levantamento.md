# ADR-0295 — Correção estruturada de linha de levantamento

Prepara-se comando privado para corrigir apenas campos explicitamente fornecidos do vocabulário já aceito na recepção. Campos omitidos são preservados; valor nulo explícito não é interpretado como cadastro oficial. A operação exige motivo, retrato anterior e revisão do lote, registra antes/depois no histórico imutável existente e reinicia o ciclo de conferência. É bloqueada após qualquer incorporação do lote ou para linha rejeitada.

Não cria nem altera cadastros oficiais, não interpreta texto e não revalida vínculos; a conferência do lote continua obrigatória. Gate e execução permanecem fechados, sujeitos a testes e revisão de segurança.
