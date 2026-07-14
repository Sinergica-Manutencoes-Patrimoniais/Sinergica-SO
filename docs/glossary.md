---
name: glossary
description: Linguagem ubíqua do Sinérgica SO. Puxe ao nomear, modelar domínio ou escrever specs.
alwaysApply: false
---

# Glossário — Linguagem Ubíqua do Sinérgica SO

> Fonte única do vocabulário do sistema. O mesmo termo aparece aqui, na spec e no código.
> Termo novo introduzido por uma feature → adicione no mesmo PR. Sem sinônimos.

| Termo | Definição | NÃO confundir com | Contexto (bounded context) |
|-------|-----------|-------------------|----------------------------|
| **ABNT NBR 16747** | Norma brasileira de Inspeção Predial — define o processo, os campos e a classificação de anomalias de uma inspeção profissional. Base do modelo de inspeção do PCM (E01-S73). | PMOC (norma legal de AR condicionado) | PCM |
| **Análise Microbiológica** | Laudo de laboratório acreditado (INMETRO) obrigatório a cada 6 meses pelo PMOC. Parâmetros: fungos ≤ 750 UFC/m³, relação I/E ≤ 1,5, coliformes = ausência. Resultado não-conforme exige ação imediata. | Inspeção técnica (visual, realizada pela Sinérgica) | PCM/PMOC |
| **Aging** | Distribuição dos recebíveis vencidos por faixa de atraso (a vencer / D+3 / D+7 / D+15+). Base dos alertas de inadimplência. | DSO (prazo médio de recebimento) | Financeiro |
| **ART** | Anotação de Responsabilidade Técnica — documento emitido pelo CREA que vincula Fabrício Medeiros ao serviço PMOC. Obrigatória para vigência do contrato; renovada anualmente. Alerta automático D-30. | NF ou contrato comercial | PCM/PMOC |
| **Apontamento de horas** | Horas trabalhadas por OS, derivadas do check-in/check-out/duração que o técnico registra no Auvo. Ligadas a técnico e cliente para visão de gasto (horas × custo/hora). Não há endpoint Auvo dedicado — deriva-se do GET /tasks. | Controle de ponto (jornada do funcionário) | PCM, Financeiro |
| **Auvo** | App móvel de gestão de campo usado pelos técnicos (check-in GPS, fotos, checklist, assinatura offline). Não é substituível para execução. | PCM (o sistema de decisão) | Todos |
| **Auvo Task** | Tarefa no Auvo — a representação de campo de uma OS do PCM. Criada via API quando OS entra no status `planejamento`. | OS (a entidade de decisão no PCM) | PCM |
| **Backlog** | Lista de itens de manutenção pendentes de um condomínio, priorizados por score GUT. | Lista de chamados (OS abertas) | PCM |
| **Baixa** | Transição `previsto → realizado` de um lançamento (recebimento/pagamento confirmado), com data de pagamento. Pode ocorrer manualmente ou via conciliação. | Conciliação (exige transação de extrato) | Financeiro |
| **BTU/h** | British Thermal Unit por hora — unidade de capacidade de refrigeração dos equipamentos de AR. 12.000 BTU/h = 1 TR (Tonelada de Refrigeração). | kW (potência elétrica consumida) | PCM/PMOC |
| **Backlog Item** | Um único item de manutenção no backlog — origem pode ser inspeção, chamado manual, preventivo ou solicitação do cliente. | OS (ordem de serviço executável) | PCM |
| **Categoria (OS)** | Tipo de trabalho de uma OS: `corretiva`, `preventiva`, `inspecao`, `levantamento`, `emergencial`. | Prioridade (criticidade) | PCM |
| **Chamado** | Sinônimo de Ordem de Serviço no vocabulário do cliente/síndico. Evitar no código — usar `OS`. | Backlog item (pré-OS) | PCM, Atendimento |
| **Competência** | Mês a que um lançamento pertence economicamente (`data_competencia`), independente de quando o dinheiro se moveu. | Data de vencimento ou de pagamento | Financeiro |
| **Conciliação** | Vínculo 1:1 entre uma transação do extrato bancário importado (OFX) e um lançamento. Lançamento conciliado fica imutável até desfazer o vínculo. | Baixa (não exige extrato) | Financeiro |
| **Cursor incremental (sync)** | Estratégia de janela de pull baseada em `MAX(data já sincronizada)` no PCM, não em intervalo fixo — usada em `pcm-auvo-tasks-import` desde E01-S67. Custo por execução cai porque só busca dado novo desde a última rodada, com pequena sobreposição de segurança. | Janela fixa (intervalo de dias constante, reprocessa dado já sincronizado a cada rodada) | PCM |
| **Condensadora** | Unidade externa do sistema de AR condicionado que dissipa o calor para o ambiente. Junto com a evaporadora forma um único equipamento no inventário PMOC. | Evaporadora | PCM/PMOC |
| **Condomínio** | Cliente da Sinérgica — sempre uma pessoa jurídica (condomínio residencial ou comercial). | Cliente prospecto (lead) | PCM, Comercial |
| **Contrato (Financeiro)** | Cadastro de receita recorrente por cliente no módulo Financeiro: valor mensal, vigência, dia de vencimento. Gera os recebíveis do mês. Fonte da receita prevista até o módulo Comercial (E03) existir. | Contrato PMOC (vínculo legal do PCM) · Proposta (Comercial) | Financeiro |
| **Contrato PMOC** | Vínculo formal entre imóvel e Sinérgica para execução do PMOC, com ART, datas de vigência (1 ano) e responsável técnico. Ao criar, gera automaticamente o Cronograma PMOC de 12 visitas. | Contrato comercial (módulo Comercial) | PCM/PMOC |
| **Corretiva** | OS gerada para corrigir um problema identificado (backlog, chamado via Zé, inspeção). | Preventiva (rotina planejada) | PCM |
| **CREA** | Conselho Regional de Engenharia e Agronomia — emite ARTs. Número do CREA de Fabrício é registrado no Contrato PMOC. | INMETRO (laboratórios), ANVISA (vigilância sanitária) | PCM/PMOC |
| **Cronograma PMOC** | 12 visitas anuais por imóvel, geradas automaticamente ao criar um Contrato PMOC. Regra de tipo por mês: mensal (1,2,4,5,7,8,10,11), trimestral (3,9), semestral (6), anual (12). Tipos são acumulativos. | Plano Preventivo geral (multi-disciplina) | PCM/PMOC |
| **Custo/hora de funcionário** | `custo mensal (salário+encargos+benefícios) ÷ horas-base/mês` da vigência aplicável — valoriza as horas de OS no cálculo de rentabilidade. Cadastro do Financeiro sobre `pcm.funcionarios`. | Preço/hora cobrado do cliente | Financeiro |
| **DSO** | Days Sales Outstanding — prazo médio, em dias, entre vencimento e recebimento efetivo. | Aging (foto do atraso atual) | Financeiro |
| **Evaporadora** | Unidade interna do sistema de AR condicionado que resfria o ar do ambiente. Cada evaporadora tem seu próprio número de série no inventário PMOC. | Condensadora | PCM/PMOC |
| **externalId** | ID da OS no PCM enviado ao Auvo para garantir idempotência (não duplica task se reenviar). | auvo_task_id (gerado pelo Auvo) | PCM |
| **FITID** | Identificador único de uma transação dentro do arquivo OFX, atribuído pelo banco. Chave de dedupe do import: reimportar o mesmo extrato não duplica nada. | `id` interno da transação no schema | Financeiro |
| **GUT** | Matriz de priorização: Gravidade × Urgência × Tendência (cada fator 1–5), score de 1 a 125. | NPS (satisfação do cliente) | PCM |
| **Hub de OS** | Fila unificada de Ordens de Serviço de todas as origens (PMOC, PCM geral, chamados). Cada OS tem um Tipo de OS (C1/C2/P1/P2/IN), SLA e prioridade calculada (1–4). Denominação interna do Fabrício: "OS Hub". | OS (entidade individual) | PCM |
| **Inspeção** | Vistoria técnica completa de um condomínio — gera itens com resultado OK/Não OK/Atenção e alimenta o backlog automaticamente. | Visita (atendimento de OS) | PCM |
| **Inventário de Equipamentos** | Cadastro técnico de todos os equipamentos de um imóvel, organizado por disciplina (elétrica, hidráulica, climatização, SPCI, civil, SPDA). Equipamentos de AR são linkados ao PMOC. Tabela: `pcm.pcm_equipment`. | Backlog (lista de OS pendentes) | PCM |
| **Lançamento** | Movimento financeiro único (entrada ou saída) com categoria, competência e valor em centavos. Ciclo: `previsto → realizado → conciliado`. Tabela: `financeiro.lancamentos`. | Transação de extrato (linha OFX ainda não classificada) | Financeiro |
| **Kit (Ferramentas)** | Conjunto nomeado de ferramentas atribuído/devolvido como uma unidade só (tudo-ou-nada). Conceito exclusivo do PCM — o Auvo não tem entidade de kit/bundle; cada item do kit continua sendo seu próprio produto sincronizado individualmente. | Categoria de ferramenta | PCM |
| **Laudo de Visita** | Registro de execução de uma manutenção PMOC: checklist executado por seção, equipamentos atendidos, NCs, materiais, assinaturas digital do técnico e do responsável. Gerado como PDF (via Edge Function) e enviado por e-mail ao responsável do imóvel. | Relatório Mensal (gestão contratual PCM) | PCM/PMOC |
| **Laudo SPDA** | Documento técnico de Sistema de Proteção contra Descargas Atmosféricas (NBR 5419:2026), gerado com auxílio de IA. | Relatório mensal (gestão) | PCM |
| **Levantamento** | Coleta de informações em campo para geração de uma proposta comercial. | Inspeção (vistoria técnica) | Comercial |
| **Grupo** | Conjunto nomeado e reutilizável de permissões por módulo (`leitura`/`escrita`/nenhum), criado em Configurações e atribuído a usuários. | Papel (`superadmin`, `supervisor`, `colaborador`, `cliente-sindico`) | Config |
| **Módulo** | Unidade de acesso da UI do Sinérgica SO: PCM, Atendimento, Comercial, Financeiro, Estoque, Marketing, Growth, Gestão/Cockpit e Área do Cliente. | Bounded context ou schema de banco | Config, Shell |
| **Nível de acesso** | Permissão por módulo: `leitura` permite consultar; `escrita` permite consultar, inserir e atualizar. Ausência de permissão significa nenhum acesso. | Papel global do usuário | Config |
| **NC** | Não-Conformidade — problema encontrado em equipamento durante visita PMOC: descrição, severidade (alta/média/baixa), ação recomendada e prazo. NC alta dispara alerta imediato ao engenheiro. Rastreada em `pcm.pmoc_nonconformity_log`. | Pendência (item para próxima visita, sem severidade classificada) | PCM/PMOC |
| **Ordem de Serviço (OS)** | Registro de um trabalho de manutenção — criado no PCM, executado pelo técnico via Auvo. Identificado por `CH-XXX` na UI. | Auvo Task (reflexo de campo) · Sinérgica SO (Sistema Operacional — produto) | PCM |
| **PCM** | Planejamento e Controle de Manutenção — módulo núcleo do Sinérgica SO, system of record da operação técnica. | Sinérgica SO (o sistema completo) · PMOC (sub-módulo legal de AR) | PCM |
| **Permissão individual** | Configuração de acesso por módulo aplicada diretamente a um usuário, sem grupo. É mutuamente exclusiva com `grupo_id`. | Permissão herdada de grupo | Config |
| **Plano de contas** | Árvore de categorias (2 níveis) que classifica todo lançamento como um tipo de entrada ou saída. Nasce de um seed editável. | Conta bancária (onde o dinheiro está) | Financeiro |
| **Plano Preventivo** | Calendário de manutenções periódicas por equipamento/sistema com periodicidade definida. | Backlog (demanda corretiva) | PCM |
| **Posição de caixa** | Soma dos saldos das contas bancárias ativas (saldo inicial + lançamentos realizados) numa data. Projetada = posição + previstos até o horizonte (30/60/90 dias). | Resultado do mês (entradas − saídas do período) | Financeiro |
| **Preventiva** | OS gerada a partir do plano preventivo — rotina periódica (mensal, trimestral, etc.). | Corretiva (reativa) | PCM |
| **PMOC** | Plano de Manutenção, Operação e Controle — documento legal obrigatório (Portaria MS 3.523/1998) para AR condicionado em edificações coletivas. Sub-módulo do PCM no Sinérgica SO. | PCM (plano geral de manutenção multidisciplina) | PCM/PMOC |
| **Prioridade** | Classificação de uma OS ou backlog item: `critica`, `alta`, `media`, `baixa` (derivada do score GUT). | Categoria (tipo de OS) | PCM |
| **Proposta** | Documento comercial gerado para um condomínio prospecto, com escopo, materiais, MO e valor — pontual ou contrato mensal. | Contrato (proposta aceita) | Comercial |
| **Recebível** | Lançamento de entrada `previsto` com vencimento — gerado por contrato (recorrente) ou avulso. Some da lista ao ser baixado. | Fatura/NF-e (documento fiscal, fora do V1) | Financeiro |
| **Recorrência (Financeiro)** | Despesa fixa mensal (aluguel, salários, software) cadastrada uma vez; gera lançamento de saída previsto todo mês, idempotente por competência. | Contrato (lado da receita) | Financeiro |
| **Reserva de ferramenta** | Bloqueio futuro de uma unidade (ou "qualquer uma" de um tipo) pra um funcionário num intervalo de datas, antes da atribuição efetiva. Não move a ferramenta fisicamente. | Atribuição (posse efetiva, já em mãos) | PCM |
| **Refrigerante** | Fluido que circula no sistema de AR condicionado. R-410A é o padrão moderno; R-22 (HCFC) é antigo e proibido em equipamentos novos desde 2015, mas ainda presente em instalações antigas. | Óleo lubrificante | PCM/PMOC |
| **Relatório Diário** | Consolidação automática das OS executadas no dia por técnico/cliente, enviado ao síndico via WhatsApp. | Relatório mensal | PCM |
| **Relatório Mensal** | PDF consolidando o período (OS, preventivas, SLA, NPS) enviado ao síndico. Gerado por batch agendado. | Relatório diário | PCM |
| **Score PCM** | `gravidade × urgência × tendência` — inteiro de 1 a 125, coluna gerada pelo banco. | Prioridade (classificação qualitativa) | PCM |
| **Síndico** | Representante do condomínio cliente que usa o WhatsApp/portal para abrir chamados e receber relatórios. | Administradora (terceiro) | Atendimento, Área do Cliente |
| **Técnico** | Profissional da Sinérgica que executa OS em campo via app Auvo. | Escritório (operador do sistema) | PCM |
| **Template de checklist** | Modelo de itens esperados de uma inspeção, vinculado a um tipo de inspeção (predial/elétrica/SPDA…). Ao criar uma inspeção do tipo, os itens do template já vêm pré-carregados. Configurável por supervisor sem dev (E01-S73). | Checklist PMOC (constante fixa de manutenção de AR) | PCM |
| **Tipo de Inspeção** | Categoria configurável de inspeção (predial, estrutural, elétrica, SPDA, hidráulica…), cada uma com sua norma técnica e seu template de checklist. Parametrizável (E01-S73). | Categoria/severidade de item de inspeção | PCM |
| **Tipo de OS** | Classificação de uma OS no Hub de OS: C1 (emergencial, SLA 4h), C2 (corretiva, SLA 72h), P1 (preventiva PMOC, janela ±3d), P2 (preventiva predial, janela ±7d), IN (inspeção/follow-up, prazo acordado). | Categoria de OS (modelo anterior sem SLA explícito) | PCM |
| **Unidade de Ferramenta** | Item físico individual de uma ferramenta, com código próprio gerado pelo PCM (`FER-0001`) e histórico append-only de posse. O Auvo só enxerga o agregado por tipo (`totalStock`/`employeesStock`) — a unidade individual não existe lá. | Ferramenta (o tipo/produto, sincronizado com o Auvo) | PCM |
| **Visão 360 do Cliente** | Sub-tela read-only do PCM que consolida, por condomínio, o cadastro do cliente, o backlog GUT de OS em aberto, o histórico de OS concluídas/canceladas (status sincronizado do Auvo) e um painel condicional de equipamentos vinculados. v1 (E01-S12) agrega tabelas já existentes (`pcm.clientes`, `pcm.ordens_servico`), sem escrita e sem nova RLS. | Hub de OS (ações de escrita) · Área do Cliente (portal do síndico, E09) | PCM |
| **Visita** | Agendamento de um técnico em um condomínio em data/turno específico, com itens do backlog associados. | OS (trabalho individual executável) | PCM |
| **Volante** | Modelo de precificação de contrato mensal da Sinérgica — cálculo de custo (salário + encargos + benefícios + veículo + overhead) para definir preço. | Proposta pontual | Comercial |
| **UFC/m³** | Unidades Formadoras de Colônia por metro cúbico — medida de contaminação fúngica do ar interior. Limite legal pela ANVISA RDC 09/2003: ≤ 750 UFC/m³. Resultado da Análise Microbiológica. | % de umidade do ar | PCM/PMOC |
| **Zé** | Agente de IA no WhatsApp que recebe chamados, coleta informações e abre OS no PCM automaticamente. Usa LLM Gemini 2.5 Flash via OpenRouter. | Técnico (humano de campo) | Atendimento |
