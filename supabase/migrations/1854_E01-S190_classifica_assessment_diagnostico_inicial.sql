-- E01-S190 AC-1 — Assessment deixa de existir como módulo independente (decisão do Fabrício,
-- resposta 26 de 17/11/2026): sua função vira o tipo de Inspeção "Diagnóstico Inicial do
-- Cliente", também aplicável à implantação inicial.
--
-- Reverso: update pcm.inspecoes set tipo_inspecao_id = null
--            where tipo_inspecao_id = (select id from pcm.tipos_inspecao
--              where nome = 'Diagnóstico Inicial do Cliente');
--          delete from pcm.tipos_inspecao where nome = 'Diagnóstico Inicial do Cliente';
--
-- O QUE ISTO FAZ (e o que NÃO faz)
-- Assessment já era, desde 0137 (E01-S90), uma linha de `pcm.inspecoes` com `e_assessment=true` —
-- "módulo separado" sempre foi a UI (AssessmentPage, item próprio de menu), nunca o schema.
-- `InspecoesPage.tsx` já lista qualquer inspeção independente de `e_assessment`, e já mostra
-- `tipo_inspecao_id` pelo nome do catálogo quando presente — então classificar o Assessment
-- existente com um `tipo_inspecao_id` de verdade é o suficiente para ele "aparecer como Inspeção
-- do tipo Diagnóstico Inicial do Cliente" (AC-1), sem reescrever nenhuma regra de Inspeção.
--
-- NENHUM registro é recriado: é um UPDATE em cima do `id` existente. Identidade, histórico
-- (os_status_eventos e afins não tocam em `pcm.inspecoes`) e evidências (`anexos` da própria
-- linha) ficam exatamente onde estavam. `e_assessment` e `motivo_assessment` **não são
-- removidos** — continuam existindo para quem ainda lê por eles (ex.: 0185, 0187, 1162), e podem
-- ser aposentados numa story própria quando todo consumidor migrar para `tipo_inspecao_id`.
--
-- Idempotente: reaplicar não duplica o tipo (busca por nome antes de inserir) nem reclassifica
-- o que já está classificado (`is distinct from` no UPDATE).
do $$
declare
  v_tipo_id uuid;
begin
  select id into v_tipo_id from pcm.tipos_inspecao where nome = 'Diagnóstico Inicial do Cliente';

  if v_tipo_id is null then
    insert into pcm.tipos_inspecao (nome, descricao)
    values (
      'Diagnóstico Inicial do Cliente',
      'Consolida o antigo Assessment — também aplicável à implantação inicial do cliente ' ||
      '(decisão do Fabrício, resposta 26, 17/11/2026). Preserva as mesmas ações de Inspeção: ' ||
      'derivar item para Chamado, Backlog ou OS, e importar questionário do Auvo.'
    )
    returning id into v_tipo_id;
  end if;

  update pcm.inspecoes
  set tipo_inspecao_id = v_tipo_id
  where e_assessment = true
    and tipo_inspecao_id is distinct from v_tipo_id;
end $$;
