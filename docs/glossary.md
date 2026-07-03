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
| **Análise Microbiológica** | Laudo de laboratório acreditado (INMETRO) obrigatório a cada 6 meses pelo PMOC. Parâmetros: fungos ≤ 750 UFC/m³, relação I/E ≤ 1,5, coliformes = ausência. Resultado não-conforme exige ação imediata. | Inspeção técnica (visual, realizada pela Sinérgica) | PCM/PMOC |
| **ART** | Anotação de Responsabilidade Técnica — documento emitido pelo CREA que vincula Fabrício Medeiros ao serviço PMOC. Obrigatória para vigência do contrato; renovada anualmente. Alerta automático D-30. | NF ou contrato comercial | PCM/PMOC |
| **Auvo** | App móvel de gestão de campo usado pelos técnicos (check-in GPS, fotos, checklist, assinatura offline). Não é substituível para execução. | PCM (o sistema de decisão) | Todos |
| **Auvo Task** | Tarefa no Auvo — a representação de campo de uma OS do PCM. Criada via API quando OS entra no status `planejamento`. | OS (a entidade de decisão no PCM) | PCM |
| **Backlog** | Lista de itens de manutenção pendentes de um condomínio, priorizados por score GUT. | Lista de chamados (OS abertas) | PCM |
| **BTU/h** | British Thermal Unit por hora — unidade de capacidade de refrigeração dos equipamentos de AR. 12.000 BTU/h = 1 TR (Tonelada de Refrigeração). | kW (potência elétrica consumida) | PCM/PMOC |
| **Backlog Item** | Um único item de manutenção no backlog — origem pode ser inspeção, chamado manual, preventivo ou solicitação do cliente. | OS (ordem de serviço executável) | PCM |
| **Categoria (OS)** | Tipo de trabalho de uma OS: `corretiva`, `preventiva`, `inspecao`, `levantamento`, `emergencial`. | Prioridade (criticidade) | PCM |
| **Chamado** | Sinônimo de Ordem de Serviço no vocabulário do cliente/síndico. Evitar no código — usar `OS`. | Backlog item (pré-OS) | PCM, Atendimento |
| **Condensadora** | Unidade externa do sistema de AR condicionado que dissipa o calor para o ambiente. Junto com a evaporadora forma um único equipamento no inventário PMOC. | Evaporadora | PCM/PMOC |
| **Condomínio** | Cliente da Sinérgica — sempre uma pessoa jurídica (condomínio residencial ou comercial). | Cliente prospecto (lead) | PCM, Comercial |
| **Contrato PMOC** | Vínculo formal entre imóvel e Sinérgica para execução do PMOC, com ART, datas de vigência (1 ano) e responsável técnico. Ao criar, gera automaticamente o Cronograma PMOC de 12 visitas. | Contrato comercial (módulo Comercial) | PCM/PMOC |
| **Corretiva** | OS gerada para corrigir um problema identificado (backlog, chamado via Zé, inspeção). | Preventiva (rotina planejada) | PCM |
| **CREA** | Conselho Regional de Engenharia e Agronomia — emite ARTs. Número do CREA de Fabrício é registrado no Contrato PMOC. | INMETRO (laboratórios), ANVISA (vigilância sanitária) | PCM/PMOC |
| **Cronograma PMOC** | 12 visitas anuais por imóvel, geradas automaticamente ao criar um Contrato PMOC. Regra de tipo por mês: mensal (1,2,4,5,7,8,10,11), trimestral (3,9), semestral (6), anual (12). Tipos são acumulativos. | Plano Preventivo geral (multi-disciplina) | PCM/PMOC |
| **Evaporadora** | Unidade interna do sistema de AR condicionado que resfria o ar do ambiente. Cada evaporadora tem seu próprio número de série no inventário PMOC. | Condensadora | PCM/PMOC |
| **externalId** | ID da OS no PCM enviado ao Auvo para garantir idempotência (não duplica task se reenviar). | auvo_task_id (gerado pelo Auvo) | PCM |
| **GUT** | Matriz de priorização: Gravidade × Urgência × Tendência (cada fator 1–5), score de 1 a 125. | NPS (satisfação do cliente) | PCM |
| **Hub de OS** | Fila unificada de Ordens de Serviço de todas as origens (PMOC, PCM geral, chamados). Cada OS tem um Tipo de OS (C1/C2/P1/P2/IN), SLA e prioridade calculada (1–4). Denominação interna do Fabrício: "OS Hub". | OS (entidade individual) | PCM |
| **Inspeção** | Vistoria técnica completa de um condomínio — gera itens com resultado OK/Não OK/Atenção e alimenta o backlog automaticamente. | Visita (atendimento de OS) | PCM |
| **Inventário de Equipamentos** | Cadastro técnico de todos os equipamentos de um imóvel, organizado por disciplina (elétrica, hidráulica, climatização, SPCI, civil, SPDA). Equipamentos de AR são linkados ao PMOC. Tabela: `pcm.pcm_equipment`. | Backlog (lista de OS pendentes) | PCM |
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
| **Plano Preventivo** | Calendário de manutenções periódicas por equipamento/sistema com periodicidade definida. | Backlog (demanda corretiva) | PCM |
| **Preventiva** | OS gerada a partir do plano preventivo — rotina periódica (mensal, trimestral, etc.). | Corretiva (reativa) | PCM |
| **PMOC** | Plano de Manutenção, Operação e Controle — documento legal obrigatório (Portaria MS 3.523/1998) para AR condicionado em edificações coletivas. Sub-módulo do PCM no Sinérgica SO. | PCM (plano geral de manutenção multidisciplina) | PCM/PMOC |
| **Prioridade** | Classificação de uma OS ou backlog item: `critica`, `alta`, `media`, `baixa` (derivada do score GUT). | Categoria (tipo de OS) | PCM |
| **Proposta** | Documento comercial gerado para um condomínio prospecto, com escopo, materiais, MO e valor — pontual ou contrato mensal. | Contrato (proposta aceita) | Comercial |
| **Refrigerante** | Fluido que circula no sistema de AR condicionado. R-410A é o padrão moderno; R-22 (HCFC) é antigo e proibido em equipamentos novos desde 2015, mas ainda presente em instalações antigas. | Óleo lubrificante | PCM/PMOC |
| **Relatório Diário** | Consolidação automática das OS executadas no dia por técnico/cliente, enviado ao síndico via WhatsApp. | Relatório mensal | PCM |
| **Relatório Mensal** | PDF consolidando o período (OS, preventivas, SLA, NPS) enviado ao síndico. Gerado por batch agendado. | Relatório diário | PCM |
| **Score PCM** | `gravidade × urgência × tendência` — inteiro de 1 a 125, coluna gerada pelo banco. | Prioridade (classificação qualitativa) | PCM |
| **Síndico** | Representante do condomínio cliente que usa o WhatsApp/portal para abrir chamados e receber relatórios. | Administradora (terceiro) | Atendimento, Área do Cliente |
| **Técnico** | Profissional da Sinérgica que executa OS em campo via app Auvo. | Escritório (operador do sistema) | PCM |
| **Tipo de OS** | Classificação de uma OS no Hub de OS: C1 (emergencial, SLA 4h), C2 (corretiva, SLA 72h), P1 (preventiva PMOC, janela ±3d), P2 (preventiva predial, janela ±7d), IN (inspeção/follow-up, prazo acordado). | Categoria de OS (modelo anterior sem SLA explícito) | PCM |
| **Visão 360 do Cliente** | Sub-tela read-only do PCM que consolida, por condomínio, o cadastro do cliente, o backlog GUT de OS em aberto, o histórico de OS concluídas/canceladas (status sincronizado do Auvo) e um painel condicional de equipamentos vinculados. v1 (E01-S12) agrega tabelas já existentes (`pcm.clientes`, `pcm.ordens_servico`), sem escrita e sem nova RLS. | Hub de OS (ações de escrita) · Área do Cliente (portal do síndico, E09) | PCM |
| **Visita** | Agendamento de um técnico em um condomínio em data/turno específico, com itens do backlog associados. | OS (trabalho individual executável) | PCM |
| **Volante** | Modelo de precificação de contrato mensal da Sinérgica — cálculo de custo (salário + encargos + benefícios + veículo + overhead) para definir preço. | Proposta pontual | Comercial |
| **UFC/m³** | Unidades Formadoras de Colônia por metro cúbico — medida de contaminação fúngica do ar interior. Limite legal pela ANVISA RDC 09/2003: ≤ 750 UFC/m³. Resultado da Análise Microbiológica. | % de umidade do ar | PCM/PMOC |
| **Zé** | Agente de IA no WhatsApp que recebe chamados, coleta informações e abre OS no PCM automaticamente. Usa LLM Gemini 2.5 Flash via OpenRouter. | Técnico (humano de campo) | Atendimento |
