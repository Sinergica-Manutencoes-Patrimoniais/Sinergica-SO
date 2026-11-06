# ADR-1099 — Coordenação da varredura de origens internas

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar coordenador de serviço que avança uma página de origens por tick, registra progresso e respeita intervalo entre execuções completas. Uma entrada HTTP interna valida autenticação e recibo; configuração, gates e flag iniciam desligados. Nenhum cron é criado, nenhum valor é alterado e nenhuma integração externa é acionada.

## Limites

Fontes sem vínculo comprovável e transferências ainda não são cobertas. Validar autenticação de serviço, concorrência, recuperação após timeout, cursor composto, volume, RLS/FORCE, deploy coordenado e revisão adversarial antes de qualquer ativação. Uma observação não confirma decisão ou efeito externo.
