---
name: runbook-backlog-aprovado-ativacao
description: Procedimento de abertura e retorno do Backlog aprovado (E01-S193) — 6 gates, grants, flags. Puxe antes de habilitar ou desligar o fluxo Pendência→Backlog→Chamado em produção.
alwaysApply: false
---

# Runbook — Ativação do Backlog aprovado (E01-S193)

> Nasce de `ADR-1689`: o maquinário de banco e o front já existiam (`0375`/`0377`/`0890`/`0895`/
> `1830`, mais `Composicoes.tsx`/`PromoverComposicao.tsx` já montados em `VisaoClientePage.tsx`),
> nunca habilitados por desenho — `ADR-0665`/`ADR-0670`/`ADR-0151` exigiam revisão adversarial
> antes de abrir qualquer gate. Este runbook é o procedimento **de abrir**, não de construir.

## Cenário

Habilitar (ou reverter) o fluxo "Pendência → item de Backlog → (seleção do PCM) → Chamado em
Demanda", exigido pelo Pacote Consolidado do Fabrício (BL 002). Usar ao ir ao ar com E01-S193 ou
ao precisar desligar o fluxo por incidente.

## ⚠ Acoplamento com E01-S167 — leia antes de abrir

`chamado_os_gate` **não é exclusivo** desta story. É o MESMO gate da transição Chamado 1:N OS
(`1842`, `E01-S167`) que hoje mantém fechado "criar OS a partir do front segue exigindo o caminho
legado" para QUALQUER Chamado, não só os vindos do Backlog. **Abrir este gate para E01-S193 reativa
simultaneamente a capacidade de E01-S167 em todo o sistema.** Confirmar com o Fabrício/PCM que essa
reativação ampla é intencional e esperada — não é um efeito colateral aceitável sem aviso.

## Pré-condições (bloqueantes)

- [ ] `/revisao-adversarial` desta story (task 19) com **zero achado alto/médio** — não confundir
      com a revisão da task 5 (comandos pré-existentes); esta cobre o que a própria story 1854 traz.
- [ ] `scripts/inventariar-backlog-legado.mjs` rodado contra o banco de **produção real** (não o
      resultado local, que deu `totalGeral: 0` — precisa confirmar o mesmo em prod) e revisado com
      o PCM (task 3/12).
- [ ] Legado classificado (task 12) — toda OS `status='backlog'` virou item de Backlog ou ficou com
      estado próprio, nunca apagada. Se o inventário de produção confirmar zero registros, este
      passo é trivial (nada a classificar) mas ainda precisa ser **confirmado**, não presumido.
- [ ] CI verde no PR de E01-S193 (`db-tests` não pulado).

## Procedimento de abertura

1. Aplicar as migrations desta story (CI/GitHub Integration faz isso no merge — não rodar manual
   em produção).
2. Confirmar grants: `1839_E01-S187_grants_rpcs_ui_com_gate.sql` já concede `execute` a
   `authenticated` em `sso_compor_backlog_pendencias`, `sso_priorizar_composicao`,
   `sso_dividir_composicao_backlog`, `sso_promover_backlog_chamado`; `1854_E01-S193` concede em
   `sso_liberar_escopo_backlog`. Nenhum grant novo necessário — só conferir que nenhum foi revogado
   por engano numa migration posterior (`grep -rn "revoke.*sso_liberar_escopo_backlog" supabase/migrations`).
3. Abrir os 6 gates, **nesta ordem**, por migration aditiva (`update ... set habilitado = true`):
   1. `sso_backlog_composicao_gate` (AC-1/2 — compor Pendências em item de Backlog).
   2. `sso_divisao_backlog_gate` (AC-5 — dividir composição).
   3. `sso_backlog_chamado_gate` (vínculo composição↔Chamado).
   4. `sso_backlog_parcela_gate` (vínculo pendência↔parcela).
   5. `chamado_os_gate` — **só depois de confirmar o aviso da seção anterior**.
   6. `sso_promocao_backlog_gate` (AC-4/5 — liberação em si; depende dos 5 anteriores por desenho
      do próprio `0890`, linha `dependencias_promocao_bloqueadas`).
4. Declarar as flags do front (`VITE_SSO_PENDENCIAS_TECNICAS_ENABLED`,
   `VITE_SSO_BACKLOG_COMPOSICAO_ENABLED`, `VITE_SSO_DIVIDIR_BACKLOG_ENABLED`,
   `VITE_SSO_PROMOVER_BACKLOG_CHAMADO_ENABLED`, `VITE_SSO_CLIENTE360_BACKLOG_ESCOPO_ENABLED`) em
   `.env.example`/`netlify.toml`, valor `true` — **depende do registro `FLAGS_SSO` de `E00-S28`
   já estar mesclado**; se não estiver, usar o padrão pré-`E00-S28` (`import.meta.env.VITE_...`
   direto, já é como o código lê hoje) e migrar quando `E00-S28` chegar.
5. Republicar o front (Netlify redeploy ou o próprio merge, conforme `VITE_*` for build-time).
6. Validar: abrir Cliente 360 de um cliente de teste → aba Pendências Técnicas → selecionar →
   "Compor Backlog" → "Promover composição ao Chamado" → confirmar Chamado nasce com status
   "Em triagem (Backlog aprovado)" na UI.

## Procedimento de retorno (desligar)

1. Fechar os 6 gates na **ordem inversa** da abertura (`sso_promocao_backlog_gate` primeiro,
   `sso_backlog_composicao_gate` por último) — qualquer chamada em andamento passa a recusar com
   `55000`, sem escrita parcial (cada RPC checa o próprio gate antes de qualquer `insert`/`update`).
2. Desligar as flags do front (`false`) e republicar.
3. **Não reverter a classificação do legado** (task 12) — ela é aditiva e auditada, não
   destrutiva. Reverter classificação é operação à parte, por RPC de correção, nunca `delete`.
4. Chamados já criados em `'demanda'` continuam existindo e acessíveis (RLS normal); só a
   **criação de novos** para por causa do gate.

## Validação (abriu corretamente?)

- [ ] `select habilitado from pcm.sso_promocao_backlog_gate` (e os outros 5) = `true`.
- [ ] `node scripts/check-flags-declaradas.mjs` verde (zero flag usada e não declarada).
- [ ] Teste manual do passo 6 da abertura concluído com sucesso.
- [ ] `audit.events` registra `backlog.liberado_demanda` para a ação de teste.

## Autoridade e SLA

- Quem executa: Lucas (merge de migration + toggle de flag no Netlify/Supabase Dashboard).
- Quem aprova a abertura: Fabrício (dono do produto) — em particular o acoplamento com
  `chamado_os_gate` (seção de aviso acima).
- Sem SLA de emergência — é ativação planejada, não incidente. Se abrir e algo quebrar em
  produção, o retorno acima vira ação de incidente com SLA normal de rollback.

## Pós-ativação

- Acompanhar `audit.events` filtrado por `action in ('backlog.composto','backlog.promovido_chamado','backlog.liberado_demanda','backlog.composicao_dividida')` na primeira semana — qualquer `errcode` inesperado nos logs do Postgres indica um caminho não coberto pelo `/revisao-adversarial` da task 19.
