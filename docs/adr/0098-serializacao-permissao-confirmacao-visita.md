# ADR-0098 — Serialização da autorização na confirmação da Visita

## Estado

Proposta para teste isolado. Não autoriza homologação, aplicação permanente ou deploy. Complementa ADR-0094; nenhuma proteção global a outras ações é alegada.

## Contexto

ADR-0094 revalida a capacidade depois das esperas de funcionário e OS, mas não impede revogação entre essa verificação e o commit. A autorização atual depende de usuário e vínculo de grupo, permissões de módulo individual ou de grupo, estado do grupo, ação e módulos elegíveis, concessões individuais ou de perfil, perfil e seus vínculos, além de atividade e exclusão do Cliente. Uma trava apenas na concessão individual não cobre essas alternativas nem concessões globais.

## Decisão proposta

Usar uma trava consultiva transacional global dedicada à autorização da confirmação. Antes de modificar fontes de autorização, triggers `BEFORE STATEMENT` obtêm trava exclusiva, mantida até commit/rollback; essa borda também cobre escrita direta legada e atualizações em lote. Cobrir INSERT, UPDATE, DELETE e TRUNCATE de `config.sso_concessoes`, `config.sso_usuario_perfis`, `config.sso_perfis`, `config.sso_acoes`, `config.sso_acao_modulos`, `config.usuarios`, `config.usuario_modulos`, `config.grupos`, `config.grupo_modulos` e `pcm.clientes`. A abrangência deliberadamente conservadora inclui alterações que não removem acesso; medir contenção e compatibilidade antes de qualquer rollout.

Após todos os bloqueios de funcionário e OS, mas antes da última verificação de capacidade, a confirmação tenta obter a mesma trava em modo compartilhado, mantida até o fim da transação. Se houver alteração de autorização em andamento, a tentativa **não espera**: a confirmação falha de forma recuperável, sem escrita ou evento, e pode ser repetida com mesmo requestId. Isso evita o ciclo em que uma transação administrativa já tem a trava exclusiva e espera uma Visita bloqueada pela confirmação. Se a confirmação obtiver a trava primeiro, a alteração posterior deve esperar até seu commit ou rollback. Se uma revogação tiver confirmado primeiro, a confirmação reconsulta a permissão e é negada.

A trava não altera o resultado de `sso_autorizar_acao`, não cria acesso e não substitui a revisão da autorização de outras ações. Operações administrativas precisam ser analisadas quanto à ordem prévia de outros locks; o modo não bloqueante da confirmação reduz um ciclo específico, mas não prova ausência de todos os deadlocks ou starvation. Erro por lock deve ser diferenciado de permissão negada na interface. Permissões em cache, tokens antigos e solicitações externas não são fonte de autorização.

## Hipóteses adicionais: ordem dos escritores

A proposta atual de trigger exclusivo **bloqueante** nos escritores tem um risco de deadlock ainda não reproduzido: `config.sso_definir_perfil` obtém lock de linha do perfil antes de executar o UPDATE que tomaria a trava global. Outra transação pode ter adquirido a trava global ao alterar outra fonte e, em seguida, tentar alterar esse perfil. A primeira ficaria aguardando a trava global; a segunda, a linha. A ausência de espera na confirmação não resolve esse ciclo entre escritores.

Dois caminhos candidatos, ainda não aprovados:

1. Criar migration aditiva que redefine os comandos administrativos para tomar a trava global antes dos locks de request, entidade e linha. `sso_inicio_comando` é ponto comum para perfil e vínculo; `sso_definir_concessao` tem sequência própria e também precisa ser adaptada. Isso não garante ordem nas escritas diretas ou em transações que já tenham locks antes de chamar os comandos: inventariar e disciplinar todos os caminhos, inclusive integração e serviços, antes de declarar segurança.
2. Fazer o trigger dos escritores tentar a trava exclusiva sem espera (`pg_try_advisory_xact_lock`) e retornar erro recuperável se estiver ocupada. Na hipótese acima, o escritor que não obtém a trava aborta e libera seus locks; não há espera nessa trava. Essa opção pode rejeitar operações administrativas concorrentes legítimas e aumentar indisponibilidade; atualizar tratamento de `55P03`, conservar requestId e distinguir falha confirmada de resultado incerto. Também exige testar locks de tabela adquiridos antes do trigger, `TRUNCATE`, transações multicomando e cascatas; não prova ausência universal de deadlock ou starvation.

Comparar ambos por testes em duas sessões nas ordens opostas, com commit e rollback, transações legadas e RPCs administrativas reais. A 0319 é somente um protótipo local com escritor bloqueante, não uma escolha final. Sem essas provas, serialização e homologação permanecem abertas.

## Limites e validação

- Demonstrar as duas ordens de commit em duas sessões reais: revogação primeiro impede confirmação; confirmação primeiro impede commit de revogação até liberação. Repetir com rollback e mesma requestId.
- Cobrir concessão individual e global, vínculo e desativação de perfil, módulo individual e de grupo, papel/atividade de usuário, ação/módulo e desativação de Cliente. Testar escrita via comandos administrativos e caminhos legados diretos.
- Testar espera de OS/funcionário, alteração concomitante de Cliente, timeouts e rollback; validar ausência de efeitos e auditoria para falhas e nenhum envio Auvo.
- Testar triggers e permissões com usuário autorizado e negado, concorrência de múltiplas Visitas, carga, transações administrativas longas e regressão legada. O usuário de banco que pode desativar triggers ou fazer DDL é confiável operacionalmente e está fora da garantia; não assumir que service_role pode desativá-los.
- Inventariar mutações de autenticação ou tabelas externas que alterem o resultado de `auth.uid()`/claims e todos os caminhos privilegiados. A expiração/revogação externa de sessão não é garantida pela trava de banco. Se qualquer fonte operacional não estiver coberta, não declarar serialização plena.

## Rollout

Migration aditiva e testes em banco isolado, com reversão verificada. O bloqueio global pode causar indisponibilidade ou lentidão de administração e confirmação: medir, inventariar concessões, prever rollback e revisar adversarialmente antes de publicar. Aplicar componentes de servidor de forma coordenada; não remover a checagem de ADR-0094. A confirmação, demais stories e programa seguem sem homologação enquanto houver lacunas ou `TODO` concorrentes.
