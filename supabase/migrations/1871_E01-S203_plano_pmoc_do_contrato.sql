-- E01-S203 — Plano PMOC criado À MÃO pelo PCM a partir de um Contrato PMOC existente.
--
-- A DECISÃO QUE ESTA MIGRATION EXECUTA
-- A ADR-1697 §3 deixou uma pergunta textual em aberto: para um Contrato PMOC que já existe hoje
-- — com imóvel, ART, inventário de equipamentos e cronograma de 12 visitas emitido —, o Plano de
-- Manutenção correspondente deve ser (a) criado por migração de conteúdo, (b) criado pelo PCM
-- manualmente, caso a caso, ou (c) não criado? **O cliente respondeu em 24/11: (b).** ADR-1698.
--
-- O QUE ISSO PROÍBE, E QUE ESTA MIGRATION NÃO FAZ DE PROPÓSITO
--   • Nenhum `insert into pcm.planos_manutencao` em massa aqui dentro. (b) é criação manual: uma
--     migração de conteúdo seria a alternativa (a), que foi RECUSADA. Esta migration cria a
--     máquina (vínculo + RPC + indicador) e sai; quem cria Plano é o PCM, clicando.
--   • Nenhuma fusão de entidade. `pcm.pmoc_contracts` e `pcm.planos_manutencao` continuam duas
--     tabelas distintas, com ciclos de vida próprios, ligadas por uma linha de vínculo — resposta
--     27 do Pacote Consolidado ("a unificação é de menu e jornada, não de modelo").
--   • Nenhuma retirada do PMOC do menu. Enquanto houver Contrato PMOC sem Plano, tirar o módulo
--     deixaria imóvel, ART, laudo e análise microbiológica sem porta de entrada (AC-7 de S190).
--     O indicador desta migration é justamente o que permitirá, um dia, provar que chegou a zero.
--
-- POR QUE UM VÍNCULO NOVO, E NÃO `pcm.sso_vinculos_ciclo_pmoc` (1631_E01-S166) — AVALIADO PRIMEIRO
-- Aquela tabela é o vínculo de UM CICLO: (`rotina_logica_id`, `alvo_tipo`, `alvo_id`,
-- `vencimento`) ↔ um `pcm.pmoc_schedules`. Ela é inadequada aqui por quatro razões, não por
-- gosto:
--   1. Ela EXIGE que o Plano já exista (FK para `planos_manutencao` e `plano_versoes` com versão
--      `aprovado`). O problema desta story é precisamente que o Plano ainda NÃO existe.
--   2. Ela exige `proposta_id` (`sso_propostas_mapeamento_pmoc`, único) e `decisao_id` com
--      decisão `validada_pcm` — maquinário de mapeamento de ciclo que não tem o que mapear antes
--      de haver rotina.
--   3. Sua unicidade é por proposta/ciclo, e são esperadas MUITAS linhas por contrato (uma por
--      visita). Ela não consegue, nem deve, impedir dois Planos para o mesmo Contrato.
--   4. `contrato_pmoc_id` é lá um dado derivado do agendamento, não a chave do vínculo.
-- Por isso: vínculo próprio, mínimo, de cardinalidade 1:1, que não substitui nem duplica o de
-- ciclo — quando o Plano criado aqui ganhar rotinas, o vínculo de ciclo de 1631 continua sendo o
-- caminho para amarrar cada vencimento a cada visita do cronograma PMOC.
--
-- REUSO DELIBERADO — nenhum gate, nenhuma capacidade e nenhum livro de idempotência novos:
--   gate/capacidade  pcm.sso_conferir_pmoc_mediado(ator, cliente, false) (1630_E01-S166) — cobre
--                    `pcm.sso_pmoc_mediado_gate` + `pcm.sso_diagnostico_pmoc_gate` (ambos
--                    fechados por padrão) e exige `config.sso_autorizar_acao('plano.gerir', …)`,
--                    que é a MESMA capacidade de `pcm.sso_salvar_plano_rascunho` (0260_E01-S165).
--                    Ler PMOC a partir do Plano já é, literalmente, a jornada "PMOC mediado".
--   idempotência     pcm.plano_comandos (0260_E01-S165), o livro de comandos do Plano, com
--                    `request_id` como chave primária. Um segundo livro para o mesmo agregado
--                    criaria duas verdades sobre "este pedido já foi executado?".
--   imutabilidade    pcm.sso_proteger_conferencia_levantamento() (0327_E01-S178), o mesmo gatilho
--                    append-only que 1631 usa. O erro que ele levanta é `conferencia_imutavel`,
--                    herdado da story de origem.
--
-- Reverso (aditivo; nenhuma linha de Plano, Contrato ou auditoria é apagada em nenhum passo):
--   drop trigger if exists sso_vinculos_plano_contrato_pmoc_imutavel on pcm.sso_vinculos_plano_contrato_pmoc;
--   drop function if exists pcm.sso_resumir_cobertura_plano_pmoc(uuid, uuid);
--   drop function if exists pcm.sso_listar_contratos_pmoc_sem_plano(uuid, uuid, integer);
--   drop function if exists pcm.sso_criar_plano_do_contrato_pmoc(uuid, uuid, uuid, uuid, text, boolean);
--   -- Os Planos criados pelo PCM pela RPC NÃO são removidos pelo reverso: são registros de
--   -- trabalho humano, não efeito colateral de migration. Para desfazer um Plano específico use
--   -- o fluxo de Plano (encerramento), nunca `delete`. O que o reverso pode apagar sem perda é
--   -- só o vínculo, e apenas depois que não houver Plano dependendo dele:
--   drop table if exists pcm.sso_vinculos_plano_contrato_pmoc;
--   -- `audit.events` é append-only por desenho: os eventos permanecem.

-- ── 1. O vínculo explícito Contrato PMOC ↔ Plano ─────────────────────────────────────────────
-- Mínimo por desenho: a tabela diz QUEM corresponde a QUEM, quem declarou e com que pedido.
-- `derivado` é FOTOGRAFIA do que foi herdado no instante da criação (imóvel, vigência,
-- periodicidades do cronograma, contagem de equipamentos) — é evidência do que o PCM viu ao
-- clicar, nunca fonte de verdade: a fonte continua sendo `pcm.pmoc_*`.
create table if not exists pcm.sso_vinculos_plano_contrato_pmoc (
  id               uuid        primary key default gen_random_uuid(),
  request_id       uuid        not null unique,
  cliente_id       uuid        not null references pcm.clientes(id),
  -- A unicidade que a story cobra: UM Plano por Contrato PMOC. Sem ela, dois cliques simultâneos
  -- (ou dois operadores) produziriam dois Planos para o mesmo contrato e o indicador de progresso
  -- passaria a mentir para os dois lados.
  contrato_pmoc_id uuid        not null unique references pcm.pmoc_contracts(id),
  -- E um Plano não corresponde a dois Contratos: a correspondência decidida é 1:1, e um Plano que
  -- cobrisse dois contratos tornaria "contratos sem Plano" uma conta impossível de fechar.
  plano_id         uuid        not null unique references pcm.planos_manutencao(id),
  imovel_id        uuid        not null references pcm.pmoc_properties(id),
  derivado         jsonb       not null,
  ator_id          uuid        not null references auth.users(id),
  criado_em        timestamptz not null default now()
);

create index if not exists idx_sso_vinculos_plano_contrato_pmoc_cliente
  on pcm.sso_vinculos_plano_contrato_pmoc (cliente_id, criado_em desc);

alter table pcm.sso_vinculos_plano_contrato_pmoc enable row level security;
alter table pcm.sso_vinculos_plano_contrato_pmoc force row level security;
revoke all on pcm.sso_vinculos_plano_contrato_pmoc from public, anon, service_role;
grant select on pcm.sso_vinculos_plano_contrato_pmoc to authenticated;
-- Leitura pela MESMA capacidade que governa o Plano (`plano.gerir` por Cliente, 0260). Escrita
-- não é concedida a ninguém: só a RPC `security definer` abaixo insere.
create policy sso_vinculos_plano_contrato_pmoc_leitura
  on pcm.sso_vinculos_plano_contrato_pmoc for select to authenticated
  using (config.sso_autorizar_acao('plano.gerir', cliente_id));

-- Append-only: o vínculo é declaração datada do PCM. Corrigir um erro é assunto de outra story,
-- com ADR, e nunca por UPDATE silencioso.
create trigger sso_vinculos_plano_contrato_pmoc_imutavel
  before update or delete on pcm.sso_vinculos_plano_contrato_pmoc
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

comment on table pcm.sso_vinculos_plano_contrato_pmoc is
  'E01-S203/ADR-1698 — correspondência 1:1, declarada pelo PCM, entre um pcm.pmoc_contracts e o '
  'pcm.planos_manutencao de modalidade pmoc criado à mão para ele. Não funde as entidades: é '
  'ponte, não fusão (resposta 27 do Pacote Consolidado). Append-only.';

-- ── 2. A criação mediada — SEMPRE ação humana, nunca automática ──────────────────────────────
-- Três travas tornam a criação automática impossível, não só desaconselhada:
--   (i) `auth.uid()` tem de existir e ser igual a `p_ator_id` (dentro de sso_conferir_pmoc_mediado);
--  (ii) `p_confirma_criacao` tem de ser literalmente true — nenhum job passa confirmação humana;
-- (iii) a função é concedida a `authenticated` e explicitamente REVOGADA de `service_role`, que é
--       o papel de todo gatilho de integração e Edge Function deste repo.
create function pcm.sso_criar_plano_do_contrato_pmoc(
  p_ator_id uuid, p_request_id uuid, p_cliente_id uuid, p_contrato_pmoc_id uuid,
  p_nome text, p_confirma_criacao boolean
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_comando pcm.plano_comandos%rowtype;
  v_contrato pcm.pmoc_contracts%rowtype;
  v_imovel pcm.pmoc_properties%rowtype;
  v_nome text := nullif(btrim(p_nome), '');
  v_payload jsonb; v_derivado jsonb; v_resultado jsonb;
  v_plano_id uuid; v_vinculo_id uuid; v_equipamentos integer; v_periodicidades text[];
begin
  if p_request_id is null or p_cliente_id is null or p_contrato_pmoc_id is null
     or (v_nome is not null and length(v_nome) > 200) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  -- (ii) A confirmação explícita. Erro PRÓPRIO: "faltou confirmar" não é "parâmetro inválido",
  -- e a tela precisa poder dizer isso em português.
  if p_confirma_criacao is distinct from true then
    raise exception 'criacao_nao_confirmada' using errcode = '22023',
      hint = 'O Plano PMOC é criado à mão pelo PCM (ADR-1698). Confirme a criação na tela.';
  end if;

  v_payload := jsonb_build_object(
    'tipo', 'criarPlanoDoContratoPmoc', 'clienteId', p_cliente_id,
    'contratoPmocId', p_contrato_pmoc_id, 'nome', v_nome, 'confirmaCriacao', true);

  -- Gate + capacidade reusados inteiros (1630), ANTES de qualquer leitura — inclusive antes do
  -- livro de comandos. É a ordem de 1631, e é a mais estrita: com o gate fechado nem um recibo
  -- antigo sai daqui. Gate fechado levanta `operacao_desabilitada` / `fonte_desabilitada`
  -- (55000); falta de `plano.gerir` levanta `sem_acesso` (42501). Erro NOMEADO em todos os
  -- casos — nunca "nada aconteceu".
  perform pcm.sso_conferir_pmoc_mediado(p_ator_id, p_cliente_id, false);

  -- Idempotência por `request_id`, no livro de comandos do Plano (0260). Vem ANTES da leitura do
  -- contrato: repetir o mesmo pedido devolve o mesmo recibo mesmo que o contrato tenha mudado
  -- de estado desde então — é o que impede o segundo clique de virar um segundo Plano.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.plano_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from p_ator_id
       or config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) is distinct from true then
      raise exception 'sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;

  -- Serializa por contrato: duas sessões no mesmo Contrato não chegam juntas ao `insert`.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('plano-pmoc-contrato:' || p_contrato_pmoc_id::text, 0));

  select c.* into v_contrato from pcm.pmoc_contracts c
   where c.id = p_contrato_pmoc_id and c.deleted_at is null for update nowait;
  if not found then raise exception 'contrato_pmoc_indisponivel' using errcode = '42501'; end if;
  select p.* into v_imovel from pcm.pmoc_properties p
   where p.id = v_contrato.property_id and p.deleted_at is null;
  -- Contrato vivo cujo imóvel foi soft-deleted: indisponível, não "sem Cliente".
  if not found then raise exception 'contrato_pmoc_indisponivel' using errcode = '42501'; end if;
  -- Imóvel PMOC sem Cliente não dá para virar Plano: `planos_manutencao.cliente_id` é NOT NULL e
  -- adivinhar o Cliente seria inventar vínculo. Erro próprio, para a tela mandar corrigir o
  -- cadastro do imóvel no módulo PMOC em vez de parecer falta de permissão.
  if v_imovel.client_id is null then
    raise exception 'contrato_pmoc_sem_cliente' using errcode = '23514',
      hint = 'O imóvel PMOC deste contrato não tem Cliente. Vincule o imóvel ao Cliente no módulo PMOC antes de criar o Plano.';
  end if;
  -- Pedir o Contrato de OUTRO Cliente é negado, nunca devolvido vazio nem redirecionado.
  if v_imovel.client_id is distinct from p_cliente_id then
    raise exception 'contrato_pmoc_indisponivel' using errcode = '42501';
  end if;

  if exists (select 1 from pcm.sso_vinculos_plano_contrato_pmoc v
              where v.contrato_pmoc_id = p_contrato_pmoc_id) then
    raise exception 'contrato_pmoc_ja_tem_plano' using errcode = '23505',
      hint = 'Este Contrato PMOC já tem Plano de Manutenção. Abra o Plano existente.';
  end if;

  -- Herança do que É derivável. `pcm.planos_manutencao` só tem cliente, nome, estado e revisão —
  -- imóvel, vigência e periodicidade não têm coluna lá, então entram no vínculo (`derivado`) e na
  -- auditoria, que é onde ficam legíveis sem inventar schema.
  select pg_catalog.count(*)::integer into v_equipamentos
    from pcm.pmoc_equipment e
   where e.property_id = v_imovel.id and e.deleted_at is null and e.active;
  select pg_catalog.array_agg(distinct s.maintenance_type order by s.maintenance_type)
    into v_periodicidades
    from pcm.pmoc_schedules s
   where s.contract_id = v_contrato.id and s.status <> 'cancelado';
  v_periodicidades := coalesce(v_periodicidades, '{}'::text[]);

  v_nome := coalesce(v_nome, left('PMOC — ' || v_imovel.name, 200));
  v_plano_id := gen_random_uuid();
  v_vinculo_id := gen_random_uuid();
  v_derivado := jsonb_build_object(
    'imovelId', v_imovel.id, 'imovelNome', v_imovel.name, 'imovelCidade', v_imovel.city,
    'artNumero', v_contrato.art_number, 'crea', v_contrato.crea,
    'vigenciaInicio', v_contrato.start_date, 'vigenciaFim', v_contrato.end_date,
    'statusContrato', v_contrato.status, 'equipamentosAtivos', v_equipamentos,
    'periodicidades', pg_catalog.to_jsonb(v_periodicidades));

  -- O Plano nasce RASCUNHO e revisão 1, pelo mesmo caminho de 0260 — criar PMOC não pula a
  -- aprovação do Plano nem gera rotina, ocorrência, OS ou tarefa no Auvo. O cronograma PMOC do
  -- contrato continua intacto e continua sendo a execução legal.
  insert into pcm.planos_manutencao (id, cliente_id, nome, modalidade, created_by, updated_by)
    values (v_plano_id, p_cliente_id, v_nome, 'pmoc', p_ator_id, p_ator_id);
  insert into pcm.sso_vinculos_plano_contrato_pmoc
    (id, request_id, cliente_id, contrato_pmoc_id, plano_id, imovel_id, derivado, ator_id)
    values (v_vinculo_id, p_request_id, p_cliente_id, p_contrato_pmoc_id, v_plano_id,
            v_imovel.id, v_derivado, p_ator_id);

  v_resultado := jsonb_build_object(
    'requestId', p_request_id, 'planoId', v_plano_id, 'vinculoId', v_vinculo_id,
    'contratoPmocId', p_contrato_pmoc_id, 'clienteId', p_cliente_id, 'nome', v_nome,
    'modalidade', 'pmoc', 'estado', 'rascunho', 'revisao', 1,
    'criadoPorHumano', true, 'rotinasCriadas', 0, 'contratoPmocPreservado', true,
    'derivado', v_derivado);

  insert into audit.events (actor_id, action, entity, entity_id, payload)
    values (p_ator_id, 'plano.criado_do_contrato_pmoc', 'planos_manutencao', v_plano_id,
            v_resultado || jsonb_build_object('story', 'E01-S203', 'decisao', 'ADR-1698 (b)'));
  insert into pcm.plano_comandos (request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, p_ator_id, p_cliente_id, v_payload, v_resultado);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_criar_plano_do_contrato_pmoc(uuid, uuid, uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_criar_plano_do_contrato_pmoc(uuid, uuid, uuid, uuid, text, boolean)
  to authenticated;

-- ── 3. O indicador de progresso ──────────────────────────────────────────────────────────────
-- Sem ele a migração manual vira trabalho sem fim visível, e nunca se saberá quando PMOC pode
-- sair do menu com segurança. Duas leituras: a LISTA do que falta e o RESUMO do quanto falta.
create function pcm.sso_listar_contratos_pmoc_sem_plano(
  p_ator_id uuid, p_cliente_id uuid, p_limite integer
) returns table(
  contrato_id uuid, imovel_id uuid, imovel_nome text, imovel_cidade text,
  art_numero text, vigencia_inicio date, vigencia_fim date, status text,
  equipamentos_ativos integer, agendamentos integer, periodicidades text[]
) language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 500 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  perform pcm.sso_conferir_pmoc_mediado(p_ator_id, p_cliente_id, false);
  return query
    select c.id, p.id, p.name::text, p.city::text, c.art_number::text,
           c.start_date, c.end_date, c.status::text,
           (select pg_catalog.count(*)::integer from pcm.pmoc_equipment e
             where e.property_id = p.id and e.deleted_at is null and e.active),
           (select pg_catalog.count(*)::integer from pcm.pmoc_schedules s
             where s.contract_id = c.id and s.status <> 'cancelado'),
           coalesce((select pg_catalog.array_agg(distinct s.maintenance_type order by s.maintenance_type)
                       from pcm.pmoc_schedules s
                      where s.contract_id = c.id and s.status <> 'cancelado'), '{}'::text[])
      from pcm.pmoc_contracts c
      join pcm.pmoc_properties p
        on p.id = c.property_id and p.deleted_at is null and p.client_id = p_cliente_id
     where c.deleted_at is null
       and not exists (select 1 from pcm.sso_vinculos_plano_contrato_pmoc v
                        where v.contrato_pmoc_id = c.id)
     order by c.status, c.end_date desc, p.name, c.id
     limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_contratos_pmoc_sem_plano(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_contratos_pmoc_sem_plano(uuid, uuid, integer) to authenticated;

create function pcm.sso_resumir_cobertura_plano_pmoc(p_ator_id uuid, p_cliente_id uuid)
returns table(
  cliente_id uuid, contratos_total integer, contratos_com_plano integer,
  contratos_sem_plano integer, planos_modalidade_pmoc integer, contratos_sem_cliente integer
) language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_cliente_id is null then raise exception 'consulta_invalida' using errcode = '22023'; end if;
  perform pcm.sso_conferir_pmoc_mediado(p_ator_id, p_cliente_id, false);
  return query
    select p_cliente_id,
           (select pg_catalog.count(*)::integer from pcm.pmoc_contracts c
              join pcm.pmoc_properties im on im.id = c.property_id
             where c.deleted_at is null and im.deleted_at is null and im.client_id = p_cliente_id),
           (select pg_catalog.count(*)::integer from pcm.pmoc_contracts c
              join pcm.pmoc_properties im on im.id = c.property_id
             where c.deleted_at is null and im.deleted_at is null and im.client_id = p_cliente_id
               and exists (select 1 from pcm.sso_vinculos_plano_contrato_pmoc v
                            where v.contrato_pmoc_id = c.id)),
           (select pg_catalog.count(*)::integer from pcm.pmoc_contracts c
              join pcm.pmoc_properties im on im.id = c.property_id
             where c.deleted_at is null and im.deleted_at is null and im.client_id = p_cliente_id
               and not exists (select 1 from pcm.sso_vinculos_plano_contrato_pmoc v
                                where v.contrato_pmoc_id = c.id)),
           (select pg_catalog.count(*)::integer from pcm.planos_manutencao pl
             where pl.cliente_id = p_cliente_id and pl.modalidade = 'pmoc'),
           -- Contagem GLOBAL de contratos cujo imóvel não tem Cliente nenhum. Não pertencem a
           -- este Cliente nem a nenhum outro, então não há dado de Cliente a vazar — e sem este
           -- número "faltam zero contratos" seria uma conta que nunca fecharia, porque esses
           -- contratos são invisíveis em qualquer recorte por Cliente. É o que impede concluir
           -- cedo demais que PMOC pode sair do menu.
           (select pg_catalog.count(*)::integer from pcm.pmoc_contracts c
              join pcm.pmoc_properties im on im.id = c.property_id
             where c.deleted_at is null and im.deleted_at is null and im.client_id is null);
end; $$;
revoke all on function pcm.sso_resumir_cobertura_plano_pmoc(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_resumir_cobertura_plano_pmoc(uuid, uuid) to authenticated;
