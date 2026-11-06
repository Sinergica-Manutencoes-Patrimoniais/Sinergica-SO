# ADR-0937 — Seleção de OS da Central de Materiais

Status: preparação local; sem testes ou homologação.

## Decisão

Preparar busca paginada de OS com listas de materiais do Cliente, exibindo número e título em vez de exigir digitação de UUID. A busca por número é literal, e o resultado retorna somente OS não excluídas com lista do mesmo Cliente. A consulta exige `material.gerir`, usa a mesma trava de autorização e o gate fechado da Central; não altera OS, listas ou Auvo.

## Limites

Não constitui busca global de todas as OS nem demonstra elegibilidade para criar listas. A função preparada só deve ser ativada após testes em Supabase real isolado, volume/índices, isolamento de Cliente, revogação concorrente, compatibilidade e revisão adversarial. Reversão: desligar o gate da Central; preservar dados e código legado.
