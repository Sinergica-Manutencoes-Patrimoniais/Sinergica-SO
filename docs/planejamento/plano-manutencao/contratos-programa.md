---
name: contratos-programa
description: Cópia do documento de origem do programa SSO.
alwaysApply: false
source: workspace original Sinérgica SO
---

# Contratos compartilhados do programa SSO

Fonte vinculante: Caderno Técnico v1 + `definicoes-fabricio-caderno-v1.md`. Specs locais detalham comandos; estas invariantes valem em todas E01-S165–S186.

## Comandos e respostas

Comando mutável: `requestId` UUID, identidade do agregado, `expectedRevision` inteiro não negativo e payload validado. Ator/Cliente/escopo são resolvidos da sessão e do agregado no servidor; não confiar no Cliente fornecido. Retry idêntico retorna resultado anterior; mesma chave com payload diferente é conflito. Transação grava mudança, evento de auditoria e intenção externa juntos. Erros 403/404 não revelam outro Cliente; 409 revisão/conflito; 422 validação; 502/503 integração. `problem+json` inclui reqId sem stack/segredo.

Evento entre domínios: eventId, tipo, aggregateId, revision, occurredAt UTC, requestId, origem e payload mínimo. Mesmo evento é no-op. Revisões concorrentes usam compare-and-set e lock; timestamp isolado não prova ordem causal em empate. Evento velho não regride; reabertura é comando explícito auditado, não exceção genérica ao filtro de antiguidade.

## Autorização e auditoria

Capacidades por ação e escopo compõem permissões existentes de módulo. Gestão de Plano exige concessão individual específica; planejador com essa concessão pode autoaprovar. Supervisor/operador autorizado valida execução. Técnico usa Auvo, sem novo papel técnico SSO. Perfis acumulam capacidades permitidas com escopo por Cliente. Auditoria append-only registra ator, antes/depois, motivo, instante e correlação; nenhuma atualização/exclusão é permitida inclusive service_role. Revogação de autorização precisa valer no servidor mesmo com UI/token antigo: resolver concessões atuais para ação crítica.

## Identidade e recorrência

Nomes UI Componentes/Sistemas preservados; `pcm.equipamentos` mantida. Plano multialvo contém Rotinas de alvo único. Snapshot histórico mantém versão e alvo. Chave de ocorrência usa identidade lógica da Rotina, alvo e ciclo estável; versão não libera duplicação. Janela padrão 30 dias inclusiva: em 01/10, 31/10 entra e 01/11 não. Próximos vencimentos calculados da âncora; dias/semanas/meses/anos são unidades distintas; mês curto não desloca ciclos seguintes. Vencido na ativação/retomada pede decisão, sem materialização retroativa em massa.

Por Visita: geração depende da Visita contratual válida, feriado suprime a semana, sem reposição automática/indicador fantasma. Por calendário: vencimento permanece, mesmo em feriado. Tolerâncias inteiras não negativas antes/depois são zero por padrão e não alteram vencimento. Norma aplicável e valor são cadastrados/validados pelo PCM, não inventados pelo modelo. Capacidade usa semana segunda–domingo, programação ou vencimento quando não programada; consulta de baseline preserva atraso.

## OS, Visita e envio

Uma OS pertence a um Chamado e tem uma associação vigente de Visita (histórico preservado). Plano, Ocorrência e Visita não são tarefas Auvo. Nenhuma origem pode contornar T−24 no novo fluxo. Confirmação PCM obrigatória; política de ciência é resolvida Visita > contrato > Cliente > padrão sem controle. Ciência informativa não bloqueia; confirmação cliente obrigatória bloqueia quando configurada. Registrar snapshot da política efetiva na confirmação.

Visita guarda timezone IANA, início/fim e instante UTC; T−24 = início UTC menos 24h. Mudança de programação ou conteúdo após confirmação invalida a revisão confirmada; PCM confirma novamente, mantendo ID remoto se já existe. Trabalhador verifica revisão, confirmação, elegibilidade e política atual antes do efeito. Cancelamento concorrente não envia comando obsoleto. Falha em uma OS não recria tarefas das demais. Resultado incerto aguarda reconciliação, nunca POST cego. API real só habilitada após prova de contrato e liberação operacional.

## Dados e integração

DDD por domínio, TanStack Query nas consultas; query keys incluem Cliente/filtros e invalidam global/360/Portal afetados. Novo UI usa packages/ui, foco/teclado e estados loading/empty/error/success. CORS, JWT, rate-limit, Zod, Vault, HMAC constante seguem constituição. Nenhum secret/service_role no client. Contrato Auvo não comprovado usa fixture/double e gate fechado.

Schemas por domínio, migrations novas sequenciais/aditivas com RLS FORCE e pgTAP permitido/negado. Expand/compatibilidade/backfill/conferência antecedem retirada de restrição antiga; nunca editar migration aplicada. Reserva de número de migration ocorre ao implementar, não neste pacote. Dados financeiros em centavos inteiros, request_id e origem únicos. Não duplicar outbox: reutilizar pcm.auvo_sync_outbox e estender contrato/consumidores com discriminador se necessário, conforme ADR antes de novo mecanismo.

## Homologação e interrupção

Cada story mantém AC locais e teste + tarefa de implementação. CT-001–030 são roteiro futuro; evidência exige versão, ambiente, executor, data, IDs, resultado e ressalva. Testes locais/doubles não são liberação de produção. Pilotos Guainumbí geral e Rimini/I Home preventivo; só desativar planilhas após equivalência e aceite. Se contrato real contrariar o design, registrar SPEC_DEVIATION e ADR de ajuste, mantendo dependente desabilitado; prosseguir apenas nas fatias independentes.
