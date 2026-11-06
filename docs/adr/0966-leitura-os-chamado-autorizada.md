# ADR-0966 — Fronteira de leitura de OS por Chamado

Status: preparação local, não homologada.

A consulta 0312 verifica capacidade com `NOT`, que não recusa explicitamente resultado SQL nulo, e não serializa fontes de autorização até o retorno. Preparar wrapper privado que exige `READ COMMITTED`, gate próprio fechado, trava compartilhada das fontes de autorização e resultado explicitamente verdadeiro para `chamado.encerrar`, antes de chamar o núcleo de leitura. Revogar a execução direta do núcleo para papéis de aplicação; o wrapper mantém mesmo formato e é selecionado por flag de cliente.

O rollout deve coordenar cliente e servidor: com migration aplicada e flag antiga, a leitura antiga falha fechada. A trava não prova cobertura de todos os escritores, nem snapshot entre páginas, consistência de vínculos concorrentes, desempenho ou permissões dos demais perfis. Revisar ACL do proprietário, ordem de locks, revogação, uso do gate e todos os consumidores antes de qualquer concessão de execução ou implantação. A leitura não autoriza criar OS.
