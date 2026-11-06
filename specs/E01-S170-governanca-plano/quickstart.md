# Quickstart — E01-S170

**Estado:** validação integrada do lote passou em clone descartável e a suíte web completa passou. T016 continua aberto para CI completa com db-tests, E2E visual, revisão formal e homologação.

## Prerequisites

Dependências base existente, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

O setup precisa de um usuário `superadmin` já ativo em `config.usuarios` para administrar concessões. A migration instala catálogo e modelo default-deny; não semeia concessões nem migra permissões operacionais antigas automaticamente. Conceda capacidades ao usuário de teste por `config.sso_definir_concessao` e valide leitura/escrita em dois Clientes antes de ensaiar os consumidores.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/capacidades-sso-us1.test.ts src/features/pcm/domain/capacidades-sso-us2.test.ts src/features/pcm/application/capacidades-sso-us1.test.ts src/features/pcm/application/capacidades-sso-us2.test.ts src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.test.ts src/features/pcm/interfaces/capacidades-sso/Workspace.test.tsx
rtk proxy supabase test db
rtk proxy python3 supabase/manual-tests/E01-S176_recorte_do_zero.py --github-hosted --integracao-candidata --diagnostico-ac5 --fixture-s170-e2e --ui-s170-e2e
```

O pgTAP local exige `supabase start` em banco descartável. A UI E2E S170 só executa no workflow GitHub-hosted dedicado, com fixture sintética e clone descartado. Não interpretar saída verde de eval:spec global como cobertura desta story sem conferir a seleção de specs.

## Journeys and Expected Results

### US1

Administrador atribui perfis acumuláveis e concessão individual; Operador tenta ação direta sem capacidade e acesso Cliente cruzado.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Planejador sem/com concessão individual tenta autoaprovar; supervisor autorizado valida OS e consulta auditoria.

Esperado: AC-4, AC-5, AC-6 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. CT: CT-027. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
