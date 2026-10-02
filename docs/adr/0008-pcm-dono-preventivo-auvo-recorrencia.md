---
name: ADR-0008
description: PCM governa plano e ocorrências; Auvo executa task criada na confirmação.
alwaysApply: false
---

# ADR-0008 — PCM dono do preventivo; Auvo executor da visita

## Status

Aceita. Contrato POST/GET Auvo pendente de validação viva antes do write path. Esta revisão
substitui decisão anterior de recorrência nativa em `/serviceorders`.

## Contexto

Fabrício define plano, vê vencimentos e confirma técnico/data no PCM. Técnico precisa encontrar
imediatamente no Auvo task agendada, mesmo para visita futura, e responder questionário ali.
PCM precisa governar cada ocorrência e preservar datas futuras quando houver atraso.

## Decisão

PCM gera ocorrências por N semanas ou N meses a partir da primeira data, inicialmente sem OS.
Confirmar visita cria imediatamente uma task Auvo por ocorrência, com técnico, data, alvo e
questionário verificados, e persiste seu ID. Task de Sistema cobre conjunto de itens; task de
Componente/Equipamento cobre só aquele item. Auvo executa; PCM sincroniza status, respostas,
fotos, medições e local digitado por avaliação de Sistema. Achados só seguem ao backlog por ação
de Fabrício. Nenhuma recorrência nativa é criada no Auvo.

Para leitura gerencial, o PCM conserva na ocorrência somente `Pendente`, `OK` ou `Não OK`, além
do vínculo da OS e do link da task. Qualquer resposta explicitamente marcada `Não OK` prevalece.
`OK` só é publicado após task concluída e questionário completo com marcadores positivos
comprovados; formato desconhecido ou texto livre permanece `Pendente`. Formulário, fotos,
medições e relato completos continuam no Auvo — o PCM não os replica como detalhe de execução.

Teste real de POST/GET deve comprovar campos críticos antes do envio. Sem garantia do
questionário, bloquear confirmação com motivo claro. Falha mantém ocorrência pendente. Resultado
incerto exige reconciliação por chave estável antes de retry, preservando uma ocorrência por OS.

## Consequências

- PCM materializa janela de vencimentos, calendário, estado de envio e reconciliação.
- Pausa cessa novos vencimentos e preserva task/resultados históricos.
- Limite real da API para questionário ou Sistema mantém write path bloqueado até revisão
  documentada da decisão.
- A visão histórica não cria uma segunda fonte de verdade do formulário: abre a task correta no
  Auvo e expõe no PCM apenas o selo operacional consolidado.
