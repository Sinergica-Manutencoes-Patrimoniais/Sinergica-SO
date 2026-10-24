---
name: STATE
description: Handoff do Plano de Manutenção para continuação em outro computador.
alwaysApply: true
---

# STATE — Memória viva do projeto

## 2026-10-24 — Handoff do Plano de Manutenção (Codex)

- **Branch de continuação:** `codex/handoff-plano-manutencao`, criada de `origin/main`
  no commit `22aca3918224bc45175e80c6ec88b957fdb604aa` (PR #70).
- **Pedido desta sessão:** Lucas pediu para subir todo o material ao Git e fornecer um prompt
  para continuar em outro computador. Esta entrega é documental: não implementa o novo módulo,
  não altera banco, não faz deploy e não envia tarefas reais ao Auvo.
- **Ponto de entrada:** [README do planejamento](planejamento/plano-manutencao/README.md).
  Ler depois [decisões consolidadas](planejamento/plano-manutencao/decisoes-consolidadas.md),
  os originais em `fontes/` e [prompt de continuação](planejamento/plano-manutencao/continuar.md).
- **Feature ativa:** preparação do Plano de Manutenção do Fabrício; ainda não existe story/spec
  executável criada para essa iniciativa. Não tratar o briefing como implementação concluída.
  `E01-S53` é a base existente de Preventivas, não a spec completa do novo fluxo.
- **Próxima ação concreta:** ler os documentos acima, confirmar somente as três pendências
  registradas e preparar a divisão em stories/specs via Spec Kit. Conferir o próximo ID e marcar
  owner no ROADMAP antes de codar; nunca carregar o ROADMAP inteiro.

### Decisões recentes

- O fluxo operacional definido pelo Fabrício prevalece sobre limitações do código atual.
  Lucas pediu preservar a nomenclatura de UI **Componentes e Sistemas**, cadastros e códigos.
- Novo fluxo para preventivas, corretivas, PMOC e chamados manuais: Plano → Versão → Rotina →
  Ocorrência → Chamado → uma ou várias OS → Visita → tarefa Auvo por OS → execução → validação PCM.
- Calendário contratual vem antes da geração: semana suprimida por feriado não gera Visita
  nem ocorrência correspondente, não conta nos indicadores operacionais e não tem reposição
  automática. Mudança do dia fixo tem vigência e preserva histórico/exceções aprovadas.
- Conclusão Auvo é conclusão em campo. PCM valida/encerra OS individualmente; Chamado recebe
  indicação de apto e depende de encerramento próprio após atendimento integral.
- Preventiva Não OK pode ser concluída, com necessidade corretiva vinculada. Continuação recebe
  somente escopo e esforço restantes; técnico sugere e PCM revisa.
- Confirmação PCM obrigatória; ciência do cliente configurável e não exigida por padrão.
  Terceiros têm horas separadas; capacidade interna inclui somente esforço Sinérgica.
- Despesas previstas/realizadas, comprovantes e vínculo Financeiro são geridos pelo SO.
- Requisitos detalhados e precedência das fontes estão nas decisões consolidadas.

### Pendências efetivas

1. Fabrício define quem poderá aprovar/suspender/encerrar planos e autorizar cancelamentos.
   Permissões serão configuráveis, sem nomes fixos no código.
2. Fabrício define se o planejador pode aprovar o próprio plano ou exige outra pessoa.
3. Confirmar com exemplo a sequência de rotinas mensais/trimestrais após feriado:
   próxima visita válida versus próxima oportunidade periódica, e preservação da âncora.
   A supressão da semana já está aprovada; não reabrir essa decisão.
- Os 25 tempos SPCI zerados do Rimini são **Tempo a validar**, não esforço zero. Não impedem
  documentar o rascunho, mas impedem declarar sua capacidade completa/validada.
- O gatilho real Auvo e seu contrato precisam ser reavaliados na futura implementação.
  Testes que criam tarefas reais exigem liberação operacional expressa do Fabrício.
- Credenciais locais e sessão autenticada não são transportadas pelo Git. Reconfigurar o ambiente
  no outro computador sem solicitar tokens/senhas nesta conversa ou versionar `.env`.

### Entregas anteriores preservadas

- PR #70 já integrada na main: identificador com sugestões e manual operacional/ajuda.
- [Levantamento funcional e apresentação](entregas/2026-10-14/README.md): Markdown, HTML offline
  com 109 capturas únicas e ZIP, agora versionados. Referência histórica em 14/10/2026;
  não equivalem à homologação do novo módulo nem ao estado vivo de produção.
- Histórico do STATE antigo preservado em
  [2026-09-29 a 2026-10-01](state-historico/2026-09-29-a-2026-10-01.md).
  Suas pendências de ambiente são históricas e não devem ser copiadas como estado atual.
