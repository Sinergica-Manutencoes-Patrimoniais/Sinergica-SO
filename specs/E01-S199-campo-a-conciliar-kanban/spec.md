---
name: spec
description: "Campo a conciliar como fila de entrada do Kanban — fecha o AC-5 de BL 007 que E01-S194 deixou como SPEC_DEVIATION."
alwaysApply: false
---

# E01-S199 — "Campo a conciliar" como fila de entrada do Kanban

## Por que esta story existe

`E01-S194` entregou o Kanban aprovado **menos uma coluna** e registrou o buraco como
SPEC_DEVIATION: a fonte da fila "Campo a conciliar" (`E01-S175`) não tinha sido mapeada a tempo,
e uma coluna sempre vazia enganaria mais que a ausência documentada. Esta story fecha esse ponto.

Regra do Pacote Consolidado (13/11/2026), BL 007: o fluxo aprovado é
`Solicitações | Preventivas | Campo a conciliar | Demanda | Planejamento | Em execução | Validação PCM | Finalizado`,
e **"Solicitação, Preventiva e Campo a conciliar são filas de entrada"**. A origem dessa fila está
no item 3 do playbook: *"OS aberta no Auvo sem ID de Chamado cria OS e Chamado provisórios no SSO
e entra em conciliação do PCM"*.

## Achado que define o escopo

A máquina de conciliação **já existe inteira** e está testada: `1420` cria o par provisório
(`pcm.sso_origem_campo_processamentos.provisorio`), `1428` registra a decisão de triagem, `1429`
une a OS a outro Chamado, `1427` lista o estado de campo. Há até componentes de tela
(`TriagemChamadoProvisorio.tsx`, `EstadoCampo.tsx`).

O que **não** existe é a regra do pacote: essa fila só aparece dentro de Visão 360 → Estrutura,
atrás de outra flag. Quem opera o Kanban não a enxerga. Logo, esta story **não constrói motor
nenhum** — ela dá alcance ao que já existe, no lugar onde o pacote mandou.

## Acceptance Criteria

- **AC-1:** o Kanban mostra a coluna "Campo a conciliar" entre "Preventivas" e "Demanda", na ordem
  literal do pacote.
- **AC-2:** entram na fila apenas OS provisórias (vindas do campo sem Chamado) que o PCM ainda
  **não** conciliou.
- **AC-3:** OS com decisão de triagem registrada **sai** da fila — a coluna esvazia conforme o PCM
  trabalha, não acumula para sempre.
- **AC-4:** OS que chegou com Chamado identificado **nunca** entra na fila.
- **AC-5:** Chamado encerrado não permanece como fila de entrada.
- **AC-6:** a fila de um Cliente não mostra item de outro Cliente.
- **AC-7:** o cartão informa o **motivo** da provisoriedade e o **identificador da tarefa Auvo** de
  origem, para o PCM decidir sem abrir a OS.
- **AC-8:** clicar no cartão abre a triagem da tarefa Auvo, com o motivo e os identificadores da OS
  e do Chamado provisório. A triagem permite vincular a OS a outro Chamado do mesmo Cliente com
  motivo e confirmação. Após o vínculo, o cartão sai da fila e a OS mantém sua fase. A triagem
  não oferece alteração livre de status da OS.
- **AC-9:** a coluna não aceita arrastar-e-soltar: sair da fila é **decisão de triagem**, não
  mudança de status.
- **AC-10:** gate fechado, flag desligada ou falta de capacidade **se anunciam** com frase própria;
  nenhum desses estados pode ser confundido com "nada a conciliar".

## Alcance no front — obrigatório nesta story

- **AC-F1:** caminho nomeado — PCM → Ordens de Serviço → visão Kanban → coluna "Campo a conciliar",
  com um Cliente selecionado no filtro.
- **AC-F2:** `VITE_SSO_CAMPO_A_CONCILIAR_ENABLED` declarada no registro de flags, em
  `.env.example` e em `netlify.toml`, com valor explícito `false`.
- **AC-F3:** recurso desligado mostra "disponível, ainda não ativado" — `return null` silencioso é
  recusado no review.
- **AC-F4:** procedimento de abertura e de retorno escritos antes de existir (ver `plan.md`).
- **AC-F5:** o PR declara em uma linha o que falta para a jornada ficar utilizável.

## Success Criteria

- **SC-001:** pgTAP prova permitido **e** negado, incluindo gate fechado com erro nomeado.
- **SC-002:** os quatro recortes da fila (entra, sai por triagem, nunca entra, sai por
  encerramento) ficam provados por teste, não por leitura.
- **SC-003:** nenhum Cliente enxerga a fila de outro.

## Fora de escopo

- Reescrever a triagem, a união de Chamado ou a recepção de envelope (`E01-S175` — já existem).
- Criar gate ou capacidade nova: a fila reusa `pcm.sso_consulta_estado_campo_gate` e
  `execucao.validar`.
- Mover o cartão entre fases do Kanban: o cartão leva à triagem dedicada, que reutiliza a vinculação
  de E01-S175.
