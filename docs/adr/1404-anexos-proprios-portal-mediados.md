# ADR-1404 — Anexos próprios do contato mediados

Lista e download de anexos do próprio contato usam entradas separadas e gates desligados. O servidor confere contato ativo, Cliente, OS, autoria da nota e propriedade do objeto; somente serviço recebe o caminho privado. A borda limita download e revalida autorização após leitura.

Antes de habilitar, testar Auth/Storage reais, troca ou revogação de contato, isolamento entre Clientes, arquivos legados, limites, ACL/RLS/FORCE, concorrência e revisão adversarial. Nenhum dado é publicado ou alterado.
