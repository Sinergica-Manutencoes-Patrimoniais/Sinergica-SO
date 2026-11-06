---
name: "docs-adr-0732-tratamento-individual-ciclo-vencido-md"
description: "Documento Sinérgica SO: ADR-0732 — Tratamento individual de ciclo vencido por calendário"
alwaysApply: false
---

# ADR-0732 — Tratamento individual de ciclo vencido por calendário

## Status

Proposta para revisão; não autoriza ativação de gates, execução de tarefas Auvo ou alteração dos dados existentes.

## Contexto

A decisão operacional já aprovada determina que uma Rotina por calendário com vencimento em feriado permaneça pendente para tratamento pelo PCM; a execução tardia não desloca a âncora da recorrência. Tolerâncias antes e depois são independentes, com zero por padrão. Na ativação ou retomada, vencidos são apresentados ao PCM sem geração retroativa em massa.

A prévia baseada no snapshot aprovado preserva a âncora. Os comandos 0422, 0747 e 0750 registram triagens/decisões sem efeito operacional. As guardas de 0766/0790 impedem preparar datas passadas e 0764 impede materializar uma ocorrência preparada vencida. Portanto a triagem atual não efetiva o tratamento individual, inclusive para ciclos não preparados.

## Decisão proposta

Adicionar comando individual transacional, explicitamente solicitado pelo PCM e protegido por gate desligado, sem alterar o comportamento legado enquanto desabilitado. O comando recebe Cliente, Plano, versão aprovada, Rotina, ciclo e vencimento original, revisão esperada, motivo e `requestId`. Quando for necessária a integração com Plano Preventivo legado, receber também sua identidade e a referência à relação declarada vigente; não fabricar Plano ou ativo. O comando não presume que triagem, data de feriado ou tolerância equivalham a ordem de execução.

1. Validar identidade e autorização atuais `plano.gerir` e escopo Cliente antes do replay e antes de efetivar; rejeitar `requestId` reaproveitado com payload ou ator divergente.
2. Sob protocolo de locks revisado e consistente com escritores existentes, obter o Plano, versão, snapshot e ciclo; conferir vigência, fuso congelado, alvo, índice, vencimento calculado, tolerâncias e origem de geração. Dados ausentes ou conflitantes falham fechados.
3. Se a ocorrência preparada já existir, reutilizá-la somente mediante identidade canônica comprovada. Caso contrário, preparar uma única ocorrência individual para o ciclo indicado, sem abrir janela retroativa em massa. Conflitos de PMOC, versão ou identidade exigem reconciliação e não são deduplicados apenas pela data.
4. A materialização operacional usa fronteira interna comum e idempotente com 0764, restrita a esta transação e ciclo autorizado. Não conceder `EXECUTE` amplo ao materializador legado nem usar parâmetro de cliente que simplesmente ignore a guarda de vencido. A relação legado, Cliente, alvo, questionário, vigência e frequência continuam sujeitos às verificações canônicas.
5. Registrar ator, motivo, decisão explícita, vencimento original, identidade, versão, revisões, resultado e correlação, no mesmo commit. Uma falha reverte preparação, materialização e auditoria. Nenhuma OS, tarefa ou chamada Auvo nasce desse comando.

Não declarar uma ocorrência executada com base na triagem. A futura associação, confirmação de retorno e encerramento exigem suas próprias provas e protocolo de concorrência. A data de execução é distinta do vencimento original; a próxima data é recalculada pela âncora congelada, não pela execução tardia.

## Inventário inicial de escritores e protocolo pendente

Este inventário é estático e não prova que todas as chamadas indiretas ou externas estejam cobertas:

- `0766` redefine `sso_materializar_ciclo_canonico`: bloqueia o Plano SSO antes de criar ou localizar preparada; o mesmo arquivo restringe a janela a hoje e aos próximos 30 dias.
- `0764` redefine `sso_materializar_ciclo_legado`: bloqueia a preparada, depois o Plano SSO e o Plano Preventivo legado. Essa ordem difere da anterior; uma mediação que encadeie ambas sem protocolo comum não comprova ausência de impasse.
- `0718` vincula ocorrência preparada à legada; `0796` materializa Visita em ocorrência legada. Os vínculos e suas fontes precisam participar da mesma coordenação quando forem aplicáveis.
- `0224` define `materializar_ocorrencias_preventivas`, gerador legado que lê o Plano Preventivo e insere por `(plano_id, indice)`; unicidade dentro do Plano legado não comprova ausência de geração concorrente por outra origem. `0228`, `0308` e `pcm-preventivas-confirmar` também alteram ocorrências legadas.
- `0416`, `0419`, `0271`, `0708` e `0712` são exemplos de escritores de estado, revisão ou Rotinas do Plano SSO. A transição proposta deve conferir suas definições finais, não apenas estas versões históricas.
- `supabase-pmoc-adapter.ts` insere agendamentos PMOC; `pcm-auvo-webhook` também atualiza agendamentos. `0513` apenas diagnostica coincidências e `0518`/`0522` registram decisões humanas; não comprovam exclusividade de origem. A identidade e todos os escritores PMOC ainda precisam ser levantados.
- `0662` protege inserções nas tabelas preparadas SSO, sem proteger geradores legados. `0664` declara inventário incompleto. `0787`, com gate desligado por padrão, aplica `pg_try_advisory_xact_lock` a algumas tabelas de ocorrência, OS e pontes; não cobre automaticamente todos os escritores de Plano ou `pmoc_schedules`.

Protocolo candidato, não aprovado como prova completa: obter uma chave transacional de coordenação comum **antes de qualquer lock de linha**, falhando para retry se indisponível; depois adquirir locks numa ordem única documentada para Plano SSO, identidade de ciclo, Plano legado, preparada e ocorrência/ponte legada. Cada escritor abrangido precisa seguir a mesma ordem ou falhar fechado; verificações de identidade, versão, vínculo e autorização devem ser repetidas sob os locks relevantes. Um trigger após locks já tomados não basta para estabelecer essa ordem. Adaptações devem ser opt-in e preservar comportamento legado com gates desligados.

Antes de implementar esse protocolo, mapear as definições finais das funções, chamadas `SECURITY DEFINER`, escritas diretas, webhook e geradores; provar como uma identidade PMOC é relacionada ao alvo sem inferência. Exercitar pares concorrentes de preparação, materialização/revisão, gerador legado e PMOC/SSO em sessões separadas, com barreiras, timeout e verificação de rollback. Enquanto a cobertura não for comprovada, manter o tratamento operacional fechado.

## Testes obrigatórios antes de liberar

- Prévia mensal em data de feriado declarada conserva vencimento e próximo ciclo ancorado; a decisão de manter para PCM não altera estado, vencimento ou âncora.
- Com decisão explícita, ciclo vencido já preparado é materializado uma única vez; repetição idêntica devolve resultado, conteúdo diferente no mesmo `requestId` conflita.
- Ciclo vencido não preparado é preparado e materializado individualmente numa transação; falha em qualquer etapa não deixa ocorrência parcial, auditoria de sucesso, OS ou envio Auvo.
- Duas sessões concorrentes para o mesmo ciclo, inclusive com versões distintas, não criam duplicidade; versões, feriados, Plano e vínculos alterados em concorrência não geram decisão obsoleta.
- Negar Cliente, alvo, relação, versão ou fuso inconsistentes, autorização revogada, PMOC concorrente e materialização vencida por rota direta. Preservar testes de casos não vencidos e legados.
- Verificar tolerâncias de zero e assimétricas separadamente, sem mudar vencimento nem deduzir execução; testar novo snapshot com vigência e histórico. Testar retorno validado e encerramento apenas após existir contrato operacional comprovável.

## Limites e rollout

A proposta não representa implementação nem PASS. Antes de abrir gate: migration aditiva, revisão adversarial, pgTAP transacional e testes de duas sessões em banco descartável, integração de interface, CI e homologação. Cobertura de feriados declarados continua explicitamente incompleta; não se afirma fonte oficial completa. Não apagar ou renumerar dados históricos.
