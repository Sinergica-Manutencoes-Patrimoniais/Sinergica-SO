---
name: spec
description: Contrato — fundação do módulo Comercial: schema comercial (funil, oportunidades), view relacionamento.contas, Lista de Contas e aba Comercial na Visão 360.
alwaysApply: true
---

# Spec — E03-S01 · Fundação do Comercial + Conta única

> **Fonte da verdade.** Status: pronto para implementar · Tier: **arquitetural**
> `design.md` e `product.md` desta pasta são leitura obrigatória antes de codar; ADR-0019
> (propriedade de dados) e ADR-0020 (Conta única) definem as fronteiras.
> Primeira story do E03 — o schema `comercial` só tem `comercial.leads` (vazia) hoje.
> Auto-contida: contexto completo em `product.md`/`design.md`; padrões do repo em `CLAUDE.md`.

## Resumo

Cria o funil comercial como **enriquecimento** da Conta: schema `comercial` (etapas configuráveis,
motivos de perda, oportunidades, eventos) com RLS FORCE, a view `relacionamento.contas` como
interface pública do Shared Kernel `pcm.clientes`, e duas telas — **Lista de Contas** (todas:
lead, prospecto, ativa, antiga) e a **aba Comercial dentro da Visão 360** que já existe. Deprecia
`pcm.clientes.tipo`/`status_comercial` sem removê-las. É o pré-requisito de todas as demais
stories E03.

**Verificado em produção antes de especificar** (2026-08-10): `comercial.leads` = 0 linhas,
`tipo='lead'` = 0, `status_comercial='prospecto'` = 0, vínculos `comercial_lead` = 0.
**Não há migração de dados nesta story.**

## Critérios de aceite

### AC-1: Schema com RLS FORCE por módulo
- **Dado** as migrations aplicadas (`comercial.etapas_funil`, `motivos_perda`, `oportunidades`,
  `oportunidade_eventos` — contrato de colunas no `design.md` §2.1)
- **Quando** um usuário sem `comercial` em `user_modulos` (e não-superadmin) consulta qualquer uma
  delas
- **Então** recebe zero linhas; com `leitura` lê mas não escreve; com `escrita` (ou superadmin)
  faz CRUD — provado por pgTAP, padrão de `supabase/tests/`

### AC-2: Seed do funil padrão
- **Dado** a migration da S01 aplicada
- **Quando** a tela de Funil (ou a configuração de etapas) carrega
- **Então** existem 6 etapas na ordem `Lead → Qualificado → Proposta enviada → Negociação →
  Ganho → Perdido`, com `tipo` respectivamente `aberta, aberta, aberta, aberta, ganha, perdida`,
  e ao menos 4 motivos de perda ativos — todos editáveis e desativáveis

### AC-3: View `relacionamento.contas` é a interface de leitura da Conta
- **Dado** um usuário autenticado com acesso a `pcm` **ou** a `comercial`
- **Quando** consulta `relacionamento.contas`
- **Então** recebe as Contas com identidade (id, nome, CNPJ, `auvo_id`, endereço, contatos,
  `ativo`) respeitando a RLS de `pcm.clientes`, **sem** expor `tipo`/`status_comercial`
  (colunas deprecadas — AC-8)

### AC-4: Criar oportunidade para uma Conta
- **Dado** um usuário com `comercial='escrita'` e uma Conta existente
- **Quando** cria uma oportunidade (título, valor estimado em centavos, etapa, responsável,
  origem opcional)
- **Então** a oportunidade é criada na etapa escolhida (ou na primeira etapa `aberta` por
  padrão), aparece vinculada àquela Conta, e um registro nasce em `oportunidade_eventos` com
  `etapa_de = null`

### AC-5: Mover de etapa registra evento
- **Dado** uma oportunidade em uma etapa `aberta`
- **Quando** o usuário a move para outra etapa
- **Então** `oportunidade_eventos` ganha uma linha com `etapa_de`, `etapa_para`, `ocorrido_em` e
  `ator_id` — é a fonte do ciclo de venda; a UI nunca calcula isso por diferença de datas

### AC-6: Motivo de perda é obrigatório no banco
- **Dado** uma oportunidade em etapa `aberta`
- **Quando** alguém tenta movê-la para uma etapa `tipo='perdida'` **sem** `motivo_perda_id`
- **Então** a escrita é rejeitada **pelo banco** (trigger, não só validação de UI), com mensagem
  clara; com motivo preenchido, a movimentação grava também `fechada_em`

### AC-7: Lista de Contas mostra todas — inclusive as que o PCM esconde
- **Dado** as 105 Contas de produção (47 ativas, 51 inativas, 6 divergentes)
- **Quando** o usuário com `comercial='leitura'` abre a Lista de Contas
- **Então** vê **todas**, sem filtro implícito de `ativo` (ao contrário do PCM), cada uma com sua
  etapa de funil quando houver oportunidade aberta, e pode filtrar por etapa, situação
  (ativa/inativa) e texto (nome/CNPJ)

### AC-8: Colunas deprecadas continuam funcionando
- **Dado** a migration da S01 aplicada
- **Quando** se inspeciona `pcm.clientes`
- **Então** `tipo` e `status_comercial` **continuam existindo**, com `comment on column` citando
  o ADR-0020, e **nenhuma tela do PCM quebra** (Lista de Clientes, Visão 360, Cabeçalho) — o
  Comercial não escreve mais nelas, e o drop fica para story futura

### AC-9: Aba Comercial na Visão 360
- **Dado** uma Conta com pelo menos uma oportunidade
- **Quando** o usuário com módulo `comercial` abre a Visão 360 dessa Conta
- **Então** existe uma aba **Comercial** listando as oportunidades (etapa, valor, responsável,
  score quando houver) — e as demais abas da Visão 360 continuam idênticas ao que eram

### AC-10: Navegação e gate de permissão
- **Dado** usuários com perfis distintos
- **Quando** acessam o app
- **Então** sem o módulo `comercial` a seção não aparece na sidebar e a rota é negada; com
  `leitura` as telas abrem em modo somente-leitura (sem botões de criar/mover); com `escrita` ou
  superadmin, tudo habilitado

## Matriz de decisão — permissão × ação

| `user_modulos.comercial` | Papel | Ver Lista/Funil | Criar oportunidade | Mover etapa | Editar etapas | AC |
|---|---|---|---|---|---|---|
| ausente | qualquer não-superadmin | ✗ (sidebar oculta, rota negada) | ✗ | ✗ | ✗ | AC-1, AC-10 |
| `leitura` | colaborador/supervisor | ✓ | ✗ | ✗ | ✗ | AC-1, AC-10 |
| `escrita` | colaborador/supervisor | ✓ | ✓ | ✓ | ✓ | AC-1, AC-4, AC-5 |
| qualquer | superadmin | ✓ | ✓ | ✓ | ✓ | AC-1 |

## Casos de borda e erros

- **Conta sem nenhuma oportunidade** → aparece na Lista de Contas com etapa vazia, nunca some
  nem erra (AC-7).
- **Conta com mais de uma oportunidade aberta** → permitido; a Lista mostra a mais recente e a
  aba Comercial lista todas (AC-9).
- **Etapa desativada com oportunidade dentro** → a oportunidade não é movida sozinha nem some;
  a etapa some do seletor de destino mas continua sendo exibida como origem.
- **Excluir etapa que tem oportunidade** → bloqueado (FK); a UI oferece desativar.
- **Mover para etapa `ganha`** → não exige motivo; grava `fechada_em` (AC-6 cobre só `perdida`).
- **Reabrir oportunidade fechada** (mover de `ganha`/`perdida` de volta para `aberta`) →
  permitido, limpa `fechada_em`, grava evento; a métrica de ciclo usa o último fechamento.
- **As 6 Contas com `ativo=false` e `status_comercial='ativo'`** → aparecem como inativas
  (`ativo` é a coluna que vale); não corrigir o dado nesta story (`design.md` §4.1).
- **`comercial.leads` recebendo insert do agente durante a story** → não é erro: as duas
  convivem até a S09/S10 (`design.md` §4.3).

## Fora de escopo
> Vinculante. Não implemente nada aqui.

- **Dropar `comercial.leads`** ou remover `'comercial_lead'` do check de
  `relacionamento.vinculos` — a Edge Function `pcm-ze-agent` ainda escreve lá (`design.md` §4.3).
  Pertence à S10, depois da S09.
- **Dropar `pcm.clientes.tipo`/`status_comercial`** — só deprecar (AC-8).
- **Mexer na Lista de Clientes do PCM** (filtro "Leads", badge de tipo) — as colunas ainda
  existem, então nada quebra; a limpeza vem com o drop.
- **Kanban / drag-and-drop do funil** — é a S02. Aqui a mudança de etapa pode ser por seletor.
- **Proposta, precificação, contrato, levantamento, dashboard** — S03 a S08.
- **Regra "Conta ativa não pode ter oportunidade"** — não bloquear; renovação/expansão é S07
  (`design.md` §4.2).
- **Corrigir as 6 Contas divergentes.**

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md`
- ADRs: [ADR-0019](../../docs/adr/0019-propriedade-de-dados-r1-r2-r3.md) ·
  [ADR-0020](../../docs/adr/0020-conta-unica-funil-no-comercial.md)
- Glossário: **Conta**, **Oportunidade** (adicionados nesta sessão)
