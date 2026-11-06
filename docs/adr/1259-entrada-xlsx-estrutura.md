# ADR-1259 — Entrada local da recepção XLSX de estrutura

**Status:** proposta local, não homologada. Complementa ADR-0955.

Preparar ponto de entrada Edge usando a composição existente, com gate de ambiente desligado por padrão. A função não é registrada no `supabase/config.toml`, não cria agendamento, não provisiona segredo e não é implantada por esta alteração. Dados seguem para staging ou quarentena, nunca diretamente para estrutura oficial.

Antes de registrar ou publicar, comprovar empacotamento do worker e dos módulos compartilhados, Auth, CORS, limites e cancelamento no runtime real, HMAC/Vault, autorização transacional, repetição, memória e revisão adversarial. Não aceitar arquivos reais até esses gates serem concluídos.
