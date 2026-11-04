# ADR-0127 — Incorporação parcial de localização de levantamento

## Estado

Proposta para E01-S178; implementação preparada, não aplicada nem homologada. Complementa ADR-0121 e ADR-0028.

## Decisão

Preparar comando transacional por linha para criação de Área, Local e Sublocal no cadastro existente. O lote é bloqueado, autorização é conferida no servidor e requestId, revisão, tipo, nome, referência hierárquica e duplicidade são validados. A localização filha exige pai previamente incorporado no mesmo lote e Cliente. Registrar vínculo permanente entre linha e identidade oficial, revisão e auditoria; jamais apagar a linha ou suas evidências. Rejeição posterior de linha incorporada é recusada.

O comando recusa códigos informados e tipos que exigem identidade E01-S177, classificação ou vínculo funcional: não interpreta código provisório como definitivo e não cria Sistema, Equipamento, Componente ou Grupo. A interface não expõe este comando. EXECUTE permanece revogado para todos os papéis da aplicação.

## Limites e gates

Isto não conclui AC-4 a AC-6: faltam atualização e vínculo com registros existentes, resolução e reserva de códigos, classificações, seleção explícita de duplicidade, incorporação dos demais tipos, reversão controlada e jornada de aprovação. Os fluxos legados de escrita não compartilham bloqueios nem garantem unicidade de Locais, portanto concorrência e interações legadas devem ser resolvidas antes de liberar. Validar RLS, autorização revogada, transação, idempotência e concorrência em banco e revisão adversarial antes de aplicar/habilitar. Nunca contornar triggers de sincronização nem criar tarefas Auvo nesta etapa.
