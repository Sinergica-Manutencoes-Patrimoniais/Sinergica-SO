---
name: design
description: Technical Design Doc — schema profissional de inspeções (ABNT NBR 16747), parametrização por tipo/checklist, Supabase Storage para mídia, migração da E01-S19.
alwaysApply: false
---

# Technical Design Doc — Inspeções ABNT NBR 16747 (E01-S73)

## Contexto
Ver `product.md`. Reconstrói a inspeção da E01-S19 (`0019_E01-S19_inspecoes_laudos_spda.sql`).
Estado atual (do Explore): `pcm.inspecoes` (cabeçalho enxuto) + `pcm.inspecao_itens` (sistema/
localização/descrição/resultado/severidade/recomendação/prazo/foto_url) + trigger de recálculo de
totais (`fn_recalcular_totais_inspecao`). RLS de update **já existe** (`0019:141-175`), mas nenhuma
camada app/UI usa. Sem parametrização, sem Storage. Padrões do repo: RLS FORCE, migration
`NNNN_E01-S73_*.sql` (próximo número livre a partir de `0085`), hexagonal em `features/pcm/`.

## Goals / Non-goals
**Goals:** cabeçalho + itens ricos (NBR 16747), tipos de inspeção + checklists parametrizáveis,
edição completa, mídia por item via Storage, admin de templates.
**Non-goals:** geração de PDF do laudo, assinatura digital, reconstruir laudo SPDA.

## Schema novo (schema `pcm`)

Estratégia: **estender + criar**, preservando `pcm.inspecoes`/`pcm.inspecao_itens` (não dropar —
tem dados/uso possível) e adicionando colunas + tabelas de parametrização. Colunas novas nas tabelas
existentes entram aditivas (nulas no histórico).

### Parametrização (novo)
```sql
pcm.tipos_inspecao (
  id uuid pk, nome text not null,            -- "Predial", "Elétrica", "SPDA", "Hidráulica"...
  norma_tecnica text,                         -- "ABNT NBR 16747" etc
  descricao text, ativo boolean default true,
  created_at/by, updated_at/by
)
pcm.checklist_templates (
  id uuid pk, tipo_inspecao_id uuid not null references pcm.tipos_inspecao,
  nome text not null, ativo boolean default true, ...
)
pcm.checklist_template_itens (
  id uuid pk, template_id uuid not null references pcm.checklist_templates on delete cascade,
  categoria text, sistema text, elemento text,   -- campos guia do item esperado
  ordem int, obrigatorio boolean default false, ...
)
```

### Cabeçalho — `pcm.inspecoes` (colunas aditivas)
`codigo text` (gerado, ex. `INSP-XXXX`), `tipo_inspecao_id uuid references pcm.tipos_inspecao`,
`edificacao text`, `endereco text`, `hora_inicio time`, `hora_fim time`, `inspetor text`,
`responsavel_no_local text`, `escopo text`, `norma_tecnica text`, `art text`, `condicoes text`,
`anexos jsonb default '[]'`. (Já existem: client_id, titulo, data_inspecao, responsavel_tecnico,
status, observacoes_gerais, totais.)

### Itens — `pcm.inspecao_itens` (colunas aditivas)
`categoria text`, `elemento text`, `identificacao text`, `grau_risco text` (baixo/médio/alto/
crítico), `estado_conservacao text`, `anomalia text`, `medicoes jsonb`, `midias jsonb default '[]'`
(refs de Storage: {tipo:'foto'|'video'|'documento', path, nome}), `responsavel_acao text`,
`observacoes text`. (Já existem: sistema, localizacao, descricao, resultado, severidade,
recomendacao, prazo_recomendado, foto_url, ordem.) Ampliar o CHECK de `resultado` para incluir
`nao_aplicavel` (NBR: Conforme/Não Conforme/Não Aplicável).

Todas as tabelas novas: RLS FORCE + policies por `user_modulos.pcm` (leitura/escrita), padrão do
repo. `delete` para `authenticated` onde fizer sentido (templates), mantendo o padrão de 0019.

## Storage (primeiro uso real no repo)
Bucket **privado** `inspecoes-midia`. Acesso via signed URL (upload e leitura). RLS/policy de
Storage restringindo a usuários com `pcm` (leitura para ver, escrita para subir). Path por inspeção/
item (`inspecoes/{inspecao_id}/{item_id}/{uuid}.{ext}`). Registrar em ADR (primeiro Storage do
projeto — decisão durável). Limite de tamanho no client (ex.: foto ≤ 10MB, vídeo ≤ 100MB) para
controlar custo. Mídia vinda do Auvo (import) continua como URL em `foto_url`/`midias` (sem subir
pro Storage).

## Camadas (hexagonal)
- **domain**: entidades `Inspecao`, `InspecaoItem`, `TipoInspecao`, `ChecklistTemplate` + validações
  (resultado válido, grau de risco, campos obrigatórios do template).
- **application**: casos de uso criar/editar/excluir inspeção e item, listar, aplicar template
  (pré-carregar itens do checklist ao criar), CRUD de tipos/templates. Porta `qualidade-gateway.ts`
  ganha `editarInspecao`, `editarItem`, `excluir*`, `criarTipoInspecao`, `criarTemplate`, etc.
- **infrastructure**: `supabase-qualidade-adapter.ts` ganha `.update()`/`.delete()` (hoje só
  insert/select) + upload/download de mídia via Storage.
- **UI**: `InspecoesPage` reconstruída em 2 partes (Dados + Itens) com edição; nova
  `TiposInspecaoPage`/admin de templates (supervisor).

## Decisões técnicas
- **D-1 Reconstruir por extensão, não drop:** preserva dados existentes; colunas novas nulas no
  histórico. Migração de dados mínima (o que já existe continua válido).
- **D-2 Template pré-carrega itens:** ao criar inspeção de um tipo, os itens do
  `checklist_template_itens` viram itens da inspeção (categoria/sistema/elemento pré-preenchidos,
  resultado a preencher). Editável.
- **D-3 Storage privado + signed URL:** dado de laudo é sensível; nunca bucket público. RLS por
  módulo PCM.
- **D-4 Admin de templates é PCM:escrita + papel supervisor/superadmin** (parametrização é
  configuração, não operação diária).

## Alternativas consideradas
- **Estender só o schema atual (sem parametrização):** rejeitado — o PO pediu templates
  configuráveis e edição, e o modelo NBR exige campos que a E01-S19 não tem.
- **Bucket público de mídia:** rejeitado — laudo é sensível (segurança OS-grade do projeto).
- **Reconstruir dropando as tabelas:** rejeitado — risco com dados em produção; extensão é segura.

## Riscos
- Volume de dados em produção nas tabelas de inspeção — confirmar antes; migração aditiva é segura
  de qualquer forma.
- Custo/limite de vídeo no Storage — limite no client + política de retenção futura.
- Primeiro Storage do repo — precisa de ADR + setup de bucket/policy (pode exigir passo manual no
  Dashboard Supabase ou migration de Storage policy).

## Questões em aberto (não bloqueiam o design)
1. Geração do PDF do laudo — story futura (o modelo já prepara os campos).
2. Retenção/limpeza de vídeos antigos no Storage — política futura.
