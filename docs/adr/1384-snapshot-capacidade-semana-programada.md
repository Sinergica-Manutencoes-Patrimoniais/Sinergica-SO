# ADR-1384 — Snapshot de capacidade com semana programada

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Adicionar entrada de snapshot que reutiliza a versão 5 existente e substitui sua lista de ocorrências sem OS pela fonte versionada do ADR-1383, incluindo vencimento original e data de referência. Os limites, avisos de cobertura desconhecida e demais fontes permanecem. A tela só usa a entrada nova sob flag específica desligada e valida as datas retornadas. A entrada antiga permanece disponível.

## Limites

As fontes são consultadas em instruções separadas: não se afirma fotografia transacional, demanda integral, ausência de conflitos ou saldo operacional. Antes de ativar, validar fusos, cancelamentos, supressões, alteração concorrente entre fontes, limites, duplicidade, ACL/RLS/FORCE, gates e revisão adversarial.
