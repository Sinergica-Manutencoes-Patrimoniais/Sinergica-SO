---
name: spec
description: Plano preventivo no PCM; execução no Auvo após confirmação da visita.
alwaysApply: true
---

# Spec — Preventivas no PCM, execução no Auvo

> Status: rascunho. Tier arquitetural. ADR-0008 e `design.md` regem a integração.

## Resumo

Fabrício cadastra no PCM plano para Sistema ou Componente/Equipamento com primeira data,
intervalo de N semanas ou N meses e questionário preexistente no Auvo. Cada vencimento gera uma
ocorrência planejada sem OS. Ao confirmar técnico e data da visita no calendário, o PCM cria
imediatamente uma task/OS no Auvo, mesmo para data futura, e guarda seu ID. Técnico encontra a
tarefa, executa serviço e responde questionário no Auvo. PCM recebe resultados; Fabrício decide
quais achados envia ao backlog.

## Critérios de aceite

### AC-1: Plano e ocorrências

- Dado alvo Sistema ou Componente/Equipamento válido, quando Fabrício ativa plano com primeira
  data, N inteiro positivo e unidade semanas/meses, então PCM gera ocorrências planejadas sem OS.
- Vencimentos derivam sempre da primeira data e índice do ciclo. Mês sem dia correspondente usa
  último dia só naquele ciclo. Atraso ou visita reagendada não desloca datas seguintes. Nenhum
  ciclo gera ocorrência duplicada.

### AC-2: Calendário e alvo

- Dada ocorrência, calendário mostra separadamente vencimento previsto, data da visita, envio
  pendente, OS disponível no Auvo, conclusão e atraso. Fabrício abre ocorrência, escolhe técnico
  e data e confere alvo e questionário antes de confirmar.
- Uma ocorrência equivale a uma OS. Em Sistema, a OS cobre o conjunto de itens apresentado na
  confirmação; em Componente/Equipamento, só o item escolhido.

### AC-3: Criação imediata e contrato Auvo

- Ao confirmar, PCM cria task Auvo com técnico, data, alvo e questionário conferidos, persiste ID
  remoto e exibe vínculo, inclusive quando visita é futura.
- Antes de habilitar confirmação, teste real de POST e GET Auvo comprova os quatro campos na
  task criada para plano de Sistema e de Componente/Equipamento. Se questionário não puder ser
  garantido, bloquear abertura da OS e explicar motivo; nunca enviar tarefa parcial.

### AC-4: Falha, retry e unicidade

- Falha de envio mantém ocorrência pendente, com erro e nova tentativa segura; não aparece como
  OS disponível ao técnico. Se resultado remoto for incerto, reconciliar por chave estável antes
  de repetir POST. Retry/duplicata de comando não cria segunda task/OS nem outro vínculo local.

### AC-5: Sincronização de execução

- Status, respostas, fotos e medições recebidos do Auvo aparecem na ocorrência e histórico PCM;
  reentrega ou evento fora de ordem não duplica nem apaga resultado mais recente.
- Questionário de Sistema preserva o local informado pelo técnico em cada avaliação de item. A
  conclusão aparece no calendário.

### AC-6: Decisão manual sobre achados

- PCM destaca achados para Fabrício. Só ação explícita dele envia achado ao backlog, com origem
  rastreável. Repetir ação não cria item duplicado. Nenhum achado entra automaticamente.

### AC-7: Pausa do plano

- Pausar plano interrompe novos vencimentos, preserva ocorrências, OS e resultados históricos.
  Retomar usa âncora original, sem deslocar datas futuras.

## Fora de escopo

- Recorrência nativa `/serviceorders` ou repetição automática de task Auvo.
- Preencher questionário no PCM; exibir ao técnico OS pelo PCM.
- Backlog automático; laudo PMOC legal; roteirização; alertas de conformidade.

## Rastreabilidade

- `docs/adr/0008-pcm-dono-preventivo-auvo-recorrencia.md`; `design.md`; `tasks.md`.
- E01-S121 documenta PATCH `/tasks/{id}` com `questionnaireId`, `taskDate` e `idUserTo`;
  POST/GET ainda exigem validação viva para este fluxo.
