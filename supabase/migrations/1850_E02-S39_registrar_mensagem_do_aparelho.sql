-- 1850_E02-S39_registrar_mensagem_do_aparelho.sql — Sinérgica SO
-- Mensagem do aparelho tira o Zé (ADR-1688, ADR-0049 do TriviAtende). Hoje
-- `fn_registrar_mensagem_celular` (0207) grava a mensagem mas NÃO tira a conversa do automático —
-- a equipe responde pelo celular e o Zé responde de novo por cima, pro mesmo cliente, segundos
-- depois. Esta migration substitui o CAMINHO (não a função antiga, que fica intacta por
-- compatibilidade) por uma RPC nova que: reconhece eco (por id e por texto), reconhece mensagem
-- automática do WhatsApp Business configurada por canal, ignora mensagem atrasada, e só então
-- pausa a conversa e cancela a fila do Zé.
--
-- Reverso:
--   drop function if exists atendimento.fn_registrar_mensagem_do_aparelho(uuid,text,text,text,text,timestamptz);
--   alter table atendimento.mensagens drop constraint if exists mensagens_origem_envio_check;
--   alter table atendimento.mensagens add constraint mensagens_origem_envio_check
--     check (origem_envio in ('formulario','ia','celular'));

alter table atendimento.mensagens drop constraint if exists mensagens_origem_envio_check;
alter table atendimento.mensagens add constraint mensagens_origem_envio_check check (
  origem_envio in ('formulario', 'ia', 'celular', 'celular_automatico')
) not valid;
alter table atendimento.mensagens validate constraint mensagens_origem_envio_check;

create or replace function atendimento.fn_registrar_mensagem_do_aparelho(
  p_canal_id uuid,
  p_instance_id text,
  p_remote_jid text,
  p_remote_id text,
  p_texto text,
  p_enviada_em timestamptz
) returns table (mensagem_id uuid, conversa_id uuid, tirou_o_ze boolean)
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_client_id uuid;
  v_texto_normalizado text := atendimento.fn_normalizar_texto_do_aparelho(p_texto);
  v_eco_id uuid;
  v_mensagem_id uuid;
  v_automatica boolean := false;
  v_atrasada boolean := coalesce(p_enviada_em < now() - interval '15 minutes', false);
  v_responsavel uuid;
  v_tirou boolean := false;
  v_linhas_afetadas int;
begin
  select client_id into v_client_id
    from atendimento.config_ze where group_jid = p_remote_jid limit 1;

  insert into atendimento.conversas (instance_id, remote_jid, client_id, canal_id)
  values (p_instance_id, p_remote_jid, v_client_id, p_canal_id)
  on conflict (instance_id, remote_jid) do update
    set canal_id = coalesce(atendimento.conversas.canal_id, excluded.canal_id)
  returning id into v_conversa_id;

  -- Eco por id: a entrega já gravou este remote_id numa mensagem do sistema (qualquer direção —
  -- se já existe linha com este (canal, wa_message_id), é eco, nunca mensagem nova).
  select id into v_eco_id
    from atendimento.mensagens
   where canal_id = p_canal_id and wa_message_id = p_remote_id
   limit 1;
  if v_eco_id is not null then
    return query select v_eco_id, v_conversa_id, false;
    return;
  end if;

  -- Eco por texto: a entrega ainda não gravou o id, mas uma mensagem do SISTEMA (nunca já
  -- celular) com o mesmo texto normalizado está em envio nos últimos 20 minutos, na mesma
  -- Conversa. Alias `m` obrigatório: `conversa_id` sozinho é ambíguo contra a coluna de saída do
  -- RETURNS TABLE (achado pelo CI: "column reference conversa_id is ambiguous").
  if exists (
    select 1 from atendimento.mensagens m
     where m.conversa_id = v_conversa_id
       and m.direcao = 'saida'
       and m.remetente_tipo in ('ze', 'humano')
       and m.origem_envio in ('ia', 'formulario')
       and m.status_entrega = 'enviando'
       and m.created_at > now() - interval '20 minutes'
       and atendimento.fn_normalizar_texto_do_aparelho(m.conteudo) = v_texto_normalizado
  ) then
    return query select null::uuid, v_conversa_id, false;
    return;
  end if;

  -- Automática do WhatsApp Business: lista configurada no canal (0 textos = nenhuma automática).
  select exists (
    select 1 from atendimento.canal_aparelho, jsonb_array_elements_text(textos_automaticos) t
     where canal_id = p_canal_id
       and atendimento.fn_normalizar_texto_do_aparelho(t) = v_texto_normalizado
  ) into v_automatica;

  insert into atendimento.mensagens (
    conversa_id, direcao, remetente_tipo, conteudo, wa_message_id, canal_id,
    status_entrega, origem_envio, created_at
  )
  values (
    v_conversa_id, 'saida', 'humano', p_texto, p_remote_id, p_canal_id,
    'enviado', case when v_automatica then 'celular_automatico' else 'celular' end, p_enviada_em
  )
  returning id into v_mensagem_id;

  update atendimento.conversas
     set ultima_mensagem_preview = left(p_texto, 200),
         ultima_mensagem_em = p_enviada_em,
         updated_at = now()
   where id = v_conversa_id;

  -- Tirar o Zé: só se não é automática, não está atrasada, e há responsável válido configurado.
  -- "Ninguém" (responsavel_id null) é a chave de desligar — nada muda. Conversa já pausada por
  -- outra pessoa não é reatribuída (segunda mensagem do aparelho não muda o responsável).
  if not v_automatica and not v_atrasada then
    select responsavel_id into v_responsavel
      from atendimento.canal_aparelho
     where canal_id = p_canal_id and responsavel_id is not null;

    if v_responsavel is not null and atendimento.fn_pessoa_do_aparelho_valida(v_responsavel) then
      update atendimento.conversas
         set modo = 'pausado', atribuido_a = v_responsavel, updated_at = now()
       where id = v_conversa_id and modo = 'auto';
      get diagnostics v_linhas_afetadas = row_count;
      v_tirou := v_linhas_afetadas > 0;

      if v_tirou then
        update atendimento.wa_queue
           set status = 'skipped'
         where queue_key = p_instance_id || ':' || p_remote_jid
           and status = 'pending';
      end if;
    end if;
  end if;

  return query select v_mensagem_id, v_conversa_id, v_tirou;
end;
$$;

revoke all on function atendimento.fn_registrar_mensagem_do_aparelho(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_mensagem_do_aparelho(
  uuid, text, text, text, text, timestamptz
) to service_role;

comment on function atendimento.fn_registrar_mensagem_do_aparelho(
  uuid, text, text, text, text, timestamptz
) is 'E02-S39/ADR-1688: grava mensagem do aparelho, reconhece eco/automática/atraso, pausa e atribui a conversa, cancela a fila do Zé.';
