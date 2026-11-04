# ADR-0096 — Consulta isolada de levantamentos pendentes

## Estado

Proposta local para E01-S178, posterior à recepção da ADR-0093; sem autorizar implantação, aprovação ou integração externa.

## Decisão

Disponibilizar duas consultas paginadas: listagem de lotes por Cliente e listagem de linhas por Cliente e lote. Ambas validam `cadastro.gerir` atual no servidor antes de consultar, limitam a página a 100 e retornam somente dados da recepção vinculada ao Cliente solicitado. Identidade da sessão vem de `auth.uid()`. Lote ausente, outro Cliente e acesso negado usam o mesmo erro. Usuários e service_role continuam sem acesso direto às tabelas ou execução pela role service_role.

Os cursores são UUID do lote e chave única de linha, respectivamente; ordenação garante páginas de conjunto fixo sem duplicação. A paginação não é snapshot transacional entre páginas. As tabelas são imutáveis neste recorte, mas uma nova inserção de lote antes do cursor só aparece ao reiniciar a consulta. Uma tela preparada deve particionar cache por identidade, Cliente e lote, cancelar consultas e ocultar dados durante nova validação ou erro; isso não substitui autorização do servidor.

Retornar atributos recebidos apenas ao PCM autorizado e preservar seu caráter provisório. Não deduzir classificação, código, estrutura oficial ou aprovação. Fotos, leitura de anexos e decisões não estão disponíveis nesta API. `cadastro.gerir` é restrição conservadora neste estágio; perfis de leitura ou aprovação sem ela exigem contrato de autorização próprio, não concessão automática.

## Rollout e limites

Aplicar recepção e consultas em ordem antes de qualquer consumidor e comprovar migração/RLS em ambiente descartável. Revogar execução das consultas e desativar consumidores para recuo, preservando lotes e auditoria. Testar isolamento por Cliente, usuário sem concessão, revogação com JWT antigo, cursor, limite, payload e acesso direto; revisão adversarial, concorrência e CI com db-tests são gates antes de PASS. Testes transacionais não demonstram revogação ocorrendo durante a própria consulta nem sessão de navegador real.
