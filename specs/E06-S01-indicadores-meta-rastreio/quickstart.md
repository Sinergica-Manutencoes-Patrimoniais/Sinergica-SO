# Quickstart — E06-S01

## Pré-requisitos

Docker rodando, `pnpm install` feito. O banco Supabase local é **compartilhado** entre sessões:
pegue o lock antes de resetar e solte logo depois.

```bash
until mkdir /tmp/claude-501/sbdb.lock 2>/dev/null; do sleep 20; done
npx supabase@2.114.0 db reset
rmdir /tmp/claude-501/sbdb.lock
```

## 1. Schema e RLS (AC-8, AC-12, AC-15, AC-17)

```bash
until mkdir /tmp/claude-501/sbdb.lock 2>/dev/null; do sleep 20; done
npx supabase@2.114.0 test db supabase/tests/marketing_indicadores_rls.test.sql
rmdir /tmp/claude-501/sbdb.lock
```

Esperado: todos os `ok`. Cobre, em pares permitido/negado: leitura com módulo `marketing`,
leitura sem módulo, escrita com `leitura` (negada), escrita com `escrita` (permitida),
idempotência do upsert de métrica, unicidade do vínculo com oportunidade, e
`fn_receita_por_campanha` recusada para quem não tem `comercial`.

## 2. Regra de domínio (AC-1 a AC-5, AC-13, AC-14, AC-18)

De dentro de `apps/web`:

```bash
npx vitest run src/features/marketing --reporter=dot
```

Esperado: verde. As provas que importam — a soma dos conjuntos é igual à da campanha
(AC-2); custo por lead com zero leads é `null`, não `0` (AC-5); token desconhecido devolve `null`
sem chutar anúncio (AC-14); campanha sem receita continua na lista (AC-18).

## 3. Sincronização idempotente (AC-9, AC-10, AC-11)

```bash
npx supabase@2.114.0 functions serve marketing-sincronizar-meta --no-verify-jwt
# noutro terminal, com <conta> = id da conta de demonstração semeada pela migration:
curl -s -X POST http://127.0.0.1:54321/functions/v1/marketing-sincronizar-meta \
  -H 'content-type: application/json' -d '{"contaId":"<conta>","janelaDias":7}'
```

Esperado: `origem: "demonstracao"` (não há credencial no cofre). Rodar o mesmo `curl` três vezes
seguidas: `gravados.metricas` idêntico nas três e `select count(*) from
marketing.metricas_anuncio_dia` sem variação — é a prova de SC-002.

Também em Deno, sem rede:

```bash
deno test supabase/functions/_shared/marketing/meta-ads.test.ts
```

## 4. Tela (AC-4, AC-6, AC-7, AC-19, AC-20)

```bash
cd apps/web && pnpm dev
```

Entrar no módulo **Marketing**: o menu lateral traz "Indicadores" e "Receita por campanha", e a
tela abre em Indicadores — não mais no placeholder "Em construção". Trocar o período para um
intervalo sem veiculação mostra o vazio nomeado; trocar duas vezes rápido mostra o período
selecionado, não o anterior.

Com `VITE_SSO_MARKETING_INDICADORES_ENABLED=false` no `.env.local`, a área continua no menu e
exibe o aviso de recurso não ativado.

## 5. Gates antes do PR

```bash
node scripts/lint-migrations.mjs
node scripts/check-edge-functions.mjs
node scripts/check-flags-declaradas.mjs
cd apps/web && pnpm build
```

## 6. Ligar a Meta de verdade (depois desta entrega)

Como superadmin, no SQL do projeto:

```sql
select config.fn_definir_segredo_integracao('marketing_meta_access_token', '<token ads_read>');
insert into marketing.contas_anuncio (conta_externa_id, nome)
  values ('<dígitos de act_XXXX>', 'Sinérgica');
```

A sincronização seguinte sai sozinha do modo demonstração. Nenhum código muda.
