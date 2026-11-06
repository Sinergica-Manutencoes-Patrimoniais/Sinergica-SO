---
name: SECURITY_DEBT
description: Registro de dívida de segurança aceita conscientemente. Puxe em revisão de segurança ou antes de deploy.
alwaysApply: false
---

# SECURITY_DEBT — Dívida de segurança conhecida

> Toda exceção ao baseline de segurança aceita conscientemente mora aqui — nunca em silêncio.
> Prioridade: **P0** (corrigir antes de produção) · **P1** (próximo ciclo) · **P2** (quando der).
> Ver `seguranca/os-grade.md` (baseline OS obrigatório neste projeto).

## Dívidas herdadas do PCM v2 (evitar na recriação)
> Estas são as issues do sistema legado — servem como LISTA NEGRA ao construir o Sinérgica SO.
> Não são dívidas do repositório atual, mas guias do que garantir por design.

| ID | Origem (PCM v2) | O que evitar no Sinérgica SO |
|----|-----------------|------------------------------|
| LEGADO-001 | IDOR em `atualizar_chamado` — sem filtro por `client_id` | RLS FORCE com policy `WHERE client_id = auth.uid()` ou workspace isolado |
| LEGADO-002 | 63 tabelas sem `FORCE RLS` | `ALTER TABLE ... FORCE ROW LEVEL SECURITY` em toda tabela na migration |
| LEGADO-003 | CORS `*` nas Edge Functions | CORS restrito a `VITE_SUPABASE_URL` + domínio Netlify em produção |
| LEGADO-004 | Sem validação Zod na borda | Toda Edge Function e handler: Zod antes de acessar o banco |
| LEGADO-005 | Sem verificação de JWT em funções | `await supabase.auth.getUser()` em toda função que toca dados do usuário |
| LEGADO-006 | Buckets de storage públicos | Buckets privados + signed URLs com expiração |
| LEGADO-007 | Login via GET (credenciais em logs) | Login via POST; nunca credenciais em query string ou URL |
| LEGADO-008 | Webhook Auvo sem validação de assinatura HMAC | `crypto.ts` (_shared) com `constantTimeEqual` para validar HMAC |

## Dívidas do Sinérgica SO (atuais)
| ID | Descrição | Risco / impacto | Prio | Plano de correção | Status |
|----|-----------|-----------------|------|-------------------|--------|
| SEC-001 | ~~Projeto Supabase ainda não provisionado~~ — desatualizado: projeto está em produção desde E00-S05 (hook JWT + schemas expostos confirmados via Management API), 83 migrations aplicadas, todas com `FORCE ROW LEVEL SECURITY` por convenção do `lint:migrations`/Squawk. RLS FORCE não foi reconfirmada por query direta ao Postgres de produção nesta sessão (sem acesso ao dashboard) | acesso indevido se a convenção falhar numa migration | P1 | rodar `select relname from pg_class where relforcerowsecurity = false and relnamespace in (select oid from pg_namespace where nspname in ('pcm','atendimento','comercial','relacionamento','config'))` contra prod e confirmar 0 linhas | reavaliar (era P0/"aberto" por premissa desatualizada) |
| SEC-002 | Security headers (CSP, X-Frame-Options, HSTS) não configurados | clickjacking/XSS | P1 | configurar `netlify.toml` (headers) no Mês 2 | aberto |
| SEC-003 | Rate limiting não implementado nas Edge Functions públicas | abuso/DoS | P2 | usar `_shared/cors.ts` pattern com rate-limit header | aberto |
| SEC-004 | Revogação de permissões sem troca de identidade/papel ainda não invalida o estado da interface imediatamente | dados anteriores podem continuar visíveis até revalidação; a autorização do servidor continua obrigatória | P0 para o rollout E01-S184 | implementar e testar revalidação atual, cache e comportamento entre abas e navegador; verificar todos os caminhos no servidor | aberto; mitigação parcial na troca de usuário/papel |
| SEC-005 | Leitura 1:N de OS por Chamado em `0312` ainda não foi integrada ou homologada, e possui verificação de ambiguidade com varredura de Chamados | inconsistências legadas, desempenho e escopo de leitores gerais precisam de prova antes de ativação | P0 para o rollout E01-S167 | inventariar vínculos, avaliar índice e concorrência, definir leitura por capacidade e concluir revisão adversarial | aberto; migration não aplicada |
| SEC-006 | Configuração E2E padrão usa `.env.local` e pode realizar escritas em produção | execução inadvertida de testes pode alterar dados reais | P0 para homologação isolada | usar configuração segregada, sem `.env`, com rede restrita e fixtures sintéticas; migrar outras jornadas críticas antes de automatizar | aberto; download sintético já possui roteiro isolado |
| SEC-007 | Views SECURITY DEFINER com payload integral, erro bruto e autorização por claims em produção | possível exposição de custos ou detalhes técnicos e revogação tardia; exploração não comprovada | P0 para rollout E01-S184 | validar projeção segura, sanitização, concessão atual e compatibilidade dos consumidores; detalhes abaixo | aberto; alterações locais não implantadas |
| SEC-008 | Leitor de planilhas legado carrega SheetJS `xlsx@0.18.5` de CDN em `apps/web/src/lib/sheetjs.ts`; usado na importação estrutural e inspeções | entrada XLSX não confiável pode explorar vulnerabilidades reportadas de prototype pollution e ReDoS; carregamento remoto também requer avaliação de integridade | P1 | substituir por leitura local auditada com limites de tamanho descompactado, entradas e XML; testar arquivos válidos e maliciosos, inclusive rejeição e esgotamento de recursos; verificar compatibilidade dos fluxos existentes | aberto; não usar esse leitor na nova importação E01-S169 |

Referências SEC-008: [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) e [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9). Presença da versão no código local não comprova exploração ou versão efetivamente carregada em produção.

<!-- Adicione novas linhas com IDs sequenciais. Feche movendo status para "fechado" com data. -->
## 2026-10-27 — Views SECURITY DEFINER de produção

Consulta de metadados autorizada identificou `pcm.auvo_sync_health`, `pcm.auvo_sync_error_details` e `comercial.portal_propostas` como views do proprietário `postgres`, SELECT para `authenticated` e sem SELECT para `anon`. Health e error_details filtram permissões a partir de claims JWT; health devolve `last_error` bruto, enquanto error_details aplica sanitização. Portal filtra papel/Cliente, mas retorna `proposta_versoes.payload` integral. Não foram lidos dados de clientes nem comprovada exploração; a revogação pode não refletir até renovação do token. `0230_E01-S184` prepara projeção restrita local e não foi implantada. Avaliar regras e consumidores, testes de revogação, isolamento e sanitização antes de qualquer mudança; `security_invoker` isolado pode quebrar acesso legítimo. Não houve alteração em produção.
