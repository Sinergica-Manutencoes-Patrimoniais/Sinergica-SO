---
name: ativacao-homologacao-2026-11
description: Runbook de ativação do ambiente para a homologação da rodada 17-19/11/2026 — ordem, comandos, verificação e retorno de cada jornada.
alwaysApply: false
---

# Runbook — ativar o ambiente para a homologação da rodada 17-19/11/2026

**Para quem:** `@devops` + um responsável funcional presente na janela.
**Pré-requisito absoluto:** `node scripts/diagnosticar-ambiente.mjs` dizendo "Banco pronto".
Abrir gate de migration não aplicada é impossível — a tabela nem existe.

> **Regra de ouro desta rodada:** cada jornada tem até **três travas independentes** — *gate* no
> banco, *flag* no build do site e *concessão* de capacidade na pessoa. Abrir uma não abre as
> outras. Uma jornada só fica utilizável com as três do seu bloco.

---

## Etapa 0 — Verificar antes de tocar em qualquer coisa

```bash
SUPABASE_DB_URL='<conexão do ambiente>' node scripts/diagnosticar-ambiente.mjs
```

Decisão:

| Resultado | O que fazer |
|---|---|
| "Banco pronto" | seguir para a Etapa 1 |
| Migration pendente a partir da `1861` | **parar.** O deploy falhou na correção da view; reaplicar o deploy da `main` atual antes de tudo |
| Migration pendente em outro ponto | investigar o erro daquela migration antes de seguir |

Registrar no fim da sessão: saída do diagnóstico **antes** e **depois**.

---

## Etapa 1 — Jornadas sem decisão pendente (baixo risco)

Estas não mudam comportamento de quem já usa o sistema: ou criam leitura nova, ou já estão
alcançáveis e só precisam de concessão.

### 1.1 Capacidades sensíveis e revogação imediata — `E00-S26`, `E00-S27`

**Nada a abrir.** Já estão utilizáveis: Configurações → Capacidades, visível para superadmin, sem
flag e sem gate. É por aqui que as concessões das etapas seguintes são feitas.

Verificar: abrir a tela e confirmar que a seção "Revogar ou reativar usuário" aparece.

### 1.2 Fila "Campo a conciliar" — `E01-S199`

```sql
-- Abre também a tela "Estado de campo" (Visão 360 → Estrutura): mesmo gate, mesma jornada.
update pcm.sso_consulta_estado_campo_gate set habilitado = true where id;
```

| Camada | O quê |
|---|---|
| Flag (Netlify) | `VITE_SSO_CAMPO_A_CONCILIAR_ENABLED = true` + republicar |
| Capacidade | conceder `execucao.validar` ao usuário da homologação, no Cliente de teste |

Verificar: Kanban com um Cliente selecionado mostra a coluna "Campo a conciliar".
**Retorno:** `set habilitado = false` + desligar a flag. Nenhum dado é apagado.

### 1.3 Trechos de deslocamento — `E01-S195`

```sql
update pcm.sso_trechos_deslocamento_gate set habilitado = true where id;
```

| Camada | O quê |
|---|---|
| Flag | `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED = true` e `VITE_SSO_CAPACIDADE_AGENDA_ENABLED = true` |
| Capacidade | a mesma já usada pela aba de capacidade |

Verificar: Visão 360 → Estrutura → Capacidade e Agenda → Fontes de Demanda → expandir uma Visita →
"Conferir trechos de deslocamento".
**Retorno:** `set habilitado = false`. Trechos já declarados permanecem íntegros.

### 1.4 Contingência Auvo auditada — `E01-S196`

**Sem gate.** Só concessão:

```sql
-- Pela tela: Configurações → Capacidades → conceder `execucao.contingencia_auvo`.
-- Conceder a quem de fato deve poder abrir OS manual (recomendação: só Gestor PCM).
```

Verificar: mover uma OS para Planejamento abre o modal do Auvo e ele **pede motivo**.
**Retorno:** revogar a concessão — o caminho manual volta a recusar, com mensagem nomeada.

### 1.5 Pendências agrupadas por ativo — `E01-S197`

Gates **já existentes** de `E01-S173`/`E01-S174` (não criados nesta rodada). Flags:

| Flag | Para quê |
|---|---|
| `VITE_SSO_PENDENCIAS_TECNICAS_ENABLED` | lista de pendências por ativo |
| `VITE_SSO_PENDENCIAS_FILTRO_ATIVO_ENABLED` | filtro por ativo |
| `VITE_SSO_BACKLOG_COMPOSICAO_ENABLED` | botão "Compor Backlog" |

Verificar: Visão 360 → Preventivas → Pendências técnicas mostra cartões agrupados por ativo.

---

## Etapa 2 — Backlog antes do Chamado (`E01-S193`) — risco médio

Abre **seis** gates. Nenhum deles muda dado existente, mas liberam um caminho novo de criação de
Chamado.

```sql
update pcm.sso_backlog_composicao_gate set habilitado = true where id;
update pcm.sso_promocao_backlog_gate    set habilitado = true where id;
update pcm.sso_backlog_chamado_gate     set habilitado = true where id;
update pcm.sso_backlog_parcela_gate     set habilitado = true where id;
update pcm.sso_divisao_backlog_gate     set habilitado = true where id;
-- `pcm.chamado_os_gate` NÃO está nesta lista de propósito: ver Etapa 3.
```

| Camada | O quê |
|---|---|
| Flags | `VITE_SSO_PROMOVER_BACKLOG_CHAMADO_ENABLED`, `VITE_SSO_DIVIDIR_BACKLOG_ENABLED`, `VITE_SSO_KANBAN_BACKLOG_ESCOPO_ENABLED` |
| Capacidades | as de escopo de Chamado, já existentes |

Verificar: selecionar 2 pendências → "Compor Backlog" → **nenhum** Chamado criado; depois
"Liberar escopo" → aí sim um Chamado nasce **em Demanda**.

**Pendência conhecida que NÃO bloqueia a homologação:** o Backlog legado (OS em `status='backlog'`)
ainda não foi classificado, e `backlog` segue na lista de status do front. O inventário rodado
localmente deu **zero** registros; **precisa ser rodado no ambiente real** antes de qualquer
classificação:

```bash
SUPABASE_DB_URL='<conexão>' node scripts/inventariar-backlog-legado.mjs
```

**Retorno:** fechar os cinco gates. Chamados já criados pelo caminho novo permanecem — e devem
permanecer.

---

## Etapa 3 — Várias OS por Chamado (`E01-S167`/`BL 001`) — risco alto, decisão do Fabrício

> ⚠️ **Não executar sem o "sim" explícito do Fabrício.** Este gate é **global**: no instante em que
> abre, **todo** Chamado do sistema passa a aceitar OS adicional — não dá para limitar a um Cliente.

Caminho recomendado: **não rodar SQL à mão.** Usar a tela, que registra motivo e executor:

1. Ligar `VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED = true` e republicar.
2. Configurações → **Ativação de jornadas** (superadmin).
3. Escolher `chamado-multiplas-os` → conferir o diagnóstico (gate, grant e flag, um a um) →
   digitar o código e o motivo → confirmar.

A tela abre, na ordem certa: `sso_criacao_os_mediada_gate`, `chamado_os_gate`, o grant da função e
a flag `VITE_SSO_CRIAR_OS_CHAMADO_ENABLED`.

**Nunca fechar** `pcm.sso_guarda_multiplas_os_gate`: ele é o mecanismo que substituiu o índice
legado na `1842`. Fechá-lo é o estado inseguro que a guarda existe para evitar. A tela já o trata
como "mecanismo", fora do laço de abrir/retornar.

**Retorno:** mesma tela, opção de retornar. Impede **novas** OS adicionais; as já criadas
permanecem.

---

## Etapa 4 — Central de Materiais (`BL 010`)

Mesma tela de Ativação de jornadas, jornada `central-materiais`. Abre o gate de eventos mediados,
o grant da função e a flag `VITE_SSO_LISTAS_MATERIAIS_ENABLED`.

---

## Etapa 5 — API de domínio e MCP (`E01-S198`, `E02-S43`)

**Não são tela.** Não precisam de gate novo: reusam os de staging, já abertos. Para demonstrar:

1. Confirmar que `pcm-api-dominio` e `pcm-mcp` estão declaradas em `supabase/config.toml` (o
   diagnóstico da Etapa 0 verifica) e foram deployadas.
2. Conceder `cadastro.gerir` ao usuário da demonstração.
3. Chamar com um JWT real do usuário — nunca `service_role`.

---

## Etapa 6 — Fechamento da sessão

| Item | Registrar |
|---|---|
| Diagnóstico antes e depois | saída do script |
| Gates abertos | quais, por quem, com que motivo |
| Flags ligadas | quais, e o horário da republicação |
| Concessões feitas | quem recebeu o quê, em qual Cliente |
| `chamado-multiplas-os` | aberto ou não, e a decisão de quem autorizou |

---

## Ordem de retorno, se algo der errado

Inverter a ordem de abertura: Etapa 4 → 3 → 2 → 1. Fechar gate **nunca apaga dado**; só volta a
recusar operação nova. As flags podem ser desligadas em qualquer ordem, mas exigem republicar o
site para ter efeito.

Se o problema for de banco (migration), não feche gates às cegas: rode o diagnóstico primeiro —
"INEXISTENTE" distingue migration ausente de gate fechado, e os dois pedem ações opostas.
