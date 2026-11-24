---
name: spec
description: "Agenda do Técnico deixa de ser cadastro paralelo e passa a ser projeção da Visita — fecha o SPEC_DEVIATION de AC-3 de E01-S192."
alwaysApply: false
---

# E01-S202 — Agenda do Técnico como projeção da Visita

## Por que esta story existe

O Pacote Consolidado aprovado pelo Fabrício em 13/11/2026 diz, literalmente:

> "Agenda por técnico e calendário por cliente são **projeções das mesmas Visitas, não cadastros
> paralelos**."
> "Substituir Agenda manual pela visualização Por técnico das Visitas."
> "Eliminar a união posterior de Agenda e OS com deduplicação."

A auditoria dele classificou "Agenda do Técnico" como **obsoleto ou duplicado** — *"cadastro manual
separado mostra dados diferentes do calendário das OS"* — com a evidência observada no sistema
publicado: *"Agenda do Técnico sem alocações na mesma semana em que o calendário operacional
apresentava dezenas de Chamados"*.

O diagnóstico já foi feito e **não se refaz aqui**: `specs/E01-S192-agenda-preventivas-visiveis/plan.md`
nomeia a causa — `pcm.agenda_tecnico` é tabela própria e **ninguém escreve nela a partir da Visita
ou da OS**. A única escrita é manual, pela própria tela. A Agenda aparece vazia porque o dado nunca
nasceu. S192 registrou isso como SPEC_DEVIATION (AC-3) por depender de decisão de produto.

**A decisão foi tomada em 24/11: pode migrar.** O conteúdo lançado à mão não precisa ser preservado
como fonte — *"estamos criando algo do zero"*. Esta story executa a decisão: a Agenda passa a
derivar da Visita e o cadastro manual é aposentado (sem destruir histórico).

## Acceptance Criteria

- **AC-1:** numa semana que tem Visita, a Agenda do Técnico mostra as alocações — é a evidência do
  cliente, invertida. Projeção vazia em semana com Visita reprova a story.
- **AC-2:** cada alocação mostra a **Visita com as OS vinculadas** (números, na ordem da sequência
  da Visita) — a união acontece na origem, não numa deduplicação posterior.
- **AC-3:** a alocação sai da **equipe vigente** da Visita; Visita sem equipe montada entra pela
  **responsável**, com o papel explícito — nunca some da agenda por isso.
- **AC-4:** o que não é compromisso (rascunho, reprogramada, cancelada, Visita dispensada por
  feriado) **não** ocupa agenda de técnico.
- **AC-5:** a agenda de um Cliente nunca mostra Visita de Cliente em que o ator não tem capacidade;
  pedir esse Cliente explicitamente é **negado**, não devolvido vazio.
- **AC-6:** "recurso não ativado", "sem permissão", "erro" e "semana sem Visita" são **quatro
  estados com quatro frases diferentes**. Nenhum `return null` silencioso.
- **AC-7:** o cadastro manual fica **aposentado, não destruído**: escrita nova é recusada com erro
  nomeado (`agenda_tecnico_obsoleta`), a obsolescência está declarada no próprio schema, e o
  histórico continua legível. Nenhum `DROP`, nenhuma linha apagada.
- **AC-8:** o período (manhã / tarde / dia inteiro) é **derivado da própria Visita**, no fuso dela —
  não é campo editável de agenda.
- **AC-9:** a consulta valida parâmetros antes de ler dado (semana tem de começar na segunda-feira
  ISO; limite dentro da faixa) e não é executável por `anon`.

## Alcance no front — obrigatório nesta story

- **AC-F1:** caminho nomeado — PCM → Agenda do Técnico, com a flag ligada; a semana navega com
  "anterior / hoje / seguinte" e as visões "Por dia" e "Por técnico" continuam existindo.
- **AC-F2:** `VITE_SSO_AGENDA_PROJECAO_VISITA_ENABLED` declarada no registro de flags, em
  `.env.example` e em `netlify.toml`, com valor explícito `false`.
- **AC-F3:** com a flag **desligada** a tela é exatamente a de antes (cadastro manual), salvo a
  frase em português que explica a recusa da guarda do banco em vez do erro cru do Postgres.
- **AC-F4:** procedimento de abertura e de retorno escritos antes de existir (ver `plan.md`).
- **AC-F5:** o PR declara em uma linha o que falta para a jornada ficar utilizável.

## Success Criteria

- **SC-001:** pgTAP prova permitido **e** negado, incluindo gate fechado com erro nomeado.
- **SC-002:** o cenário da evidência do cliente está provado por teste: semana com Visita e OS
  vinculadas, cadastro manual vazio, projeção com alocações.
- **SC-003:** a guarda do cadastro antigo recusa escrita nova com erro nomeado e o histórico
  permanece legível.

## Fora de escopo

- Dropar `pcm.agenda_tecnico` ou apagar linhas: a decisão liberou migrar a fonte, não destruir
  registro. Retirada física é outra story, com ADR.
- Criar gate ou capacidade nova: a projeção reusa `pcm.capacidade_agenda_tecnico_gate` e
  `visita.confirmar`.
- Escrever Visita a partir da Agenda (voltar a ter cadastro, agora ao contrário).
- Calendário por cliente e relatório de planejamento consumindo a mesma projeção — mesma diretriz
  do pacote, outra fatia.
- Alerta de capacidade, conflito e carga por técnico (o pacote diz que alertam e não bloqueiam;
  nada disso entra aqui).
