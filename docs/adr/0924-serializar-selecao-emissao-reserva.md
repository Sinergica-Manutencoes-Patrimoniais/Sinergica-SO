# ADR-0924 — Autorização transacional de seleção e emissão de reserva

Data: 2026-10-30 · Status: preparação, não aplicado ou homologado.

## Decisão

RPCs de seleção, emissão integral e emissão parcial da 0751 também retornam dados de replay sem novo insert. Em fixture com autorização 0246, triggers 0319 e barreira sintética antes da leitura de documento, replay da emissão parcial retornou dados após revogação confirmada. Preparar substituição aditiva dos três corpos preservando assinaturas, lógica e ACL: após bloquear o item, tentar a trava compartilhada da 0319 e revalidar `faturavel.efetivar` para o Cliente do item antes do replay ou da escrita. Trava exclusiva ocupada causa 55P03; acesso negado, 42501. Triggers 1086/1087 continuam defesa adicional; gates e grants não mudam.

## Limites e reversão

Verificar todos os perfis e fontes de autorização, RLS, ordem de locks, sessão e compatibilidade das RPCs com dados e migrações reais; realizar revisão adversarial antes de implantar. Outras operações financeiras não estão cobertas por esta decisão. Se aplicada, fechar gates e restaurar os corpos da 0751 em nova migration revisada, sem remover dados ou auditoria; a reversão reabre a corrida.
