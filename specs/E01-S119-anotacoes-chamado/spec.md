---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Anotações do Chamado (com data e autor)

> **Fonte da verdade.** Status: implementado localmente; migration `0164` aguarda deploy.
> Origem: pedido do Lucas (2026-07-29). "Dentro do chamado que também pode virar OS, cria um campo
> para anotações, registrando data e quem fez a anotação."

## Contexto de código
- `pcm.os_notas` já existe (E09), mas é outra coisa: canal de comunicação Portal do
  Cliente↔equipe, preso a `ordens_servico_id` (`on delete cascade`) — não existe pra um Chamado
  ainda sem OS, e `autor_tipo` é `cliente`/`interno` (não "quem" nomeado). Não serve pro pedido.
- `ChamadoPainel.tsx` (E01-S118 T7) já carrega o Chamado por `chamadoId` — o mesmo padrão
  ("sobrevive à conversão em OS, nunca preso ao status") vale aqui: anotações ligadas a
  `chamado_id` (não a `ordens_servico_id`), então continuam visíveis depois de virar OS sem
  esforço extra.
- `config.usuarios` tem `nome`, mas a RLS de leitura é `user_id = auth.uid() OR admin` — um
  colaborador comum não consegue resolver o nome de OUTRO usuário via join client-side. Decisão:
  denormaliza `autor_nome` na própria linha da anotação, no momento da escrita (mesmo princípio já
  usado em várias tabelas do projeto pra nome de cliente/técnico) — evita RLS extra e é imutável
  por natureza (é um retrato de quem escreveu, não precisa acompanhar renomeação futura do usuário).

## Resumo
O `ChamadoPainel` ganha uma seção "Anotações": lista cronológica (mais recente primeiro) com
texto + autor + data/hora, e um campo pra adicionar uma nova. Nunca editável/removível (log
append-only, mesmo princípio de auditoria já usado em `chamados_eventos`/`lancamentos_eventos`).

## Critérios de aceite

### AC-1: Adicionar anotação
- **Dado** o painel de um Chamado (com ou sem OS)
- **Quando** o operador escreve um texto e confirma
- **Então** a anotação é gravada com data/hora (`created_at`) e o nome de quem escreveu
  (`autor_nome`, capturado no momento da escrita) — aparece na lista imediatamente.

### AC-2: Lista cronológica, mais recente primeiro
- **Dado** um Chamado com 2+ anotações
- **Quando** o painel carrega
- **Então** a mais recente aparece primeiro; cada item mostra texto, autor e data/hora formatada
  (pt-BR).

### AC-3: Sobrevive à conversão em OS
- **Dado** um Chamado com anotações que depois vira OS (Gerar OS/Enviar backlog)
- **Quando** o operador reabre o item (agora uma OS)
- **Então** as anotações continuam todas visíveis, na mesma seção — nada se perde.

### AC-4: Nunca vazio silencioso, nunca edita/apaga
- **Dado** um Chamado sem nenhuma anotação
- **Quando** o painel carrega
- **Então** mostra um estado vazio claro ("Nenhuma anotação ainda"). Anotações gravadas não têm
  edição nem exclusão pela UI (log de auditoria, mesmo princípio de `chamados_eventos`).

## Casos de borda e erros
- Texto vazio/só espaço → botão de salvar desabilitado, sem round-trip ao banco.
- Autor sem `nome` preenchido (não deveria acontecer, `config.usuarios.nome` é `not null`) →
  fallback defensivo "Usuário" na gravação, nunca quebra a UI.

## Fora de escopo
- Editar ou apagar anotação já criada.
- Anexo de arquivo na anotação (`os_notas` tem isso pro canal do Portal; aqui é só texto).
- Notificar alguém quando uma anotação é criada.

## Rastreabilidade
- Código: `domain/chamados.ts` (tipo `AnotacaoChamado` + validação), `application/chamados-gateway.ts`
  (métodos novos), `infrastructure/supabase-chamados-adapter.ts`, `components/ChamadoPainel.tsx`.
- Estende: E01-S118 (ChamadoPainel).
- ADRs relacionados: —
