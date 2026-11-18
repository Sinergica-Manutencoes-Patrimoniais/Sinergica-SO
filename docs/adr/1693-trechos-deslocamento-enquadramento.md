---
name: "docs-adr-1693-trechos-deslocamento-enquadramento-md"
description: "Documento Sinérgica SO: ADR-1693 — Trecho de deslocamento como entidade aditiva (E01-S195)"
alwaysApply: false
---

# ADR-1693 — Trecho de deslocamento como entidade aditiva (E01-S195)

**Status:** aceita · **Data:** 2026-11-18 · **Story:** E01-S195

## Contexto

`1357_E01-S172_declaracao_deslocamento.sql` guarda um NÚMERO agregado por revisão da Visita
(`minutos_por_pessoa`, `pessoas_proprias`) — sem origem, destino ou enquadramento jurídico. A
regra aprovada (Pacote Consolidado, BL 009) é por trecho: residência↔cliente nunca computa
(mesmo com veículo da empresa sob guarda); o resto computa, ocupa jornada, não reduz hora
contratada do Cliente, e gera "excedente a validar" sem classificar hora extra sozinho.

## Decisão

- Nova entidade `pcm.sso_trechos_deslocamento`, **aditiva**, não edita `1357`. As duas tabelas
  coexistem: `1357` continua alimentando `sso_listar_deslocamentos_semana` (capacidade semanal);
  esta migration resolve o enquadramento jurídico que faltava.
- Enquadramento é uma função PURA (`sso_enquadrar_trecho_deslocamento`), coluna `generated always
  as ... stored` — nunca um valor digitado livre, nunca pode divergir da regra. Regra: não
  computado se origem OU destino for `'residencia'`; computado em qualquer outro par. Cobre os
  dois casos do pacote (residência→primeiro cliente, último cliente→residência) pela mesma regra
  simples, sem precisar saber posição no dia. **Não existe nenhuma coluna sobre veículo** — por
  isso a regra estruturalmente não pode mudar com o veículo sob guarda (AC-2), provado por teste
  de schema, não por caso de dado.
- Cada revisão grava o DIA INTEIRO de trechos atomicamente (mesmo padrão de `1357`: imutável,
  `request_id` idempotente, `revisao` sempre cresce) — edição (AC-8) é sempre revisão nova, nunca
  UPDATE; a sugestão anterior nunca é apagada.
- **AC-6 (hora contratada não reduz automaticamente)**: não existe NENHUMA tabela de "hora
  contratada do Cliente" neste repositório (grep exaustivo antes de codar) — logo esta migration
  não tem como reduzi-la, por construção. Provado por teste de ausência de coluna, não por
  simulação de um sistema que não existe.
- **AC-7 (excedente a validar, SPEC_DEVIATION parcial)**: a RPC de escrita devolve o total
  computável em minutos. Não existe, em lugar nenhum do sistema, um valor de "jornada padrão"
  configurado por técnico ou por Cliente contra o qual comparar — inventar uma constante (ex.: 8h)
  seria decidir política de hora extra, explicitamente fora de escopo da spec ("Política de hora
  extra e folha"). Expor o minuto bruto e deixar o PCM decidir é a leitura mais fiel de "o sistema
  calcula excedente **a validar** — não classifica hora extra sozinho": o limite pra comparar é
  decisão de produto, não desta story.

## Consequências

- Positiva: fecha AC-1 a AC-5, AC-6, AC-8, AC-9, AC-10 com prova em pgTAP; não reescreve `1357`.
- Negativa/aceita: AC-7 fica com a metade "calcula o bruto" implementada; a comparação contra um
  limite de jornada aguarda decisão de produto sobre qual é esse limite.
- Reversível: tabela e função novas, nenhuma coluna de `1357` tocada.

## Referências

Migration `1855_E01-S195_trechos_deslocamento.sql` · `specs/E01-S195-deslocamento-enquadramento/`
· `1357-1359_E01-S172_*` (declaração agregada, não editada) · ADR-1203/ADR-1204 (padrão de
declaração imutável reusado).
