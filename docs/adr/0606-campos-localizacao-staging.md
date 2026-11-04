# ADR-0606 — Campos explícitos de localização em staging

Status: proposta; gate fechado, não homologada.

O PCM pode declarar explicitamente descrição e ordem de Área, Local ou Sublocal e tipo textual de Local/Sublocal. Omissão e nulo são distintos; não se converte observação em descrição. Dados têm revisão, motivo, confirmação humana, requestId idempotente e histórico imutável. Nenhum cadastro oficial é alterado e edição após conferência exige reabertura.

Enquanto os comandos de incorporação não transportarem e validarem esses campos, a aprovação do lote é bloqueada se houver qualquer declaração registrada. A implementação seguinte deve oferecer revisão e integração sem apagar histórico, inclusive regra de retirada/revisão; não habilitar o gate antes dessa integração. Testes, migração e revisão pendentes.
