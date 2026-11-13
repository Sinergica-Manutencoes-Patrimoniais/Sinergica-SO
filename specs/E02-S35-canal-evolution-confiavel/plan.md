---
name: plan
description: Detalhe técnico de E02-S35 — SQL, assinaturas, contratos. Puxe ao implementar.
alwaysApply: false
---

# Plan — E02-S35 · Canal Evolution confiável

## Arquitetura

```
apps/web/src/features/atendimento/
  domain/evolution-compatibilidade.ts   (novo, puro)  matriz + avaliarCompatibilidade
  domain/canal-evolution.ts             (novo, puro)  estados, transições, saúde
  application/configurar-evolution.ts   (novo)        porta + sequência atômica
  application/verificar-canal.ts        (novo)        verificação sob demanda
  infrastructure/supabase-evolution-adapter.ts (estende) ações server-side via Edge Function
  components/ConfiguracaoEvolution.tsx  (novo)        máquina de vistas
  components/EvolutionTab.tsx           (altera)      usa a nova máquina

supabase/functions/
  _shared/evolution-url.ts              (novo)  anti-SSRF: validarUrlDoServidor, resolverEnderecosPublicos
  _shared/evolution-matriz.ts           (novo)  ESPELHO de domain/evolution-compatibilidade.ts
  evolution-configurar/index.ts       (novo)   ações salvar_servidor | criar_instancia | instalar_webhook
```

> **Espelho obrigatório.** Deno não importa do bundle Vite. `_shared/evolution-matriz.ts` é cópia literal
> de `domain/evolution-compatibilidade.ts`. Um teste compara as duas listas e falha se divergirem.

## Migrations

Sequência: a última aplicada é `1828`. Esta story usa **1829, 1830, 1831**.

### `1829_E02-S35_canal_provedor_estado_saude.sql`

```sql
alter table atendimento.canais_externos
  add column if not exists provedor          text,
  add column if not exists estado_conexao    text,
  add column if not exists saude             text,
  add column if not exists ultimo_sucesso_em timestamptz,
  add column if not exists ultimo_erro_em    timestamptz;

-- Backfill sem adivinhação (AC-10)
update atendimento.canais_externos set provedor = case
  when tipo = 'evolution' then 'evolution-api'
  when tipo = 'meta_wa'   then 'meta-whatsapp'
  else 'desconhecido' end
where provedor is null;

update atendimento.canais_externos set estado_conexao = case
  when status_conexao = 'conectado' then 'conectado_verificado'
  else 'sem_credencial' end
where estado_conexao is null;

update atendimento.canais_externos set saude = 'desconhecida' where saude is null;

alter table atendimento.canais_externos
  alter column provedor       set default 'desconhecido', alter column provedor       set not null,
  alter column estado_conexao set default 'sem_credencial', alter column estado_conexao set not null,
  alter column saude          set default 'desconhecida',  alter column saude          set not null,
  add constraint canais_externos_provedor_valido check (
    provedor in ('evolution-api','meta-whatsapp','desconhecido')) not valid,
  add constraint canais_externos_estado_valido check (estado_conexao in (
    'sem_credencial','configurado','configuracao_incompleta',
    'aguardando_pareamento','conectado_verificado','desconectado')) not valid,
  add constraint canais_externos_saude_valida check (
    saude in ('desconhecida','saudavel','degradada')) not valid;
```

> `status_conexao` **continua existindo** e sincronizada por trigger, para não quebrar
> `atendimento-evolution` nem `EvolutionTab` enquanto a UI migra.
> Reverso no cabeçalho do arquivo, como manda `db/README.md`.

### `1830_E02-S35_evolution_servidor_instancia.sql`

```sql
create table if not exists atendimento.evolution_servidor (
  id uuid primary key default gen_random_uuid(),
  url_base text not null check (length(btrim(url_base)) between 1 and 500),
  versao_detectada text,
  estado text not null default 'pendente'
    check (estado in ('pendente','compativel','incompativel')),
  motivo_incompatibilidade text,
  credencial_ref text,
  indicio text not null default '' check (length(indicio) <= 4),
  geracao integer not null default 1 check (geracao > 0),
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atendimento.evolution_instancia (
  canal_id uuid primary key references atendimento.canais_externos(id) on delete cascade,
  nome_remoto text not null unique check (length(nome_remoto) between 1 and 200),
  token_ref text,
  webhook_secret_ref text,
  estado text not null default 'criando' check (estado in (
    'criando','configuracao_incompleta','aguardando_pareamento',
    'conectado_verificado','desconectado')),
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table atendimento.evolution_servidor  enable row level security;
alter table atendimento.evolution_servidor  force  row level security;
alter table atendimento.evolution_instancia enable row level security;
alter table atendimento.evolution_instancia force  row level security;

revoke all on table atendimento.evolution_servidor,  atendimento.evolution_instancia
  from public, anon, authenticated;
grant select, insert, update on atendimento.evolution_servidor, atendimento.evolution_instancia
  to authenticated;
grant select, insert, update, delete on atendimento.evolution_servidor,
  atendimento.evolution_instancia to service_role;

create policy "evolution_servidor_superadmin" on atendimento.evolution_servidor
  for all to authenticated
  using      (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

create policy "evolution_instancia_superadmin" on atendimento.evolution_instancia
  for all to authenticated
  using      (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

-- Trigger: estado da instância projeta estado/saúde do canal (compat com status_conexao)
create or replace function atendimento.fn_sincronizar_estado_canal_evolution() ...
```

### `1831_E02-S35_cofre_referencia_opaca.sql`

Estende o cofre existente (`config.fn_obter_segredo_integracao_interno`) com **escrita por referência
opaca e geração**:

```sql
create or replace function config.fn_gravar_segredo_referenciado(p_ref text, p_valor text)
  returns void language plpgsql security definer set search_path = config, vault, public as $$
begin
  if p_ref !~ '^SINERGICA_[A-Z0-9]+_[0-9]+_[0-9a-f]{32}$' then
    raise exception 'referencia_invalida';
  end if;
  ...
end $$;
-- idem fn_ler_segredo_referenciado, fn_remover_segredo_referenciado
revoke all on function config.fn_gravar_segredo_referenciado(text,text)
  from public, anon, authenticated;
grant execute on function config.fn_gravar_segredo_referenciado(text,text) to service_role;
```

Formato da referência: `SINERGICA_<RECURSO>_<GERACAO>_<ID>`. As funções **só** aceitam esse formato —
não servem para ler outros segredos do Vault. `anon` e `authenticated` (inclusive superadmin) não
executam nenhuma delas e não têm `usage` no schema `vault`.

## Contratos

### Domínio (puro, sem I/O)

```ts
// domain/evolution-compatibilidade.ts
export type Capacidade = 'instanceCreate'|'qr'|'connectionState'|'webhookHeaders'
  |'webhookEvents'|'sendText'|'deliveryStatus'
export const CAPACIDADES_OBRIGATORIAS: readonly Capacidade[]
export interface EntradaDaMatriz { versao: string; capacidades: readonly Capacidade[] }
export type ResultadoDeCompatibilidade =
  | { compativel: true; versao: string }
  | { compativel: false; motivo: string }   // "Versao X nao prova: webhookHeaders, qr."
export function avaliarCompatibilidade(
  matriz: readonly EntradaDaMatriz[], versaoInstalada: string): ResultadoDeCompatibilidade

// domain/canal-evolution.ts
export type EstadoDoCanal = 'sem_credencial'|'configurado'|'configuracao_incompleta'
  |'aguardando_pareamento'|'conectado_verificado'|'desconectado'
export type SaudeDoCanal = 'desconhecida'|'saudavel'|'degradada'
export function salvarCredencial(canal, ref): Canal      // sempre volta a 'configurado'  (AC-6)
export function marcarConectado(canal): Canal            // lança se não há credencial
export function registrarSucesso(canal, quando): Canal
export function registrarErro(canal, quando): Canal
export function marcarSessaoCaida(canal, quando): Canal  // desconecta E registra erro
export function precisaReescanear(canal): boolean        // desconectado && credencialRef !== null
```

### Application

```ts
export interface PortaDeConfiguracaoEvolution {
  criarInstancia(canalId: string): Promise<{ estado: string; jaExistia: boolean }>
  instalarWebhook(canalId: string): Promise<{ estado: string }>
}
// Sequência atômica: cria → instala. Falha em instalar sobe sem disfarce (AC-5).
export async function configurarInstanciaEvolution(
  porta: PortaDeConfiguracaoEvolution, canalId: string): Promise<{ estado: string }>

export interface VerificadorDeCanal {
  verificar(canal: Canal): Promise<{ sucesso: boolean; falhaDeAutenticacao?: boolean; mensagem: string }>
}
export async function verificarCanal(v: VerificadorDeCanal, canal: Canal, agora?): Promise<CanalVerificado>
```

### Edge Function `evolution-configurar (função nova)` — ações novas

| Ação | Corpo | Resposta | Erros |
|---|---|---|---|
| `salvar_servidor` | `{ urlBase, apikeyGlobal }` | `{ estado, versao, motivo? }` | `url_recusada`, `servidor_indisponivel`, `versao_incompativel` |
| `criar_instancia` | `{ canalId }` | `{ estado, jaExistia }` | `servidor_incompativel`, `instancia_falhou` |
| `instalar_webhook` | `{ canalId }` | `{ estado }` | `webhook_falhou` |
| `reiniciar_pareamento` | `{ canalId }` | `{ estado }` | — |

Todas exigem sessão **superadmin** (`requireAuth` + checagem de papel), origem válida e CSRF, no mesmo
molde das funções existentes.

### Anti-SSRF — `_shared/evolution-url.ts`

```ts
export async function validarUrlDoServidor(url: string, deps: DependenciasDeRede):
  Promise<{ ok: true; origem: string } | { ok: false; motivo: string }>
export async function resolverEnderecosPublicos(hostname: string): Promise<string[]>
```

Regras: HTTPS obrigatório em produção; sem `username`/`password`/`search`/`hash`; resolve A/AAAA
**a cada chamada**; nega `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`,
`fc00::/7`, `fe80::/10`; `redirect: 'error'` em todo `fetch`; só a origem exata validada pode ser
chamada pelo adapter.

### Chamadas à Evolution

```
GET  {urlBase}/                             -> { version }            (probe)
POST {urlBase}/instance/create              { instanceName, qrcode:true, integration, webhook }
POST {urlBase}/webhook/set/{instanceName}   { enabled, url, headers, base64:false, events[] }
```

`instanceName = nomeRemotoDaInstancia(canalId)` — derivado, nunca do client.
Eventos: `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `SEND_MESSAGE`.

## Log e auditoria

Log registra `canal_id`, ação, latência e código HTTP. **Nunca** URL completa com credencial, apikey,
QR, telefone completo nem corpo. Auditoria em `audit.*` com os mesmos campos.

## Riscos

- `status_conexao` legado e `estado_conexao` novo coexistem; a trigger é a única fonte de sincronia.
  Divergência silenciosa é o risco número um — teste pgTAP cobre as 6 transições.
- A matriz de compatibilidade começa com a versão hoje em produção. Versão nova exige PR com smoke de
  contrato antes de entrar na matriz.
