# ADR-0223 — Exceção de piso para origem com oportunidade

**Estado:** preparação fechada, sem homologação nem implantação.

Propostas ligadas a oportunidade e origem operacional seguem o mesmo ciclo versionado e a mesma exceção auditada: a Conta da oportunidade deve coincidir com a lista e OS; o preço abaixo do piso depende de aprovação individual registrada para exatamente aquela versão, preço e piso. A decisão pública continua usando o fluxo Comercial legado quando houver oportunidade, com validação da exceção antes da transição.

Com gate aberto, o wrapper legado de força de preço recusa propostas operacionais: o comando operacional validado é o único caminho preparado para elas. Para impedir edição direta por sessão autenticada quando o gate for aberto, uma policy restritiva é ativada pelo gate; com gate fechado mantém a operação direta legada. Propostas não operacionais preservam o fluxo anterior. A exceção continua desabilitada e RPCs fechadas. Mudanças de acesso e a convivência com funções `security definer`, snapshots, gatilhos e integrações antigas exigem testes completos, revisão adversarial e rollout coordenado. Não inferir que a configuração transacional legada prova segurança contra todas as rotas.
