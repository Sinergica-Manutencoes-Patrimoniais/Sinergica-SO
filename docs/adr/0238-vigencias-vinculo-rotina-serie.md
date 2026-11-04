# ADR-0238 — Vigência auditada do vínculo Rotina–série

Status: proposta, não homologada.

Vínculo explícito recebe períodos independentes, não sobrepostos, com data inicial, fim opcional e histórico imutável. Encerramento tem revisão, motivo e requestId e não apaga o vínculo. Bloqueia encerramento que deixaria ocorrência preparada fora de vigência; novas ocorrências por Visita exigem período vigente na data-base da semana. Dados prévios sem vigência permanecem sem autorização de geração até conferência humana.

Os comandos e gate permanecem fechados. Faltam reconciliação de períodos anteriores, concorrência com geradores legados/PMOC, fonte confiável de feriados, edições administrativas, testes e revisão adversarial; não é liberação da geração oficial.
