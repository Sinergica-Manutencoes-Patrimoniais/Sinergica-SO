# ADR-1414 — Verificação dos bytes de evidência de material

## Decisão

O vínculo mediado passa a exigir atestado privado por tentativa e objeto, gravado exclusivamente pelo serviço depois de ler os bytes e calcular digest e assinatura JPEG/PNG. O objeto é conferido por identidade, proprietário, bucket privado e fotografia dos metadados antes do atestado e novamente no vínculo. O upload anterior permanece quarentena, não confirmação de evidência válida.

## Limites

Migration, borda e interface não foram aplicadas nem testadas; gates continuam fechados. Assinatura não é análise de malware. Validar a estabilidade de metadados e bytes no Storage real, corridas de atualização, autorização/revogação, identidade da borda, limites, timeout, idempotência, RLS/FORCE e revisão adversarial. Não habilitar até essas provas.
