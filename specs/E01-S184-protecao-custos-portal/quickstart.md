# Quickstart — E01-S184

Status: parcialmente executado (2026-11-10, PR #73). AC-1 a AC-6 têm evidência de comando/resultado
abaixo; falta T018 (e2e dedicado) e o aceite formal do Fabrício/homologação (S186).

## Pré-requisitos

Dependências Independente; correção crítica prévia à E01-S181/E01-S183. Supabase local com fixtures isoladas, contatos de duas Contas, usuário autorizado e usuário sem permissão; sem endpoints externos reais. Ler contracts/commands.md e data-model.md. Alocar/aplicar migrations novas somente durante implementação e em banco local.

## Comandos futuros

```sh
rtk pnpm --filter @sinergica/web test protecao-custos-portal
rtk proxy supabase test db
rtk pnpm --filter @sinergica/web test:e2e protecao-custos-portal.spec.ts
rtk pnpm --filter @sinergica/web typecheck
rtk pnpm arch:check
```

## Demonstração funcional

1. Semear custo sentinela no snapshot, consultar como Cliente e inspecionar JSON bruto. Resultado: AC-1 e AC-2 observados, incluindo rejeições previstas.
2. Baixar versão antiga/nova e comparar privado intacto com público sanitizado. Resultado: AC-3 e AC-4 observados, incluindo rejeições previstas.
3. Comparar usuário interno com e sem ver custos; verificar link de anexo. Resultado: AC-5 e AC-6 observados, incluindo rejeições previstas.

Repetir dez comandos iguais e duas edições concorrentes; conferir unicidade e conflito explícito. Tentar IDs e anexos da Conta B como A e sessão revogada. Quando financeiro: conciliar valor original, conferido, documentos, parcelas e estornos em centavos.

## Evidência e saída

Mapear CT-024 e CT-027 e todos AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 a teste/comando/resultado. Registrar commit, ambiente, executor, data, IDs sintéticos, logs sem dados internos, contagens/saldos antes/depois e ressalvas. Revisão adversarial arquitetural e CI incluindo db-tests precisam ficar verdes na implementação. Não confundir aceite documental com homologação.

## Evidência executada (2026-11-10, Claude, PR #73)

| AC | Comando | Resultado |
|---|---|---|
| AC-1, AC-2 | `supabase test db` (CI `db-tests`, seleção inclui `E01-S184_protecao_custos_portal_us1.test.sql`) | pass — [run 42828439686](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/actions/runs/42828439686/job/129871790303), 34 assertions (proposta/orçamento sanitizados, acesso direto negado, sessão revogada negada) |
| AC-1, AC-2 (aplicação) | `cd apps/web && VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=sintetica pnpm exec vitest run src/features/area-cliente/application/protecao-custos-portal-us1.test.ts src/features/area-cliente/domain/itens-orcamento-publico.test.ts` | PASS local — adapter só lê `portal_propostas`/`portal_orcamentos_servico`, nenhuma seleção de coluna de custo |
| AC-3 | `pnpm exec vitest run src/features/area-cliente/application/proposta-publica-pdf-integracao.test.ts` | PASS local — PDF real (pdf-lib) sem custo/margem/fornecedor, usa valores da versão baixada, não da composição atual |
| AC-3, AC-4 | `supabase test db` (CI `db-tests`, `E01-S184_protecao_custos_portal_us2.test.sql`, novo) | pass — [run 42828439686](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/actions/runs/42828439686/job/129871790303), 20 assertions — correção via `fn_duplicar_proposta` (E03-S04/0184), `proposta_versoes` imutável por GRANT nem para superadmin, trilha privada, projeção pública por versão própria |
| AC-5, AC-6 (1ª metade) | `supabase test db` (CI `db-tests`, `E01-S184_protecao_custos_portal_us3.test.sql`) | pass — 17 assertions (comprovante privado só por rota autorizada, sessão revogada negada) |
| AC-5, AC-6 (aplicação) | `pnpm exec vitest run src/features/area-cliente/application/protecao-custos-portal-us3.test.ts` | PASS local — decisão só pelas RPCs seguras (`portal_decidir_proposta`/`portal_decidir_orcamento_seguro`), adapter nunca referencia o bucket `financeiro-comprovantes` |
| AC-6 (2ª metade, FR-006) | `supabase test db` (CI `db-tests`, `E01-S184_auditoria_anexos_publicados.test.sql`, novo; migration 1829) | pass — inventário cross-Cliente de anexos publicados reusa publicação/revogação auditada de 0465/E01-S183; em produção retorna vazio (gate fechado desde a origem) |
| — | `gh pr checks 73` | `qualidade` pass, `migrations` pass, `db-tests` pass — run 42828439686 |

## Revisão adversarial (2026-11-10, Claude)

Nenhum achado alto/médio nos 6 AC desta story (`comercial.portal_propostas`, `pcm.portal_orcamentos_servico`, RPCs seguras, comprovantes, migration 1829) — sanitização, negação de acesso direto e revogação de sessão seguem provadas pela CI acima. Dois achados médios **fora do escopo desta PR**, em função pré-existente de E03-S04 (0184) da qual a correção de AC-4 depende: `comercial.fn_salvar_composicao_proposta` sem checagem de `expected_versao`/`FOR UPDATE` (perda silenciosa de edição concorrente) e `fn_duplicar_proposta`/`fn_salvar_composicao_proposta` sem `request_id` (retry pode duplicar a correção) — registrados como `docs/SECURITY_DEBT.md` SEC-009/SEC-010 (P1/P2), não bloqueiam esta story. Leitura de spec confirmada pelo Lucas (2026-11-10): "reabrir versão" do AC-4 é duplicar (nunca reabrir a proposta terminal original), sustentado pelo comentário "AC-7: imutável" e pela mensagem de erro de 0184 ("duplique para uma nova versão").

**Ressalvas:** nenhum teste pgTAP rodou localmente nesta sessão (Docker/Colima indisponível); toda prova de banco vem do job `db-tests` da CI acima. `typecheck`/`arch:check` do portal não rodaram localmente (conflito Deno×pnpm já registrado em sessões anteriores); dependem da CI.

`apps/web/e2e/protecao-custos-portal.spec.ts` (T018) foi escrito em 2026-11-10 com autorização do Lucas para criar login de teste em produção (este repositório não tem Supabase local/staging para e2e — `SEC-006`), mas **não foi executado**: sem acesso a produção nesta sessão. Abre uma segunda sessão de navegador como `cliente-sindico` real, criada pela própria jornada ("Criar acesso ao portal" em Visão 360 — `email_confirm: true` na Edge Function `config-gerenciar-usuario` permite login imediato, sem segundo usuário pré-cadastrado nem segredo novo em `.env.local`). Seletores foram conferidos lendo o código das telas, não por execução; primeira rodada real precisa revisão humana atenta antes de confiar no resultado. Falta ainda o cenário de sessão revogada em navegador (sem UI encontrada para desativar usuário) e decisão sobre como rodar em CI (`ci.yml` não roda e2e; workflow isolado dedicado é o padrão usado por S165/S166/S170/S176).

