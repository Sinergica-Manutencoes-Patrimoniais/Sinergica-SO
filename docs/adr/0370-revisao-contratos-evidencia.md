# ADR-0370 — Cópia conservadora de contratos de evidência

Status: proposta, não homologada.

O wrapper inicia revisão por 0573 e copia exigências de evidência congeladas somente quando Rotina lógica, questionário e conteúdo integral da pergunta ainda correspondem. Usa comando versionado de configuração e encadeia revisões do Plano. Regra ausente ou fonte alterada não é inferida e requer conferência; o gate de snapshot de evidência bloqueia aprovação com lacunas quando habilitado. Não modifica o questionário Auvo nem os snapshots anteriores.

O comando é alternativa preparada, não substitui automaticamente o fluxo legado. Gate e EXECUTE fechados; testes e revisão adversarial obrigatórios antes de ativação.
