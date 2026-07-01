---
name: design-E01-S03-pmoc-schema
description: "Design arquitetural do sub-módulo PMOC — schema Postgres, entidades, geração de cronograma, integrações e cron jobs. Leia antes de qualquer implementação das stories E01-S03 a E01-S06."
alwaysApply: false
---

# Design — E01-S03: Sub-módulo PMOC (schema e contratos)

> **Tier:** Arquitetural — decisão de schema e fronteiras de domínio.
> **Pré-requisito para:** E01-S03, E01-S04, E01-S05, E01-S06.
> **Referência canônica de negócio:** `docs/blueprint/01-pcm-operacao.md` (seção Sub-módulo PMOC).
> **Aprovado por:** @architect — 2026-07-01.

---

## Decisão 1 — Schema Postgres

**Decisão:** Todas as tabelas PMOC vivem no schema `pcm` do Postgres, com prefixo `pmoc_`.

**Alternativa descartada:** schema próprio `pmoc.*` — criaria um novo bounded context sem justificativa, pois o PMOC é um sub-módulo legal do PCM (não é autônomo).

**Consequência:** O schema `pcm` cresce com as tabelas `pmoc_*`, mas a fronteira de domínio permanece clara pelo prefixo. Migrações PMOC seguem a convenção `NNNN_E01-S03_descricao.sql`.

---

## Decisão 2 — Relação entre `pmoc_equipment` e `pcm_equipment`

Ao criar um equipamento de AR no PMOC, o sistema cria **automaticamente** um espelho em `pcm.pcm_equipment`:

```
INSERT pmoc_equipment
  → trigger/Edge Function
  → INSERT pcm_equipment (discipline='climatizacao', pmoc_equipment_id=<id>)
```

Isso garante que o inventário geral do imóvel (`pcm_equipment`) inclua os ACs sem duplicação. O técnico nunca vê "PMOC" ou "PCM" separados — ele vê apenas a OS no Auvo.

---

## Decisão 3 — Geração de cronograma

Ao inserir em `pmoc_contracts`, uma **Edge Function Supabase** (não trigger PL/pgSQL) gera as 12 visitas anuais em `pmoc_schedules`. Razão: a lógica de data envolve cálculo de meses a partir de `start_date`, o que é mais legível em TypeScript.

**Regra de tipo por mês de contrato:**

| Meses (offset a partir de start_date) | Tipo |
|---------------------------------------|------|
| 1, 2, 4, 5, 7, 8, 10, 11 | `mensal` |
| 3, 9 | `trimestral` |
| 6 | `semestral` |
| 12 | `anual` |

A `scheduled_date` de cada visita é calculada como `start_date + N meses`, ajustada para o mesmo dia do mês (ou último dia se o mês for mais curto).

---

## Decisão 4 — Checklists canônicos

Os checklists (IDs `m_e_01`…`a_d_03`) são **constantes TypeScript** em `packages/shared/src/pmoc-checklists.ts`. Não são armazenados no banco — são estáticos e versionados no código. O banco armazena apenas os resultados (`pmoc_records.checklist` JSONB com `{id, checked, value?}`).

Esta decisão evita migration toda vez que a Sinérgica ajustar um item de checklist.

---

## Decisão 5 — Decisão postergada: Hub de OS

A relação entre `os_hub` (E01-S07) e as OS existentes no PCM (`pcm.ordens_servico`) não é decidida aqui. As opções são:

- **(a)** `os_hub` como nova tabela que projeta OS existentes + schedules PMOC → view unificada.
- **(b)** Refatorar `pcm.ordens_servico` para absorver os campos de tipo (C1/C2/P1/P2/IN) e SLA.

Esta decisão fica para o `design.md` de E01-S07 (não bloqueia E01-S03 a E01-S06).

---

## Diagrama de entidades

```
pcm.pmoc_properties (imóvel)
  │
  ├─► pcm.pmoc_equipment (inventário AC)
  │     │
  │     └─► pcm.pcm_equipment (inventário geral — espelho automático)
  │
  └─► pcm.pmoc_contracts (contrato PMOC)
        │
        ├─► pcm.pmoc_schedules (cronograma — gerado ao criar contrato)
        │     │
        │     └─► pcm.pmoc_records (laudo de visita — criado via webhook Auvo)
        │           │
        │           └─► pcm.pmoc_nonconformity_log (NCs persistentes)
        │
        └─► pcm.pmoc_microbio_analysis (laudos microbiológicos semestrais)
```

---

## Schema SQL (referência)

> **Nota:** Este schema é a fonte da verdade para as migrations. Toda alteração deve gerar nova migration com ID sequencial.

```sql
-- ─────────────────────────────────────────────────────────────────
-- Imóvel PMOC
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pmoc_properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES pcm.clientes(id),         -- FK nullable (imóvel pode existir antes do cliente PCM)
  name          TEXT NOT NULL,
  type          TEXT CHECK (type IN ('residencial','comercial','industrial','saude','outro')),
  address       TEXT,
  city          TEXT DEFAULT 'Campinas',
  state         TEXT DEFAULT 'SP',
  zipcode       TEXT,
  cnpj_cpf      TEXT,
  contact_name  TEXT,
  contact_role  TEXT,
  contact_phone TEXT,
  contact_email TEXT,                                      -- destino dos laudos PDF
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ
);
ALTER TABLE pcm.pmoc_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pmoc_properties FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Equipamento de AR Condicionado
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pmoc_equipment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES pcm.pmoc_properties(id),
  tag           TEXT NOT NULL,                             -- AC-01, AC-02... único por imóvel
  type          TEXT CHECK (type IN (
                  'split-hiwall','cassete','piso-teto','duto','vrf-vrv',
                  'fancoil','central-agua-gelada','self-contained','janeleiro','portatil','outro'
                )),
  brand         TEXT,
  model         TEXT,
  serial_evap   TEXT,
  serial_cond   TEXT,
  capacity_btu  INTEGER,
  location      TEXT,
  environment   TEXT,
  floor         TEXT,
  refrigerant   TEXT DEFAULT 'R-410A' CHECK (refrigerant IN ('R-22','R-410A','R-32','R-404A','R-407C','outro')),
  power_kw      NUMERIC,
  phase         TEXT CHECK (phase IN ('mono','bi','tri')),
  install_date  DATE,
  condition     TEXT DEFAULT 'bom' CHECK (condition IN ('bom','regular','ruim','critico')),
  photo_url     TEXT,
  active        BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID,
  deleted_at    TIMESTAMPTZ,
  UNIQUE (property_id, tag)
);
ALTER TABLE pcm.pmoc_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pmoc_equipment FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Inventário geral de equipamentos (cross-disciplina)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pcm_equipment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL,                         -- FK para pmoc_properties ou tabela de imóveis PCM
  pmoc_equipment_id UUID REFERENCES pcm.pmoc_equipment(id), -- preenchido quando for AR
  discipline        TEXT NOT NULL CHECK (discipline IN (
                      'eletrica','hidraulica','climatizacao','spci','civil','spda','outro'
                    )),
  type              TEXT,
  tag               TEXT NOT NULL,
  name              TEXT,
  brand             TEXT,
  model             TEXT,
  serial            TEXT,
  location          TEXT,
  install_date      DATE,
  last_maintenance  DATE,
  next_maintenance  DATE,
  condition         TEXT DEFAULT 'bom' CHECK (condition IN ('bom','regular','ruim','critico')),
  photo_url         TEXT,
  active            BOOLEAN DEFAULT TRUE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_by        UUID,
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE pcm.pcm_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pcm_equipment FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Contrato PMOC
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pmoc_contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID NOT NULL REFERENCES pcm.pmoc_properties(id),
  technician_name  TEXT DEFAULT 'Fabrício Medeiros',
  crea             TEXT,
  art_number       TEXT,
  art_date         DATE,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  status           TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado','renovar')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       UUID,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_by       UUID,
  deleted_at       TIMESTAMPTZ
);
ALTER TABLE pcm.pmoc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pmoc_contracts FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Cronograma de visitas (gerado automaticamente)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pmoc_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID NOT NULL REFERENCES pcm.pmoc_contracts(id),
  property_id      UUID NOT NULL REFERENCES pcm.pmoc_properties(id),
  scheduled_date   DATE NOT NULL,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('mensal','trimestral','semestral','anual')),
  month_ref        INTEGER CHECK (month_ref BETWEEN 1 AND 12),
  year_ref         INTEGER,
  status           TEXT DEFAULT 'agendado' CHECK (status IN ('agendado','realizado','atrasado','cancelado')),
  record_id        UUID,                                   -- FK para pmoc_records (preenchido após execução)
  auvo_os_id       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pcm.pmoc_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pmoc_schedules FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Registro de visita / laudo
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pmoc_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID REFERENCES pcm.pmoc_schedules(id),
  contract_id       UUID NOT NULL REFERENCES pcm.pmoc_contracts(id),
  property_id       UUID NOT NULL REFERENCES pcm.pmoc_properties(id),
  executed_date     DATE NOT NULL,
  time_start        TIME,
  time_end          TIME,
  maintenance_type  TEXT CHECK (maintenance_type IN ('mensal','trimestral','semestral','anual','corretiva')),
  technician_name   TEXT,
  auvo_os_number    TEXT,
  -- JSONB schemas: ver packages/shared/src/pmoc-checklists.ts
  equipment_records JSONB,   -- [{equipment_id, tag, services_executed, conformity, observations}]
  checklist         JSONB,   -- {mensal:{items:[{id,checked}]}, trimestral:..., semestral:..., anual:...}
  materials_used    JSONB,   -- [{item, qty, obs}]
  nonconformities   JSONB,   -- [{equipment_id, tag, description, severity, action, deadline}]
  observations      TEXT,
  pending_items     TEXT,
  next_visit_date   DATE,
  technician_signed BOOLEAN DEFAULT FALSE,
  client_signed     BOOLEAN DEFAULT FALSE,
  pdf_url           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_by        UUID
);
ALTER TABLE pcm.pmoc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pmoc_records FORCE ROW LEVEL SECURITY;

-- FK circular: schedules.record_id → records.id (adicionar após criar records)
ALTER TABLE pcm.pmoc_schedules ADD CONSTRAINT fk_pmoc_schedules_record
  FOREIGN KEY (record_id) REFERENCES pcm.pmoc_records(id);

-- ─────────────────────────────────────────────────────────────────
-- Análise microbiológica
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pmoc_microbio_analysis (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id               UUID NOT NULL REFERENCES pcm.pmoc_contracts(id),
  property_id               UUID NOT NULL REFERENCES pcm.pmoc_properties(id),
  analysis_date             DATE NOT NULL,
  lab_name                  TEXT,
  lab_accreditation         TEXT,
  collection_points         INTEGER,
  fungi_ufc_m3              NUMERIC,  -- limite legal: ≤ 750
  ie_ratio                  NUMERIC,  -- limite legal: ≤ 1,5
  coliforms_result          TEXT CHECK (coliforms_result IN ('ausencia','presenca')),
  status                    TEXT DEFAULT 'pendente' CHECK (status IN ('conforme','nao-conforme','pendente')),
  report_number             TEXT,
  report_url                TEXT,
  corrective_action_needed  BOOLEAN DEFAULT FALSE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  created_by                UUID
);
ALTER TABLE pcm.pmoc_microbio_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pmoc_microbio_analysis FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- Log de não-conformidades (NC)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE pcm.pmoc_nonconformity_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id           UUID REFERENCES pcm.pmoc_records(id),
  contract_id         UUID REFERENCES pcm.pmoc_contracts(id),
  equipment_id        UUID REFERENCES pcm.pmoc_equipment(id),
  tag                 TEXT,
  description         TEXT NOT NULL,
  severity            TEXT CHECK (severity IN ('alta','media','baixa')),
  recommended_action  TEXT,
  responsible         TEXT,
  deadline            DATE,
  completed_at        DATE,
  status              TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','em-andamento','fechado')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID
);
ALTER TABLE pcm.pmoc_nonconformity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcm.pmoc_nonconformity_log FORCE ROW LEVEL SECURITY;
```

---

## Edge Functions envolvidas

| Função | Gatilho | O que faz |
|--------|---------|-----------|
| `pmoc-generate-schedule` | POST após criar `pmoc_contracts` | Gera as 12 visitas em `pmoc_schedules` |
| `pmoc-auvo-create-os` | Cron diário 08:00 | Cria OS no Auvo para schedules com `scheduled_date = hoje + 7d` |
| `pmoc-daily-status` | Cron diário 00:01 | Atualiza `status → 'atrasado'` em schedules vencidos |
| `pmoc-alert-art` | Cron diário 08:00 | Alerta D-30 de vencimento de ART |
| `pmoc-alert-microbio` | Cron diário 08:00 | Alerta quando análise microbiológica vence em ≤ 30 dias |
| `auvo-webhook` | POST externo (Auvo) | Cria `pmoc_records`, atualiza `pmoc_schedules.status`, dispara geração de PDF |
| `pmoc-generate-pdf` | Após criar `pmoc_records` | Gera PDF do laudo, armazena em Storage, atualiza `pdf_url`, envia e-mail |

---

## Regras de negócio críticas

1. **Cronograma acumulativo:** O tipo `anual` executa anual + semestral + trimestral + mensal. O cronograma registra apenas o tipo mais alto por visita.

2. **Análise microbiológica obrigatória:** Na visita `semestral` (meses 6 e 12), `s_m_01/s_m_02/s_m_03` são marcados como `mandatory: true` no checklist. O UI deve bloquear fechar a visita sem confirmar a coleta.

3. **NC alta = alerta imediato:** Ao inserir em `pmoc_nonconformity_log` com `severity = 'alta'`, disparar notificação push + e-mail para Fabrício.

4. **Microbiológico não-conforme:** Se `fungi_ufc_m3 > 750` OU `ie_ratio > 1.5` OU `coliforms_result = 'presenca'` → `status = 'nao-conforme'`, `corrective_action_needed = TRUE`, alerta imediato.

5. **ART renovar:** `end_date - 30 dias <= hoje` → `status → 'renovar'` + notificação.

---

## ARCHITECTURE.md — atualização necessária

Ao implementar E01-S03, adicionar ao mapa de schemas em `docs/ARCHITECTURE.md`:

```
| `pcm` | PCM/Operação | (expandido) ordens_servico, backlog_items, visitas, inspecoes,
|       |              | clientes, tecnicos, preventivo, relatorios,
|       |              | pmoc_properties, pmoc_equipment, pcm_equipment, pmoc_contracts,
|       |              | pmoc_schedules, pmoc_records, pmoc_microbio_analysis,
|       |              | pmoc_nonconformity_log |
```
