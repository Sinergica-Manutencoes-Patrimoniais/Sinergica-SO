-- E01-S202 — Agenda do Técnico como PROJEÇÃO da Visita (Pacote Consolidado do Fabrício,
-- 13/11/2026: "Agenda por técnico e calendário por cliente são projeções das mesmas Visitas, não
-- cadastros paralelos" · "Substituir Agenda manual pela visualização Por técnico das Visitas" ·
-- "Eliminar a união posterior de Agenda e OS com deduplicação").
--
-- DIAGNÓSTICO JÁ FEITO EM E01-S192 (specs/E01-S192-agenda-preventivas-visiveis/plan.md, AC-3):
-- `pcm.agenda_tecnico` (0155/0163) é tabela própria e NINGUÉM escreve nela a partir da Visita ou
-- da OS — a única escrita é manual, pela própria tela. É por isso que a evidência do Fabrício
-- existe: "Agenda do Técnico sem alocações na mesma semana em que o calendário operacional
-- apresentava dezenas de Chamados". Não é bug de interface nem gate fechado: é dado que nunca
-- nasceu. S192 deixou isso como SPEC_DEVIATION por depender de decisão de produto.
-- A decisão foi tomada em 24/11: PODE MIGRAR — o conteúdo lançado à mão não precisa ser
-- preservado como fonte ("estamos criando algo do zero"). Esta migration executa a decisão.
--
-- O QUE ESTA MIGRATION FAZ
--   1. `pcm.sso_listar_agenda_tecnico_projetada` — agenda por técnico DERIVADA de
--      `pcm.visitas` + `pcm.visita_equipes` + `pcm.visita_ordens_servico`. Só leitura.
--   2. Aposenta o cadastro manual: comentário de obsolescência no schema + guarda que recusa
--      escrita NOVA em `pcm.agenda_tecnico` com erro nomeado `agenda_tecnico_obsoleta`.
--
-- O QUE ESTA MIGRATION NÃO FAZ, DE PROPÓSITO
--   Não dropa `pcm.agenda_tecnico`, não apaga linha, não desfaz migration aplicada. "Pode migrar"
--   não é "pode destruir": o histórico do cadastro manual continua legível (SELECT intacto) e as
--   leituras de 1054/1200 continuam funcionando. Retirada física, se um dia for decidida, é outra
--   story com ADR.
--
-- REUSO DELIBERADO — nenhum gate nem capacidade nova (mesma disciplina de 1866):
--   gate       pcm.capacidade_agenda_tecnico_gate, via pcm.sso_exigir_agenda_tecnico_capacidade()
--              (1054/1063, fechado por padrão). É literalmente o gate batizado de "agenda do
--              técnico"; a projeção é a MESMA jornada vista da fonte certa. Criar um segundo gate
--              dobraria a superfície de ativação para a mesma tela.
--   capacidade config.sso_autorizar_acao('visita.confirmar', cliente) — a MESMA que já governa
--              toda leitura de pcm.visitas / visita_equipes / visita_ordens_servico (0282/0285).
--              Não se reusa aqui o 'capacidade.gerir' de 1054/1200: aquele autoriza ler o CADASTRO
--              manual, e usá-lo entregaria dado de Visita a quem não pode ler Visita.
--
-- Reverso:
--   drop trigger if exists sso_agenda_tecnico_obsoleta on pcm.agenda_tecnico;
--   drop function if exists pcm.sso_recusar_escrita_agenda_tecnico();
--   drop function if exists pcm.sso_listar_agenda_tecnico_projetada(uuid, date, integer);
--   comment on table pcm.agenda_tecnico is null;

-- ── 1. Projeção ──────────────────────────────────────────────────────────────────────────────
-- Uma linha por (Visita × técnico alocado), com as OS vinculadas agregadas. `p_cliente_id` nulo
-- devolve todos os Clientes em que o ator tem a capacidade — a agenda de um técnico cruza
-- Clientes por definição ("em que cliente cada técnico estará cada dia"), e exigir um Cliente
-- escolhido reproduziria o vazio que esta story veio corrigir.
create function pcm.sso_listar_agenda_tecnico_projetada(
  p_cliente_id uuid, p_semana_inicio date, p_limite integer
) returns table(
  visita_id uuid, cliente_id uuid, cliente_nome text,
  funcionario_id uuid, funcionario_nome text, papel text,
  data date, periodo text, inicio_em timestamptz, fim_em timestamptz,
  estado text, natureza text, os_numeros text[], quantidade_os integer
) language plpgsql volatile security definer set search_path = '' as $$
declare v_clientes uuid[];
begin
  if p_semana_inicio is null or not isfinite(p_semana_inicio)
     or extract(isodow from p_semana_inicio) <> 1
     or p_limite is null or p_limite not between 1 and 500 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if auth.uid() is null then raise exception 'sem_acesso' using errcode = '42501'; end if;
  -- Gate + trava compartilhada de autorização de Visita, exatamente como 1063 já fazia para a
  -- agenda manual. Erro NOMEADO: `agenda_capacidade_bloqueada`, nunca lista vazia.
  perform pcm.sso_exigir_agenda_tecnico_capacidade();

  select pg_catalog.array_agg(c.id) into v_clientes
    from pcm.clientes c
   where c.ativo and c.deleted_at is null
     and (p_cliente_id is null or c.id = p_cliente_id)
     and config.sso_autorizar_acao('visita.confirmar', c.id) is true;
  -- Sem NENHUM Cliente autorizado é "negado", não "semana vazia" — a tela precisa distinguir.
  if v_clientes is null or pg_catalog.array_length(v_clientes, 1) is null then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  return query
    with visitas_semana as (
      select v.id, v.cliente_id, v.estado, v.natureza, v.inicio_em, v.fim_em, v.fuso,
             v.responsavel_id,
             (v.inicio_em at time zone v.fuso)::date as data_local,
             (v.inicio_em at time zone v.fuso)::time as inicio_local,
             (v.fim_em    at time zone v.fuso)::time as fim_local
        from pcm.visitas v
       where v.cliente_id = any(v_clientes)
         -- Recorte por índice (idx_visitas_cliente_inicio) com folga de 1 dia para os dois lados;
         -- o recorte exato é por DATA LOCAL da Visita, no fuso dela.
         and v.inicio_em >= ((p_semana_inicio - 1)::timestamp at time zone 'UTC')
         and v.inicio_em <  ((p_semana_inicio + 8)::timestamp at time zone 'UTC')
         -- Rascunho ainda não é compromisso; reprogramada mudou de lugar; cancelada não acontece.
         and v.estado in ('planejada', 'confirmada', 'enviada', 'em_execucao', 'parcial', 'concluida')
         -- Mesma exclusão de 1284: Visita dispensada por feriado não é alocação de ninguém.
         and not exists (select 1 from pcm.sso_visitas_suprimidas_feriado s
                          where s.visita_id = v.id and s.cliente_id = v.cliente_id)
    ),
    alocacoes as (
      -- Equipe vigente da Visita.
      select e.visita_id, e.funcionario_id, e.papel
        from pcm.visita_equipes e
        join visitas_semana w on w.id = e.visita_id
       where e.encerrado_em is null
      union
      -- Responsável da Visita que não está na equipe: sem isto, uma Visita com responsável e sem
      -- equipe montada sumiria da agenda — que é o vazio que esta story veio eliminar.
      select w.id, w.responsavel_id, 'Responsável'
        from visitas_semana w
       where w.responsavel_id is not null
         and not exists (select 1 from pcm.visita_equipes e
                          where e.visita_id = w.id and e.funcionario_id = w.responsavel_id
                            and e.encerrado_em is null)
    )
    select w.id, w.cliente_id, c.nome::text, a.funcionario_id, f.nome::text, a.papel::text,
           w.data_local,
           case when w.fim_local <= time '12:00' then 'manha'
                when w.inicio_local >= time '12:00' then 'tarde'
                else 'integral' end::text,
           w.inicio_em, w.fim_em, w.estado::text, w.natureza::text,
           coalesce((select pg_catalog.array_agg(o.numero::text order by vo.sequencia, o.numero)
                       from pcm.visita_ordens_servico vo
                       join pcm.ordens_servico o
                         on o.id = vo.os_id and o.client_id = vo.cliente_id and o.deleted_at is null
                      where vo.visita_id = w.id and vo.encerrado_em is null),
                    '{}'::text[]),
           (select pg_catalog.count(*)::integer
              from pcm.visita_ordens_servico vo
              join pcm.ordens_servico o
                on o.id = vo.os_id and o.client_id = vo.cliente_id and o.deleted_at is null
             where vo.visita_id = w.id and vo.encerrado_em is null)
      from visitas_semana w
      join alocacoes a on a.visita_id = w.id
      join pcm.clientes c on c.id = w.cliente_id
      join pcm.funcionarios f on f.id = a.funcionario_id
     where w.data_local >= p_semana_inicio and w.data_local < p_semana_inicio + 7
     order by f.nome, w.data_local, w.inicio_em, w.id
     limit p_limite;
end; $$;

revoke all on function pcm.sso_listar_agenda_tecnico_projetada(uuid, date, integer)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_agenda_tecnico_projetada(uuid, date, integer) to authenticated;

-- ── 2. Aposentadoria do cadastro manual ──────────────────────────────────────────────────────
comment on table pcm.agenda_tecnico is
  'OBSOLETO desde E01-S202 (2026-11-24). A Agenda do Técnico passou a ser PROJEÇÃO da Visita '
  '(pcm.sso_listar_agenda_tecnico_projetada). Esta tabela é histórico somente-leitura: escrita '
  'nova é recusada pela trigger sso_agenda_tecnico_obsoleta com o erro agenda_tecnico_obsoleta. '
  'Não dropar — decisão do cliente foi migrar a fonte, não destruir o registro do que foi lançado '
  'à mão. Ver specs/E01-S202-agenda-projecao-visita/.';

create function pcm.sso_recusar_escrita_agenda_tecnico() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Única escrita ainda aceita: aposentar (soft-delete) uma linha manual que ainda esteja viva,
  -- sem tocar em mais nada. Serve para retirar da tela o que foi lançado à mão, preservando a
  -- linha. Tudo o mais — insert, edição de conteúdo, "ressurreição" e delete físico — é recusado.
  if tg_op = 'UPDATE'
     and old.deleted_at is null and new.deleted_at is not null
     and (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'updated_by')
         is not distinct from (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'updated_by') then
    return new;
  end if;
  raise exception 'agenda_tecnico_obsoleta' using errcode = '55000',
    hint = 'A Agenda do Técnico é projeção da Visita (E01-S202). Planeje a Visita; a agenda deriva dela.';
end; $$;
revoke all on function pcm.sso_recusar_escrita_agenda_tecnico()
  from public, anon, authenticated, service_role;

create trigger sso_agenda_tecnico_obsoleta
  before insert or update or delete on pcm.agenda_tecnico
  for each row execute function pcm.sso_recusar_escrita_agenda_tecnico();
