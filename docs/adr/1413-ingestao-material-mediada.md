# ADR-1413 — Recepção mediada de evidências de material

## Decisão

Preparar autorização do upload privado por meio das políticas de Storage já existentes e entradas mediadas para resolver e vincular o objeto à exceção. Os gates de upload e vínculo nascem desligados. A confirmação usa a mesma tentativa e preserva o objeto privado e o histórico da lista.

## Limites

Os bytes ainda não são verificados no servidor no momento do vínculo; MIME e hash declarados pelo navegador não comprovam o conteúdo. Não habilitar a ingestão antes de validação efetiva de bytes, concorrência, RLS/FORCE, autorização e revogação, políticas de Storage, recuperação, privacidade e revisão adversarial. Migration não aplicada nem testada.
