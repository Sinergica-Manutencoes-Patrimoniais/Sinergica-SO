# ADR-1257 — Leitura de comprovante corrigido com digest

**Status:** proposta local, não homologada. Complementa ADR-1256.

Preparar os dois resolvedores existentes, atual e histórico, para reconhecer confirmação de ingestão vinculada a uma correção de despesa, além de realização original. O objeto, caminho, request, Cliente e despesa devem coincidir; múltiplas reservas seguem recusadas. A fronteira de download continua responsável por validar o digest dos bytes e revalidar acesso.

Não abrir gates antes de testar leituras atuais/históricas, correção apenas de valor que reutiliza objeto anterior, replays, duplicidades, autorização/revogação, Storage/Edge e revisão adversarial. Não mudar policies nem inferir integridade pelo registro SQL.
