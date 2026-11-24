---
name: plan
description: "Inventário real das tabelas PMOC, decisão de modelo e detalhe técnico de E01-S203 (migration 1871, RPCs, tela)."
alwaysApply: false
---

# Plan — E01-S203 · Plano PMOC criado à mão pelo PCM

## 1. Inventário real, levantado antes de escrever SQL

### Tabelas PMOC (`0023_E01-S03_pmoc_core.sql`)

| Tabela | Âncora | O que guarda |
|---|---|---|
| `pcm.pmoc_properties` | `client_id uuid` **nullable** → `pcm.clientes` | imóvel: nome, tipo, endereço, CNPJ/CPF, contato. Soft delete. |
| `pcm.pmoc_equipment` | `property_id` (cascade) | inventário de AR: tag (única por imóvel), tipo, BTU, fluido, condição, `active`. Soft delete. |
| `pcm.pmoc_contracts` | `property_id` (cascade) | ART, CREA, responsável técnico, `start_date`/`end_date`, `status in (ativo, encerrado, renovar)`. Soft delete. |
| `pcm.pmoc_schedules` | `contract_id` + `property_id` | cronograma: data, `maintenance_type in (mensal, trimestral, semestral, anual)`, `month_ref`/`year_ref`, `status`, `auvo_os_id`. |
| `pcm.pmoc_records` | `schedule_id`, `contract_id`, `property_id` | execução: checklist, materiais, não-conformidades, assinaturas, PDF. |
| `pcm.pmoc_microbio_analysis` | `contract_id`, `property_id` | laudo microbiológico (fungos UFC/m³, coliformes, acreditação). |
| `pcm.pmoc_nonconformity_log` | `record_id`, `contract_id`, `equipment_id` | não-conformidades com prazo e responsável. |

Todas com RLS **enable + force** (`0023`) e policies de leitura em `0143_E09-S03-S08`
(superadmin · módulo `pcm` leitura/escrita · síndico pelo `client_id` do imóvel).

### Plano de Manutenção (`0260_E01-S165`)

`pcm.planos_manutencao (id, cliente_id, nome, estado, revisao, created_*, updated_*)`
+ `modalidade text not null default 'padrao' check in ('padrao','pmoc')` (`1869_E01-S190`)
+ view `pcm.planos_pmoc` com `security_invoker` (`1869`).
Livro de comandos: `pcm.plano_comandos (request_id pk, actor_id, cliente_id, payload, resultado)`.

### Pontes que já existiam

- `pcm.rotina_origem_geracao` (`0337_E01-S166`): `origem in ('plano','pmoc')` — declaração, feita
  pelo PCM, de que um **ciclo** é de origem PMOC.
- `pcm.sso_vinculos_ciclo_pmoc` (`1631_E01-S166`): vínculo de **um ciclo** a **um agendamento**.

**Conclusão do inventário:** não há, nem nunca houve, correspondência 1:1 entre `pmoc_contracts` e
`planos_manutencao`. Nenhuma FK entre os dois mundos.

## 2. Por que `pcm.sso_vinculos_ciclo_pmoc` NÃO serve (avaliado primeiro, AC-1)

1. **Exige o Plano já existente**: FKs para `planos_manutencao` **e** para uma `plano_versoes` em
   estado `aprovado`. O problema desta story começa antes disso.
2. **Exige proposta e decisão**: `proposta_id` (`sso_propostas_mapeamento_pmoc`, único) e
   `decisao_id` com `decisao = 'validada_pcm'` — maquinário de mapeamento de ciclo, sem o que
   mapear enquanto não há rotina.
3. **Cardinalidade errada**: uma linha por ciclo/visita. São esperadas muitas por contrato; ela não
   pode impedir dois Planos para o mesmo Contrato (AC-2).
4. **`contrato_pmoc_id` é derivado** do agendamento, não a chave do vínculo.

Por isso: vínculo próprio e mínimo, que **não substitui** o de ciclo — quando o Plano criado aqui
ganhar rotinas, `1631` continua sendo o caminho de cada vencimento até cada visita do cronograma.

## 3. Migration `1871_E01-S203_plano_pmoc_do_contrato.sql`

### 3.1 `pcm.sso_vinculos_plano_contrato_pmoc`

```
id uuid pk · request_id uuid not null unique
cliente_id uuid not null → pcm.clientes
contrato_pmoc_id uuid not null UNIQUE → pcm.pmoc_contracts   -- AC-2
plano_id uuid not null UNIQUE → pcm.planos_manutencao        -- AC-2 (dos dois lados)
imovel_id uuid not null → pcm.pmoc_properties
derivado jsonb not null   -- fotografia do que foi herdado; NÃO é fonte de verdade
ator_id uuid not null → auth.users · criado_em timestamptz default now()
```

RLS enable + **force**; `revoke all` de `public, anon, service_role`; `grant select` a
`authenticated` + policy `config.sso_autorizar_acao('plano.gerir', cliente_id)`. **Nenhum INSERT
concedido**: só a RPC `security definer` escreve. Append-only pelo gatilho
`pcm.sso_proteger_conferencia_levantamento()` (`0327`), o mesmo que `1631` usa — erro
`conferencia_imutavel`.

### 3.2 `pcm.sso_criar_plano_do_contrato_pmoc(ator, request_id, cliente, contrato, nome, confirma)`

Ordem dos passos (importa):

1. validação de parâmetros → `parametros_invalidos` (22023);
2. **confirmação humana** → `criacao_nao_confirmada` (22023) se `p_confirma_criacao` ≠ `true`;
3. **idempotência** por `request_id` em `pcm.plano_comandos`, sob `pg_advisory_xact_lock` — vem
   **antes** da leitura do contrato, para o pedido repetido devolver o mesmo recibo mesmo que o
   contrato tenha mudado de estado desde então; payload divergente → `request_id_conflitante`;
4. gate + capacidade: `pcm.sso_conferir_pmoc_mediado(ator, cliente, false)` (`1630`) —
   `pcm.sso_pmoc_mediado_gate` + `pcm.sso_diagnostico_pmoc_gate` + `plano.gerir`;
5. lock por contrato (`plano-pmoc-contrato:<id>`) e `select … for update nowait`;
6. recusas próprias: `contrato_pmoc_indisponivel` (42501) para inexistente, soft-deleted ou de
   outro Cliente; `contrato_pmoc_sem_cliente` (23514) para imóvel sem `client_id`;
   `contrato_pmoc_ja_tem_plano` (23505) para contrato já convertido;
7. herança derivável: equipamentos ativos, periodicidades do cronograma vivo (visita cancelada não
   conta), ART, CREA, vigência, imóvel; nome = `p_nome` ou `PMOC — <imóvel>` (≤200);
8. `insert` do Plano (`modalidade = 'pmoc'`, estado `rascunho`, revisão 1) + do vínculo;
9. `audit.events` (`plano.criado_do_contrato_pmoc`) + `pcm.plano_comandos`.

Recibo: `{requestId, planoId, vinculoId, contratoPmocId, clienteId, nome, modalidade: 'pmoc',
estado: 'rascunho', revisao: 1, criadoPorHumano: true, rotinasCriadas: 0,
contratoPmocPreservado: true, derivado}`. `rotinasCriadas: 0` é contrato de interface: o adapter
**recusa** um recibo que diga outra coisa, porque isso seria a alternativa (a).

`revoke all` inclusive de `service_role`; `grant execute` só a `authenticated`.

### 3.3 Indicador

- `pcm.sso_listar_contratos_pmoc_sem_plano(ator, cliente, limite)` → contratos vivos do Cliente sem
  vínculo, com imóvel, ART, vigência, status, equipamentos ativos, nº de visitas e periodicidades.
  `limite` entre 1 e 500, senão `consulta_invalida`.
- `pcm.sso_resumir_cobertura_plano_pmoc(ator, cliente)` → `contratos_total`,
  `contratos_com_plano`, `contratos_sem_plano`, `planos_modalidade_pmoc` e **`contratos_sem_cliente`
  (contagem global)**. Esta última não vaza dado de Cliente — por definição essas linhas não
  pertencem a Cliente nenhum — e sem ela "faltam zero" seria inalcançável por recorte.

Ambas passam pelo mesmo `sso_conferir_pmoc_mediado(…, false)`: gate fechado e falta de capacidade
são **erro nomeado**, nunca lista vazia.

## 4. Front

- `domain/plano-pmoc-manual.ts` (puro): tipos, `percentualConvertido`, `nomeSugeridoDoPlano`
  (idêntico à derivação da RPC, para tela e banco não divergirem), `motivoDoErroPmoc`,
  `FRASE_PMOC_INDISPONIVEL` (5 motivos), `FRASE_NENHUM_CONTRATO_PENDENTE`,
  `FRASE_CLIENTE_SEM_PMOC`, `mensagemDeErroDeCriacao` (uma frase por recusa nomeada).
- `application/plano-pmoc-queries.ts`: `planoPmocQueryKeys.pendentes/cobertura`.
- `infrastructure/supabase-plano-pmoc-adapter.ts`: Zod `.strict()` nas listas, recibo validado e
  conferido contra o pedido; erro do banco sobe **cru** para a tela escolher a frase.
- `interfaces/plano-manutencao/ContratosPmocSemPlano.tsx`: dentro do Workspace de Planos (Visão do
  Cliente), atrás de `VITE_SSO_PLANO_PMOC_MANUAL_ENABLED`, `retry: false`, confirmação antes de
  criar, invalidação de `pendentes`, `cobertura` e da raiz de `planoManutencaoKeys`.

## 5. Procedimento de abertura (ordem importa)

1. abrir `pcm.sso_pmoc_mediado_gate` e `pcm.sso_diagnostico_pmoc_gate` (`update … set habilitado =
   true where id`). **Os dois são compartilhados** com a jornada de mapeamento de ciclo PMOC de
   E01-S166 — abri-los liga também aquelas telas; combine antes com quem opera PMOC;
2. conceder `plano.gerir` ao usuário do PCM no Cliente (`config.sso_concessoes`); a ação tem
   `exige_concessao_individual = true`, então perfil não basta;
3. ligar `VITE_SSO_PLANO_PMOC_MANUAL_ENABLED=true` no build.

**Retorno:** desligar a flag devolve a tela ao estado anterior, sem efeito em banco. Fechar os
gates volta a recusar as RPCs com erro nomeado. Nada disso apaga Plano ou vínculo já criados — o
reverso de um Plano é o fluxo de Plano (encerramento), nunca `delete`.

## 6. O que fica para a próxima fatia

- Montar as Rotinas do Plano criado (hoje ele nasce vazio, de propósito) e ligar cada vencimento ao
  `pmoc_schedules` por `pcm.sso_vinculos_ciclo_pmoc` (`1631`) — exige versão aprovada.
- Conversão em lote e desfazer conversão.
- Correção dos Contratos PMOC em imóvel sem Cliente.
- Retirada do PMOC do menu, com o indicador desta story em zero e os órfãos resolvidos.
