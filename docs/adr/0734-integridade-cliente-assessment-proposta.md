# ADR 0734 — Cliente do levantamento na proposta

Status: proposta técnica; homologação pendente.

A FK de `assessment_id` garante existência, não identidade de cliente. Teste sintético demonstrou que uma proposta da oportunidade de um cliente aceita inspeção de outro e que alterações posteriores dos clientes também quebram o vínculo.

## Decisão

Para vínculos novos ou alterados, exigir que inspeção e oportunidade da proposta pertençam ao mesmo cliente. Ausência de oportunidade ou cliente inequívoco falha fechada. Proibir alteração do cliente da inspeção ou da oportunidade quando produzir vínculo divergente; permitir desvinculação e alterações sem efeito. O gatilho verifica os registros com bloqueios de linha durante a validação; gatilhos inversos protegem alterações subsequentes. Não alterar políticas existentes nem corrigir dados legados automaticamente. Vínculos históricos não modificados continuam disponíveis e devem ser auditados e reconciliados antes do rollout. A criação sem levantamento não muda.

A origem operacional também possui oportunidade; esta decisão não substitui as validações de coerência entre oportunidade, lista e OS já existentes. Qualquer caminho sem oportunidade fica fechado para novo vínculo até existir contrato autoritativo. O erro não revela cliente ou conteúdo do levantamento.

## Limites e verificação

Migration aditiva 0958 e teste pgTAP sintético em transação revertida; sem aplicação permanente. Avaliar índice, duração dos locks e impacto em dados legados antes de implantação. Os testes de sessão única não demonstram segurança contra todas as interleavings: testes de concorrência com duas sessões, revisão de todos os escritores e revisão adversarial são gates obrigatórios antes de homologação. O rollout exige inventário dos vínculos inconsistentes e plano de correção aprovado; nenhuma inspeção ou proposta deve ser apagada automaticamente.

Em 2026-10-30 a 0958 foi aplicada apenas na segunda base diagnóstica descartável (porta 55422) para tornar os objetos visíveis em sessões independentes. O teste manual `supabase/manual-tests/E01-S181_assessment_concorrencia.js`, com fixtures sintéticas e Auvo suprimido, passou em quatro disputas: vínculo primeiro e mudança primeiro, tanto para inspeção quanto para oportunidade. Cada segunda operação esperou pelo menos um segundo, foi recusada e o vínculo final não ficou inconsistente. O teste usa temporização, não inspeção do tipo de lock; não prova todos os escalonamentos, ausência de deadlock nem proteção de outros escritores. Migration e fixtures permanecem somente nessa base descartável; sua remoção depende de coordenação. Os demais gates continuam abertos.
