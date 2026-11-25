-- 1891_E02-S16_jornada_instagram_direct.sql — Sinérgica SO
-- Alcance no front: a jornada "conectar o Instagram e atender o Direct" entra no registro de
-- ativação governada (E01-S188) em vez de existir só como código que ninguém acha. Sem este
-- registro, o diagnóstico `config.sso_diagnosticar_jornada` não sabe responder "esta jornada está
-- utilizável? se não, o que falta?" para o Instagram — que é exatamente a pergunta do Lucas.
--
-- Camada 'flag': `VITE_SSO_INSTAGRAM_DIRECT_ENABLED` existe de verdade em apps/web/src (gate
-- `scripts/check-jornadas-flags.mjs` recusa flag registrada sem uso no fonte).
-- Camada 'grant': `atendimento.fn_registrar_mensagem_meta` é de service_role por desenho — não
-- entra como requisito, porque não é privilégio de usuário que falte.
--
-- Reverso:
--   delete from config.sso_jornada_requisitos where jornada_codigo = 'atendimento-instagram-direct';
--   delete from config.sso_jornadas where codigo = 'atendimento-instagram-direct';

insert into config.sso_jornadas (codigo, titulo, descricao, ativavel)
values (
  'atendimento-instagram-direct',
  'Instagram Direct no Atendimento',
  'Superadmin conecta a conta profissional do Instagram em Atendimento → Configurações → aba '
  || 'Instagram, cola o callback na Meta, e a conversa de Direct passa a aparecer no Inbox junto '
  || 'com as de WhatsApp, respondível pela Meta (ADR-1700).',
  true
)
on conflict (codigo) do update
  set titulo = excluded.titulo,
      descricao = excluded.descricao,
      ativavel = excluded.ativavel;

insert into config.sso_jornada_requisitos
  (jornada_codigo, camada, identificador, papel, estado_alvo, ordem, motivo, retorno)
values (
  'atendimento-instagram-direct',
  'flag',
  'VITE_SSO_INSTAGRAM_DIRECT_ENABLED',
  'ativacao',
  true,
  1,
  'Sem a flag ligada, a aba Instagram mostra o aviso de recurso desligado em vez do formulário de '
  || 'conexão — o recurso se anuncia, não some.',
  'Desligar a flag devolve a aba ao aviso. Não derruba canal já conectado: o webhook continua '
  || 'recebendo, porque quem autoriza o recebimento é o segredo por canal, não a flag do front.'
)
on conflict (jornada_codigo, camada, identificador) do update
  set papel = excluded.papel,
      estado_alvo = excluded.estado_alvo,
      ordem = excluded.ordem,
      motivo = excluded.motivo,
      retorno = excluded.retorno;
