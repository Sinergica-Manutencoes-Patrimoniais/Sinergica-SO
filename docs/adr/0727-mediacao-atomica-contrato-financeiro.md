# ADR-0727 — Mediação atômica do vínculo Comercial–Financeiro

**Status:** proposta de arquitetura, não implementada nem homologada. Não altera o escopo global legado por módulo.

## Decisão para incremento 0952

Preparar mediação Comercial `SECURITY DEFINER` com guarda explícita de JWT e permissão atual, invocando funções Financeiro internas sem concessão ao navegador que derivam dados do contrato bloqueado. As duas RPCs financeiras antigas permanecem acessíveis a Financeiro autorizado, mas não a usuários exclusivamente Comerciais; alteração de compatibilidade deve ser verificada com consumidores externos antes de rollout. A inserção direta de contrato deve nascer em rascunho sem vínculo financeiro, e a atualização direta do navegador deve ser limitada aos campos editáveis do rascunho; funções mediadoras próprias atualizam o ciclo. O teste adversarial reproduziu 8 falhas em 10, antes da implementação. O código permanece em diagnóstico, sem homologação ou deploy.

## Evidência e protocolo atual

E03-S07 exige que Comercial seja dono do contrato e que Financeiro publique sua interface de escrita (ADR-0019); ativação cria plano e move a oportunidade na mesma transação, encerramento preserva lançamentos. A RPC Comercial de ativação (`0950`) chama `financeiro.fn_criar_plano_faturamento` com valores derivados do contrato; a RPC Comercial de encerramento (`0193`) chama `financeiro.fn_encerrar_plano_faturamento`. Ambas são `SECURITY INVOKER`, e as funções financeiras são `SECURITY DEFINER` acessíveis diretamente ao mesmo papel `authenticated`. Verificar só igualdade entre parâmetros e contrato não distingue uma chamada interna legítima de uma chamada direta do navegador e tampouco garante a transição correspondente do contrato e da oportunidade.

O adapter Financeiro identificado no repositório lê, cria e altera planos pela tabela Financeiro sob RLS, inclusive sem contrato Comercial; não chama as duas RPCs de mediação. As políticas legadas são globais por módulo. Consumidores externos dessas RPCs podem existir e precisam ser inventariados; ausência de referência no repositório não os descarta. O teste adversarial preparado demonstra cenários de inconsistência de vínculo, não pretende restringir um usuário global a um Cliente.

## Direção proposta

Separar o comando transacional de ativação/encerramento da API financeira genérica. O novo comando Comercial deve revalidar sessão ativa e nível atual, obter e bloquear o contrato e a oportunidade, ler apenas a projeção de proposta sem custos e chamar uma interface financeira interna publicada pelo dono, com parâmetros derivados exclusivamente do estado bloqueado. Ativação ou encerramento deve efetivar as mudanças de ambos os domínios e a etapa ganha em uma única transação; qualquer falha reverte tudo. A função financeira interna não deve ser executável diretamente por `authenticated`, `anon`, `public` ou `service_role`.

Uma alternativa a estudar é mediação Comercial `SECURITY DEFINER` de escopo mínimo com `search_path` fixo, verificações explícitas atuais equivalentes às políticas e sem retorno de custos. Essa mudança exige auditoria específica: o proprietário pode contornar RLS e não deve aceitar identidade, Cliente, valores ou estado de autorização fornecidos pelo cliente. Não depender de flags de sessão livremente definíveis, nomes do chamador ou checks apenas do JWT como prova de chamada interna. A autorização é global pelo módulo existente, com verificação de consistência do Cliente entre contrato e plano, não uma concessão nova por Cliente.

Revisar também escrita direta em `comercial.contratos`: a RLS atual controla quem escreve a linha, mas não restringe por si só colunas de estado e vínculo financeiro. Proteger campos de ciclo de vida e identificadores contra alteração direta, mantendo a edição legítima dos campos de rascunho e os contratos das telas; usar privilégios por coluna ou mecanismo de fronteira comprovadamente não falsificável. Não remover permissões gerais sem migração de consumidores e testes de compatibilidade.

Preservar a operação Financeiro legítima sobre planos próprios e legados, inclusive sem origem Comercial. Antes de restringir as RPCs genéricas antigas ou substituí-las por versões compatíveis, validar consumidores externos, permissões atuais, forma de rollout e retorno; a reversão não deve apagar dados nem reabrir silenciosamente a brecha. Não alterar contratos já existentes, fazer backfill presumido ou disparar faturamento/Auvo durante a migration.

## Provas obrigatórias

- Testar usuário Comercial autorizado usando ativação e encerramento completos, com plano correspondente, oportunidade ganha e rollback integral de falha em cada etapa.
- Negar chamadas diretas Comercial às interfaces financeiras internas, valores/vínculos divergentes, plano legado sem contrato Comercial e tentativa direta de alterar status/vínculos. Não tratar Cliente diferente, isoladamente, como negação de acesso no modelo global legado.
- Manter criação, edição e encerramento legítimos pelo Financeiro, inclusive plano legado sem contrato Comercial; provar downgrade, desativação e papel divergente com JWT antigo.
- Exercer concorrência, locks, idempotência, ausência de oportunidade/etapa e integridade dos lançamentos; consultar impacto e compatibilidade das integrações conhecidas antes do rollout.
- Executar em Supabase descartável, sem rede/integrações reais, com dados sintéticos e rollback; depois CI com db-tests e revisão adversarial. Testes unitários ou passagem das migrations não equivalem à homologação.

## Estado

Nenhuma implementação, alteração de ACL, migration ou deploy está autorizada por este documento. A seleção e propriedade das funções mediadoras ainda dependem de revisão arquitetural e dos testes de segurança; enquanto não resolvidas, o fluxo permanece bloqueado para homologação.
