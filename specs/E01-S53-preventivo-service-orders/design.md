---
name: design
description: Ocorrências PCM e task Auvo criada na confirmação da visita.
alwaysApply: true
---

# Design — Preventivas no PCM, execução no Auvo

## Decisão

PCM governa plano, série de vencimentos e agendamento. Ativação materializa ocorrências locais
sem ID Auvo. Confirmação de técnico e visita cria imediatamente uma task no Auvo por ocorrência.
Auvo é interface de execução e questionário do técnico. Sem recorrência nativa Auvo.

## Gate do contrato

`specs/E01-S121-editar-campos-sync-auvo/tasks.md` registra PATCH `/tasks/{id}` com
`questionnaireId`, `taskDate` e `idUserTo`. Isso não comprova POST nem GET. Antes do write path,
criar/ler task real de teste com data futura, técnico, alvo e questionário preexistente; registrar
request/response sanitizados e campos retornados. Testar Sistema e Componente/Equipamento.
Confirmar que uma task de Sistema cobre os itens e que respostas retornam local por avaliação.
Se questionário ou alvo correto não puder ser garantido, bloquear confirmação com motivo claro e
revisar decisão; não inferir capacidade pelo OpenAPI ou UI.

## Modelo e invariantes

- `pcm.planos_preventivos`: alvo tipado, primeira data, N, unidade, questionário Auvo, fuso e
  estado `rascunho|ativo|pausado`. Técnico e visita pertencem à ocorrência.
- `pcm.ocorrencias_preventivas`: plano, índice/vencimento, técnico, visita, estado de envio,
  chave de correlação, ID Auvo único, erro seguro e vínculo à OS local. Unicidade por
  `(plano_id, indice)` e ID Auvo. Estado “disponível” só após vínculo persistido.
- Snapshot do alvo e dos itens do Sistema na confirmação; alterações futuras de composição não
  reescrevem task criada. Uma task para conjunto, não task por item.
- Respostas, fotos, medições e local por avaliação entram por ID remoto/identificador estável;
  eventos repetidos ou antigos não regressam estado. Achados têm origem e decisão manual única.

## Recorrência e calendário

Vencimento `i` = primeira data + `i × N` semanas ou meses no fuso do plano. Semanas: sete dias de
calendário. Mês sem dia original: último dia daquele mês só naquele ciclo. Gerar janela futura
idempotente, sem série infinita. Pausa suspende materialização; retomada mantém âncora. Definir
tratamento de ciclos passados ainda não materializados antes do código, sem mover futuros.
Atraso deriva de vencimento passado sem conclusão; visita e vínculo Auvo são dimensões separadas.

## Confirmação e reconciliação

Servidor valida permissão, estado, técnico/data/alvo/questionário e reserva chave idempotente.
Envia task; lê task para confirmar campos críticos; persiste ID. Falha ou timeout mantém
pendência. Antes de retry, procura task pela chave. Se API não permitir correlação confiável,
resultado incerto exige reconciliação segura antes de novo POST. Import/webhook liga apenas por
ID/chave comprovada, nunca título ou data aproximada. Interface mostra erro sem segredo e ação
de retry quando segura.

## Preventivas na Visão 360 do Cliente (AC-8)

- `VisaoClientePage` recebe `clienteId` do contexto e monta a aba **Preventivas** somente com
  permissão de leitura PCM. Extrair o painel de `PreventivasPage` para componente reutilizável
  (ou composição equivalente) com `clienteId` opcional: sem filtro na tela global e filtro
  obrigatório na Visão 360. Formulários e comandos chamam os mesmos casos de uso; nenhuma
  segunda implementação de recorrência, confirmação Auvo, reconciliação ou triagem de achados.
- Consultas de planos aplicam `cliente_id = clienteId` no servidor. Ocorrências são consultadas
  pelos IDs dos planos desse cliente e avaliações pelos IDs dessas ocorrências, também no
  servidor; conjunto vazio não dispara consulta global. Paginação/limite de avaliações ocorre
  depois do filtro. Não carregar tudo para filtrar no browser.
- No novo plano aberto pela Visão 360, `clienteId` vem do contexto, fica fixo e limita Sistemas
  por `cliente_id` e Componentes/Equipamentos por `client_id` nas consultas. A trigger existente
  do plano valida que alvo pertence ao cliente gravado. Confirmação de visita e envio de achados
  continuam usando IDs de ocorrência/avaliação, RBAC e vínculos existentes; usuário com escrita
  PCM já tem escopo global. AC-8 não altera Edge Functions, schema nem RLS.
- Dados remotos passam por TanStack Query com chaves que incluem `clienteId`. Habilitar consultas
  somente quando a aba estiver ativa e leitura autorizada; catálogos de formulário somente
  quando necessários. Na troca de cliente, cancelar/ignorar resposta anterior, limpar seleção e
  formulário, e não mostrar cache do cliente anterior. Invalidar chaves afetadas após mutações
  tanto no painel global quanto na Visão 360. Recarregar a aba usa o mesmo filtro.
- Painel trata carregamento, vazio, erro com retry e sucesso. Sem planos, oferecer criação só a
  quem tem escrita. Confirmar visita continua criando task no Auvo pelo fluxo de AC-3/AC-4; a
  Visão 360 não ganha executor de campo nem questionário próprio.

## Segurança e testes

Migration aditiva, RLS FORCE e pgTAP permitido/negado; permissão no servidor; audit append-only;
segredos só no servidor/Vault. TanStack Query para dados remotos, invalidando após escrita.
Testar recorrência, criação antecipada, idempotência, falha/retry, sync, local de Sistema e envio
manual de achados. Validar plano de Sistema e de Componente/Equipamento. Para AC-8, cobrir
isolamento entre dois clientes (inclusive avaliação e troca rápida), estado vazio/erro e retry,
aba inativa sem consulta, cliente fixo no cadastro, leitura sem escrita e ações compartilhadas
com a tela global.
