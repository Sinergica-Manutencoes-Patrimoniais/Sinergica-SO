# ADR-0911 — Retomada XLSX entre abas do mesmo navegador

Data: 2026-10-30 · Status: preparação, não publicada.

Para tentativa de mesma pessoa, Cliente e origem, uma trava Web Locks exclusiva deve envolver leitura/criação de IDs em armazenamento compartilhado e envio/repetição. Os metadados necessários são persistidos antes da rede; bytes e credenciais não são armazenados. Sem trava ou armazenamento disponível, recusar envio. Resultado incerto preserva IDs; confirmação é sempre feita pelo servidor. Arquivo com hash diferente não substitui uma tentativa existente.

Essa proteção só coordena contextos da mesma origem e perfil de navegador; limpeza de armazenamento, navegadores diferentes, outros usuários ou dispositivos e alteração de dados pelo próprio cliente permanecem fora da garantia. A identidade definitiva, autorização e idempotência devem ser validadas pelo servidor, com reconciliação explícita antes de permitir nova tentativa. Não usar esse mecanismo isolado para liberar a rota ou comprovar unicidade global. Não ativar interface ou endpoint até testes em navegador, concorrência real e revisão adversarial. Reversão: manter gate fechado, sem apagar registros locais incertos.
