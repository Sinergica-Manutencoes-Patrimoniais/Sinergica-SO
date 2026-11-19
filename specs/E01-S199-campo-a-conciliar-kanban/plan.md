---
name: plan
description: "Plano técnico de E01-S199 — consulta da fila, coluna virtual no Kanban, reuso do gate e da capacidade de E01-S175."
alwaysApply: false
---

# Plano — E01-S199

## Inventário antes de codar (o que NÃO foi construído)

| Já existe | Onde | Consequência |
|---|---|---|
| Par provisório OS+Chamado vindo do Auvo sem referência | `1420`, `pcm.sso_origem_campo_processamentos.provisorio` | nada a criar |
| Decisão de triagem (confirmar/corrigir) | `1428`, `pcm.sso_triagem_chamado_campo_decisoes` | é o que tira da fila |
| União a outro Chamado | `1429` | tira da fila por outro caminho |
| Listagem do estado de campo | `1427`, `pcm.sso_listar_estado_campo` | serve a outra tela; devolve inclusive o já conciliado |
| Telas de triagem e estado | `TriagemChamadoProvisorio.tsx`, `EstadoCampo.tsx` | o destino do cartão já existe |

**Conclusão:** falta só o recorte "ainda por conciliar" e o lugar certo (Kanban).

## Banco — migration 1866

`pcm.sso_listar_campo_a_conciliar(p_ator_id, p_cliente_id, p_limite)`, `security definer`,
`search_path=''`, no mesmo molde de `1427`:

- mesma trava de leitura (`pg_try_advisory_xact_lock_shared`) usada por `1427`/`1428`, que impede
  ler a fila no meio de uma alteração de autorização;
- **mesmo gate** `pcm.sso_consulta_estado_campo_gate` (fechado por padrão) e **mesma capacidade**
  `execucao.validar`. Reaproveitar mantém a superfície de ativação do mesmo tamanho: é a mesma
  jornada vista de dois lugares, não uma jornada nova;
- recorte da fila: `provisorio` **e** `o.chamado_id = p.chamado_id` (se o PCM já uniu a OS a outro
  Chamado, ela saiu) **e** sem linha em `sso_triagem_chamado_campo_decisoes` **e** Chamado não
  encerrado;
- ordenação por `criado_em, os_id` — o que chegou primeiro aparece primeiro.

**Por que não estender `pcm.operacao_itens`:** a view já foi recriada duas vezes nesta rodada
(`1858` e `1861`) e a segunda falhou exatamente por isso. Além disso, `operacao_itens` é
`security_invoker` e `sso_origem_campo_processamentos` tem RLS FORCE com `revoke all` — a view não
conseguiria ler a tabela sem afrouxar a regra. Uma RPC definidora, com o mesmo gate e a mesma
capacidade da triagem, resolve sem tocar na view.

## Frontend

- `domain/campo-a-conciliar.ts` — tipo `ItemCampoAConciliar` e `rotuloMotivoCampo`, puros. Motivo
  desconhecido cai num rótulo legível em vez de sumir.
- `infrastructure/supabase-operacao-adapter.ts` — `listarCampoAConciliar`, com Zod `.strict()` na
  resposta (formato inesperado vira erro nomeado, não tela quebrada).
- `application/operacao-queries.ts` — chave `campoAConciliar(clienteId)`.
- `pages/OrdensServicoPage.tsx` — `useQuery` com `retry: false` (gate fechado e falta de
  capacidade são erros **permanentes**; repetir só atrasaria a mensagem certa, lição de E01-S195)
  e `enabled` só com Cliente selecionado, visão Kanban e flag ligada.
- `components/OsKanbanView.tsx` — coluna virtual no mesmo molde de "Preventiva": sem drag, sem
  drop. Arrastar daqui fingiria um caminho que não existe — sair da fila é decisão de triagem.

## Alcance no front (AC-F1 a AC-F5)

- **Caminho (AC-F1):** PCM → Ordens de Serviço → Kanban → selecionar um Cliente no filtro → coluna
  "Campo a conciliar" → clicar no cartão abre a OS.
- **Flag (AC-F2):** `VITE_SSO_CAMPO_A_CONCILIAR_ENABLED`, no registro de flags, em `.env.example`
  e em `netlify.toml`, `false` explícito.
- **Desligado se anuncia (AC-F3):** três frases distintas — flag desligada, gate fechado
  (`consulta_desabilitada`) e falta de capacidade (`sem_acesso`). Nenhuma delas pode virar "Nada a
  conciliar": é exatamente o engano que a regra de alcance existe pra impedir, e tem teste próprio.
- **Abertura e retorno (AC-F4):**
  - abrir: `update pcm.sso_consulta_estado_campo_gate set habilitado = true where id;` e ligar a
    flag no Netlify, republicando. **Atenção:** o mesmo gate libera também a tela "Estado de
    campo" em Visão 360 → Estrutura — são a mesma jornada, mas quem abrir precisa saber que as
    duas aparecem juntas.
  - retornar: `set habilitado = false` e desligar a flag. Nenhum dado é apagado; a fila volta a
    mostrar "disponível, ainda não ativado".
- **Linha de ativação (AC-F5):** falta abrir `pcm.sso_consulta_estado_campo_gate`, ligar
  `VITE_SSO_CAMPO_A_CONCILIAR_ENABLED` e conceder `execucao.validar` a quem concilia. O código
  está pronto e testado; a jornada só não está em uso até essas três decisões.

## Riscos

- **Reabrir a view `operacao_itens`** — evitado por desenho (ver acima).
- **Abrir o gate compartilhado sem avisar** — registrado no procedimento de abertura.
- **Fila que nunca esvazia** — o recorte por decisão de triagem é o que garante o contrário, e tem
  teste nomeado (AC-3).

## SPEC_DEVIATION

Nenhum. Os 10 AC desta story estão cobertos.
