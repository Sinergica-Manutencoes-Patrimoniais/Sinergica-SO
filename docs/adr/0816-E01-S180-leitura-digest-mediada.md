# ADR-0816 — Leitura mediada de comprovante com digest

Status: preparado sob gates fechados; não homologado.

A leitura de comprovante originado na ingestão resolve autorização atual e caminho vigente usando o comando canônico, e só fornece ao serviço objeto e digest quando uma reserva e confirmação auditadas se vinculam à realização correspondente. Ausência de vínculo ou correção que aponte para outro objeto falha fechada; o fluxo legado permanece inalterado.

A Edge baixa bytes, verifica SHA-256 e consulta novamente autorização e referência antes de responder. O hash atesta apenas os bytes retornados, não a imutabilidade do armazenamento. O resolvedor é exclusivo ao serviço, sem acesso direto por usuários, e depende dos gates de ingestão. A ativação exige teste integrado, autorização, concorrência, revisão adversarial e homologação; não é autorizada por este ADR.
