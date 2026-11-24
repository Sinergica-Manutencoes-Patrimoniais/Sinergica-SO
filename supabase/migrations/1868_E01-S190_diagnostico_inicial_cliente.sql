-- E01-S190 task 6 — Assessment deixa de ser módulo e passa a ser a Inspeção do tipo
-- "Diagnóstico Inicial do Cliente" (Pacote Consolidado 13/11/2026 + resposta 26 do Fabrício,
-- 17/11: "Assessment não existirá como módulo independente"). ADR-1697.
--
-- O ACHADO QUE DEFINE O ESCOPO: não existe tabela de Assessment. Desde `0137_E01-S90` um
-- assessment JÁ É uma linha de `pcm.inspecoes` marcada com `e_assessment = true`, com itens em
-- `pcm.inspecao_itens`, mídias, `auvo_questao_chave`, `pcm.chamados.origem_inspecao_item_id` e
-- `comercial.propostas.assessment_id` apontando para o mesmo `id`. E desde `0091_E01-S73` a
-- coluna de tipo (`pcm.inspecoes.tipo_inspecao_id` → `pcm.tipos_inspecao`) existe e está NULA
-- nesses registros. Classificar, aqui, é preencher esse nulo — nada é criado, movido ou apagado,
-- a identidade (`id`) nunca muda e por isso nenhum vínculo precisa ser religado.
--
-- `e_assessment` e `motivo_assessment` CONTINUAM, preenchidos. São o sinônimo histórico do termo
-- (glossário, AC-8), e removê-los quebraria `supabase-qualidade-adapter`, a Visão 360
-- (`0958`/`1162`–`1166`) e `0185_E03-S05`. Esta migration é aditiva; depreciação é outra story.
--
-- POR QUE TEM TRIGGER, E NÃO SÓ UM UPDATE: um mutirão de backfill é verdade por um dia. Com
-- Assessment saindo do menu (task 9), todo Diagnóstico Inicial novo nasce pela tela de Inspeções
-- ou pelo adapter antigo; sem a regra no banco, metade nasceria sem tipo e a outra metade sem
-- `e_assessment`, e as duas telas mostrariam listas diferentes do mesmo fato. O trigger só
-- PREENCHE NULO — nunca troca um tipo já escolhido por alguém, nunca desmarca `e_assessment`.
--
-- Reverso (exato: desfaz só as linhas CUJO TIPO esta classificação escreveu, lendo a própria
-- auditoria). O filtro `tipo_anterior is null` não é enfeite: o evento também é gravado quando a
-- regra preencheu o MARCADOR de uma inspeção cujo tipo um humano escolheu na tela
-- (`motivo = 'marcador_preenchido'`, `tipo_anterior` preenchido). Sem o filtro, o reverso apagaria
-- a escolha dessa pessoa — achado da revisão adversarial, coberto pelos testes 31–33 do pgTAP.
--   drop trigger if exists s190_classificar_diagnostico_inicial on pcm.inspecoes;
--   drop function if exists pcm.sso_classificar_diagnostico_inicial();
--   update pcm.inspecoes i set tipo_inspecao_id = null
--     where i.tipo_inspecao_id = (select t.id from pcm.tipos_inspecao t
--                                  where t.chave = 'diagnostico_inicial_cliente')
--       and exists (select 1 from audit.events e
--                    where e.action = 'inspecao.classificada_diagnostico_inicial'
--                      and e.entity = 'inspecoes' and e.entity_id = i.id
--                      and (e.payload ->> 'tipo_anterior') is null);
--   delete from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente';
--   drop index if exists pcm.uq_tipos_inspecao_chave;
--   alter table pcm.tipos_inspecao drop column if exists chave;
--   -- `audit.events` é append-only: os eventos da classificação permanecem, por desenho.

-- ── 1. Chave estável do catálogo ──────────────────────────────────────────────────────────────
-- `pcm.tipos_inspecao` só tem `id` (uuid gerado) e `nome` (texto livre, editável pelo supervisor
-- em `TiposInspecaoPage`). Nenhum dos dois serve para migration, teste ou filtro de tela
-- referenciarem o MESMO tipo com segurança: o uuid muda por ambiente, o nome muda por edição.
alter table pcm.tipos_inspecao add column if not exists chave text;

create unique index if not exists uq_tipos_inspecao_chave
  on pcm.tipos_inspecao (chave) where chave is not null;

-- ── 2. O tipo aprovado ────────────────────────────────────────────────────────────────────────
-- Idempotente pela chave: reaplicar a migration não duplica catálogo.
insert into pcm.tipos_inspecao (nome, descricao, chave, ativo)
select
  'Diagnóstico Inicial do Cliente',
  'Diagnóstico inicial do cliente, também aplicável à implantação inicial. Substitui o antigo '
  || 'módulo Assessment (Pacote Consolidado 13/11/2026, resposta 26 do Fabrício).',
  'diagnostico_inicial_cliente',
  true
where not exists (
  select 1 from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'
);

-- ── 3. Classificação dos Assessments existentes (aditiva e auditável) ─────────────────────────
-- `deleted_at` NÃO é filtrado de propósito: um assessment soft-deleted que volte não pode
-- ressuscitar sem tipo. Soft delete é estado, não ausência.
with tipo as (
  select id from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'
), classificadas as (
  update pcm.inspecoes i
     set tipo_inspecao_id = (select id from tipo),
         updated_at = now()
   where i.e_assessment
     and i.tipo_inspecao_id is null
  returning i.id, i.client_id, i.codigo, i.motivo_assessment
)
insert into audit.events (actor_id, action, entity, entity_id, payload)
select
  null,
  'inspecao.classificada_diagnostico_inicial',
  'inspecoes',
  c.id,
  jsonb_build_object(
    'story', 'E01-S190',
    'migration', '1868',
    'tipo_anterior', null,
    'tipo_chave', 'diagnostico_inicial_cliente',
    'tipo_id', (select id from tipo),
    'cliente_id', c.client_id,
    'codigo', c.codigo,
    'motivo_assessment', c.motivo_assessment,
    -- Afirmação explícita do que a classificação NÃO fez. É o que um auditor precisa ler.
    'identidade_preservada', true,
    'registros_recriados', 0
  )
from classificadas c;

-- ── 4. A classificação como regra permanente ──────────────────────────────────────────────────
-- `security definer` + `search_path = ''`: a resolução do tipo não pode depender da RLS de quem
-- escreve (o pipeline de import do Auvo entra por `service_role`, a tela por `authenticated`), e
-- um `search_path` herdado tornaria a função sequestrável.
create or replace function pcm.sso_classificar_diagnostico_inicial()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_tipo uuid; v_classificou text;
begin
  -- Só busca o catálogo quando há algo a decidir. Nada a fazer quando os dois marcadores já
  -- concordam (ambos presentes) ou quando nenhum dos dois está presente — que é a esmagadora
  -- maioria das escritas em `pcm.inspecoes`.
  if new.tipo_inspecao_id is not null and new.e_assessment then return new; end if;
  if new.tipo_inspecao_id is null and not new.e_assessment then return new; end if;

  select t.id into v_tipo
    from pcm.tipos_inspecao t
   where t.chave = 'diagnostico_inicial_cliente' and t.deleted_at is null;
  -- Catálogo ausente (ambiente a meio caminho de uma migration) não pode derrubar a escrita de
  -- uma inspeção: a regra é de classificação, não de validação.
  if v_tipo is null then return new; end if;

  -- (a) Assessment sem tipo recebe o tipo. Nunca sobrescreve tipo já escolhido.
  if new.e_assessment and new.tipo_inspecao_id is null then
    new.tipo_inspecao_id := v_tipo;
    v_classificou := 'tipo_preenchido';
  end if;

  -- (b) Inspeção criada com o tipo é um Diagnóstico Inicial — logo, é o que o modelo antigo
  -- chama de assessment. Sem isto, criar pelo menu de Inspeções produziria um registro invisível
  -- para a Visão 360 e para `comercial.propostas.assessment_id`.
  if new.tipo_inspecao_id = v_tipo and not new.e_assessment then
    new.e_assessment := true;
    v_classificou := 'marcador_preenchido';
  end if;

  -- Toda classificação é auditável, não só o mutirão do passo 3 — é o que permite responder
  -- "quem e quando" para um registro classificado seis meses depois, e é o que torna o reverso
  -- exato (a auditoria diz o valor anterior).
  if v_classificou is not null then
    insert into audit.events (actor_id, action, entity, entity_id, payload) values (
      auth.uid(),
      'inspecao.classificada_diagnostico_inicial',
      'inspecoes',
      new.id,
      jsonb_build_object(
        'story', 'E01-S190', 'origem', 'trigger', 'motivo', v_classificou,
        'tipo_anterior', case when v_classificou = 'tipo_preenchido' then null else to_jsonb(v_tipo) end,
        'tipo_chave', 'diagnostico_inicial_cliente', 'tipo_id', v_tipo,
        'cliente_id', new.client_id, 'operacao', tg_op,
        'identidade_preservada', true, 'registros_recriados', 0
      )
    );
  end if;

  return new;
end; $$;

revoke all on function pcm.sso_classificar_diagnostico_inicial()
  from public, anon, authenticated, service_role;

drop trigger if exists s190_classificar_diagnostico_inicial on pcm.inspecoes;
create trigger s190_classificar_diagnostico_inicial
  before insert or update of e_assessment, tipo_inspecao_id on pcm.inspecoes
  for each row execute function pcm.sso_classificar_diagnostico_inicial();

-- ── 5. Alcance da consulta ────────────────────────────────────────────────────────────────────
-- A lista de Inspeções passa a ser o único caminho até os Diagnósticos Iniciais; filtrar por tipo
-- sem índice faria seq scan na tabela que recebe todo item de inspeção do Auvo.
create index if not exists idx_inspecoes_tipo_inspecao
  on pcm.inspecoes (tipo_inspecao_id, data_inspecao desc) where deleted_at is null;
