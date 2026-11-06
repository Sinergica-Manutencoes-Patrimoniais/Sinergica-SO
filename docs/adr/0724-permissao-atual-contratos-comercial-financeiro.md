# ADR-0724 — Permissão atual no fluxo de contratos Comercial e Financeiro

**Status:** decisão preparada para implementação aditiva; rollout e homologação bloqueados até testes e revisão adversarial.

## Decisão de compatibilidade

O inventário local das políticas legadas confirma escopo global por módulo nas tabelas de contratos e oportunidades. A correção preserva esse escopo e não exige novas concessões por Cliente; isso não autoriza inferir escopo equivalente para novos módulos. Identidade e permissões são verificadas no servidor a partir da conta ativa, papel coerente com a sessão e nível de módulo atual. O adaptador Financeiro existente cria e altera contratos diretamente, inclusive os legados sem contrato Comercial; esse caminho continua disponível a Financeiro autorizado. Os consumidores externos das RPCs financeiras não são inventariáveis apenas pelo repositório e exigem revisão de compatibilidade antes do rollout.

### Primeiro incremento: revogação, sem solução de domínio

A migration 0949 acrescenta restrições de permissão atual às políticas diretas de `comercial.contratos` e às duas RPCs Financeiro de plano, mantendo as verificações de JWT existentes, assinaturas, parâmetros e escopo global. Não modifica permissões das tabelas Financeiro, consultas de proposta ou regras de vínculo dos parâmetros financeiros. Assim, a regressão S184 de criação de contrato e a possibilidade de informar vínculo financeiro arbitrário permanecem abertas. Não homologar ou implantar a solução integral com base apenas neste incremento; testar também efeitos em sessões antigas, clientes existentes e caminhos Financeiro diretos.

## Contexto e evidências

O contrato E03-S07 exige criar contrato a partir de proposta aceita, ativá-lo com plano financeiro atômico e mover a oportunidade para a etapa ganha. A função `comercial.fn_criar_contrato` é `SECURITY INVOKER` e consulta a tabela de propostas completa; as políticas S184 bloqueiam essa consulta para colaboradores não administradores, inclusive quando têm escrita Comercial. O teste de regressão preparado reproduziu a falha. A ativação também consulta a tabela de propostas ao atualizar a oportunidade, podendo não identificar a origem.

A visão `comercial.propostas_sem_custos` expõe os campos necessários à criação sem custos internos e verifica usuário e módulo Comercial atuais. Ela não é, por si só, prova de isolamento por Cliente. A política legada de `comercial.contratos`, a guarda Comercial e as funções financeiras de criação e encerramento de plano dependem de claims do JWT, não de permissão atual. Uma sessão antiga pode, portanto, conservar poderes após revogação ou desativação; funções financeiras também são chamáveis diretamente e recebem parâmetros de domínio do chamador.

O teste `E03-S07_contratos_permissao_atual.test.sql` usa fixtures sintéticas, transação revertida e bloqueio de sincronização Auvo. As falhas indicam necessidade de intervenção no fluxo completo; não autorizam contornar as políticas de custo nem concluir que qualquer permissão por Cliente esteja definida.

## Direção proposta

1. Conservar RLS e restrições S184 de custo; não retornar custo, piso, composição, metadados privados ou tabela completa como efeito da correção.
2. Usar, sujeito à revisão da fronteira por Cliente e à compatibilidade dos consumidores, projeção mínima sem custos nas leituras de proposta para criação e ativação. Quando não houver origem válida e visível, negar antes de criar plano ou ativar contrato; assegurar oportunidade ganha e atomicidade do conjunto.
3. Definir uma verificação no servidor para usuário ativo, identidade e papel coerentes com a sessão e nível efetivo atual, usando a origem de permissões vigente. Aplicá-la também às operações diretas sobre contratos, não apenas a RPCs. Leitura e escrita devem ter níveis distintos; `superadmin` não dispensa vínculo com conta ativa e sessão coerente.
4. Revisar as duas RPCs financeiras publicadas e seus consumidores: revalidar a autoridade atual e o Cliente/contrato efetivos sem confiar em campos arbitrários; preservar o caminho Financeiro legítimo e contratos legados sem origem Comercial conforme a especificação. Não conceder privilégios adicionais a consumidores nem desativar a RLS para resolver o fluxo.
5. Preservar contratos existentes, propostas, planos, lançamentos, IDs, vinculações e histórico. A correção deve ser aditiva, com rollback operacional sem apagar dados e rollout coordenado; nenhuma mudança deve lançar cobrança, criar recorrência ou acionar Auvo como efeito de migração.

## Decisões e provas ainda necessárias

- Preservar o escopo global por módulo já evidenciado nas políticas legadas; verificar, sem presumir autorização de novas superfícies, que a visão sem custos mantém apenas esse escopo e não amplia campos disponíveis. O caminho Financeiro legado sem contrato Comercial permanece necessário.
- Inventariar clientes da API, operações diretas sobre contratos e chamadas diretas às funções financeiras antes de alterar assinaturas, retornos ou ACL. Identificar comportamento legado necessário para ativação e encerramento e definir rollout e reversão.
- Isolar a regra Financeiro/Comercial de dados vindos do usuário; demonstrar que chamadas diretas não criam ou encerram plano de outro Cliente ou contrato, sem quebrar a operação financeira legítima.
- Criar testes pgTAP com contas e permissões efetivas sintéticas, incluindo escrita/leitura/ausência, papel divergente, desativação, downgrade após emissão de JWT, acesso direto a tabelas e funções financeiras, dois Clientes e negação uniforme, além de custo oculto. Cobrir criação, unicidade concorrente, ativação e oportunidade ganha, rollback em falha financeira, encerramento sem remoção de lançamentos e contratos legados.
- Executar regressão integrada em Supabase isolado, com gatilhos externos suprimidos, depois CI `db-tests` e revisão adversarial. A correção deve ser testada contra estados e consumidores existentes antes de qualquer liberação.

## Consequência

O incremento 0949 não resolve o fluxo completo e a funcionalidade não é considerada homologada. A sequência original de migrations ainda tem falhas independentes de bootstrap e exige reconciliação própria.
