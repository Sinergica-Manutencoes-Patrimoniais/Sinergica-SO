# Quickstart — E01-S177

**Estado:** roteiro para implementação futura; não executado como aceite nesta entrega.

## Prerequisites

Dependências E01-S176, E01-S170, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/codigos-publicos-us1.test.ts src/features/pcm/domain/codigos-publicos-us2.test.ts src/features/pcm/infrastructure/supabase-codigos-publicos-adapter.test.ts
rtk proxy supabase test db
rtk proxy pnpm --filter @sinergica/web exec playwright test e2e/codigos-publicos.spec.ts
```

Arquivos de teste serão criados pelas tasks; ausência hoje é esperada. Não interpretar saída verde de eval:spec global como cobertura destas stories se script ainda selecionar só specs antigas. Validador documental do programa deve selecionar este pacote explicitamente.

## Journeys and Expected Results

### US1

Editar código em rascunho; aprovar, sincronizar, etiquetar e referenciar OS em testes separados; tentar edição comum.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Administrador substitui código, reimprime etiqueta, consulta QR antigo/novo e aplica política Componente sem Equipment.

Esperado: AC-4, AC-5, AC-6 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

Em 2026-10-27, ADR-0095 e migration local `0317` prepararam inventário global exclusivamente agregado de Componentes e Sistemas, restrito a superadmin ativo; não criam namespace, reservas ou aliases. `E01-S177_inventario_codigos.test.sql` passou 13/13 no banco isolado, com fixtures e migration revertidas; função e Clientes sintéticos foram confirmados ausentes após rollback. O resultado não inventariou produção e não prova integridade contra escritas concorrentes, cobertura de outras fontes, desempenho ou homologação.

ADR-0097 registra proposta de expansão para o namespace, incluindo escritores web, importação e inbound Auvo já identificados; inventário completo e compatibilidade continuam abertos. A conferência pura `codigos-publicos-us2.test.ts` passou 6 testes sobre leitura literal, resolução de alias em dados fornecidos e recusa de ambiguidade, leitura parcial ou identidade incompleta. Não existe ainda persistência de alias, reserva transacional, proteção de escrita legada ou consulta integrada; testes puros não comprovam essas funcionalidades.

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. CT: CT-015. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
