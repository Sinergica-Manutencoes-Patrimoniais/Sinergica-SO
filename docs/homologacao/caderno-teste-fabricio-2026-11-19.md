---
name: caderno-teste-fabricio-2026-11-19
description: Roteiro de validação em tela, item a item do Pacote Consolidado do Fabrício, para a entrega mesclada em main em 19/11/2026.
alwaysApply: false
---

# Caderno de teste — validação em tela · Fabrício

**Entrega sob teste:** 17 PRs mesclados em `main` entre 17 e 19/11/2026 (14 stories).
**Regra de referência:** `docs/Apontamentos/Pacote-Consolidado-SSO-2026-11-13.txt` v1.0.
**Confronto item a item:** `docs/homologacao/confronto-entrega-2026-11-19.md`.

---

## Como usar este caderno

1. Faça a **Etapa 0** (preparação) uma vez. Sem ela, a maior parte dos testes mostra
   "disponível, não ativado" — que é o comportamento correto, não um defeito.
2. Cada teste tem: **caminho na tela**, **o que fazer**, **resultado esperado** (escrito com a
   regra do seu pacote) e **o que invalida** (o que significa reprovar).
3. Marque na coluna final: **OK** · **Não OK** · **N/A**. Em "Não OK", escreva o que viu.
4. Testes marcados **🔒 exige ativação** só funcionam depois da Etapa 0 correspondente.
   Testes marcados **🔎 só conferência** não dependem de ativação nenhuma.
5. Testes marcados **🚫 não entregue** estão aqui para registro: a regra existe no pacote, a
   entrega não cobriu. Não teste — apenas confirme se concorda com a priorização.

> **Importante:** este caderno valida **regra de negócio na tela**. A prova técnica (banco,
> concorrência, permissão negada) já está automatizada — a suíte roda do zero a cada alteração.
> O que só um humano consegue dizer é se a tela faz o que a operação precisa.

---

## Etapa 0 — Preparação (uma vez, antes de tudo)

O sistema usa três travas independentes, todas fechadas por padrão: **gate** (banco), **flag**
(publicação do site) e **grant/capacidade** (permissão da pessoa). Isso é proposital — nada liga
sozinho. A tela abaixo mostra e executa a abertura, com motivo registrado.

### 0.0 — ⚠️ Pré-requisito técnico (equipe, antes de agendar a validação)

Uma migration da entrega não aplicava (`1861`, conflito de duas branches sobre a mesma view do
Kanban). **Foi corrigida em 19/11.** Antes de marcar a sessão de validação, a equipe precisa
confirmar:

| Verificação | Como |
|---|---|
| Em qual migration o banco de produção parou | Comparar a última migration aplicada com `1865` |
| Se parou em `1860`, aplicar a correção e o restante | Deploy da `main` com a correção de 19/11 |
| A publicação do site saiu depois do banco | Site antes do banco mostra tela nova sobre banco velho |

**Sem isso, metade deste caderno reprova por motivo errado** — o código estaria publicado e o
banco não.

### 0.1 — Confirmar que a entrega está publicada

| Passo | Resultado esperado |
|---|---|
| Entrar no SSO com um usuário **superadmin** | Menu lateral carrega normalmente |
| Abrir **Configurações** no menu | Aparece a aba **Capacidades** |
| Conferir o Kanban em **PCM → Ordens de Serviço → visão Kanban** | As colunas já são `Solicitações · Preventivas · Demanda · Planejamento · Em execução · Validação PCM · Finalizado` |

Se o Kanban ainda mostrar "Corretiva", "Backlog" ou "Cancelado" como coluna, **a publicação do
site ainda não saiu** — pare aqui e avise, nenhum outro teste de tela vai refletir a entrega.

### 0.2 — Ligar a tela de Ativação de jornadas

Precisa de uma variável de publicação ligada no Netlify e republicação do site:

```
VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED = true
```

Depois: **Configurações → Ativação de jornadas** (só aparece para superadmin).

### 0.3 — Abrir as jornadas que os testes exigem

Na tela **Ativação de jornadas**, para cada jornada: conferir o diagnóstico (ela lista o que falta,
camada por camada), digitar o código da jornada + um motivo, e confirmar.

| Jornada | Libera | Necessária para |
|---|---|---|
| `chamado-multiplas-os` | Criar mais de uma OS no mesmo Chamado pela tela | Teste 1 (BL 001) |
| `central-materiais` | Eventos de material na OS | Teste 10 (BL 010) |

> ⚠️ **Decisão sua, não técnica:** abrir `chamado-multiplas-os` libera múltiplas OS por Chamado em
> **todo o sistema**, não só num cliente piloto. É o item com maior efeito operacional desta
> entrega. Recomendação da equipe: abrir primeiro em janela combinada, com um cliente piloto em
> observação. O retorno (fechar de novo) está pronto e **não apaga nada já criado**.

### 0.4 — Variáveis de publicação dos demais testes

Ligar no Netlify e republicar. Cada uma pode ser ligada isoladamente:

| Variável | Libera | Teste |
|---|---|---|
| `VITE_SSO_KANBAN_BACKLOG_ESCOPO_ENABLED` | Painel lateral do Backlog no Kanban | 2 |
| `VITE_SSO_PENDENCIAS_TECNICAS_ENABLED` | Lista de pendências técnicas por ativo | 3, 8 |
| `VITE_SSO_PENDENCIAS_FILTRO_ATIVO_ENABLED` | Filtro por ativo dentro das pendências | 8 |
| `VITE_SSO_BACKLOG_COMPOSICAO_ENABLED` | Botão "Compor Backlog" | 3, 8 |
| `VITE_SSO_PROMOVER_BACKLOG_CHAMADO_ENABLED` | Botão "Liberar escopo" (Backlog → Chamado) | 3 |
| `VITE_SSO_CAPACIDADE_AGENDA_ENABLED` | Aba de capacidade/agenda dentro do cliente | 6, 9 |
| `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED` | Trechos de deslocamento com enquadramento | 9 |

### 0.5 — Gates de banco que ainda não têm tela de abertura

Estes precisam ser abertos pela equipe técnica (migration aditiva auditada), **com sua
autorização**:

| Gate | Libera | Teste |
|---|---|---|
| `pcm.sso_backlog_composicao_gate`, `sso_promocao_backlog_gate`, `sso_backlog_chamado_gate`, `sso_backlog_parcela_gate`, `sso_divisao_backlog_gate` | Caminho Pendência → Backlog → Chamado em Demanda | 3 |
| `pcm.sso_trechos_deslocamento_gate` | Registro de trechos de deslocamento | 9 |

### 0.6 — Capacidades a conceder

Em **Configurações → Capacidades**, conceder a quem vai testar:

| Capacidade | Necessária para |
|---|---|
| `execucao.validar` | Mover OS para **Finalizado** (teste 7) |
| `execucao.contingencia_auvo` | Abrir OS manualmente no Auvo (teste 5) |

---

## Bloco A — Chamado, OS, Backlog e Demanda

### Teste 1 — Um Chamado com várias OS 🔒 (BL 001)

> **Sua regra:** *"Um Chamado admite uma ou várias OS. Uma OS pode ser encerrada sem encerrar o
> Chamado. O Chamado somente encerra após tratamento integral do escopo e validação do PCM."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 1.1 | Abrir um Chamado e criar a **primeira** OS | OS criada, Chamado continua aberto | |
| 1.2 | No mesmo Chamado, criar uma **segunda** OS | Segunda OS criada, vinculada ao mesmo Chamado, com histórico próprio | |
| 1.3 | Encerrar **apenas a primeira** OS | A OS fica encerrada; **o Chamado continua aberto** | |
| 1.4 | Abrir o detalhe do Chamado | Mostra as duas OS, cada uma com seu estado | |
| 1.5 | Tentar encerrar o Chamado com a segunda OS ainda aberta | Sistema recusa com mensagem clara (não encerra pela metade) | |
| 1.6 | Conferir no Auvo | **Uma tarefa por OS** — nunca duas tarefas para a mesma OS | |

**O que invalida:** criar a segunda OS falhar com erro técnico; encerrar uma OS encerrar o Chamado
junto; aparecerem duas tarefas Auvo para a mesma OS.

### Teste 2 — Backlog fora do Kanban, em painel lateral 🔒 (BL 002, BL 007)

> **Sua regra:** *"Backlog fica disponível em painel lateral priorizado, e não como etapa comum do
> Kanban. Cancelado permanece como situação consultável, não como coluna cotidiana."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 2.1 | Abrir **PCM → Ordens de Serviço → Kanban**, escolher um cliente | O Backlog aparece como **painel lateral**, nunca como coluna | |
| 2.2 | Conferir as colunas | Exatamente: Solicitações, Preventivas, Demanda, Planejamento, Em execução, Validação PCM, Finalizado | |
| 2.3 | Procurar um item que esteja no painel lateral, nas colunas | O mesmo item **não** aparece nos dois lugares (sem cartão duplicado) | |
| 2.4 | Procurar por uma OS cancelada usando o **filtro de situação** | A OS cancelada é encontrada e consultável | |

**O que invalida:** Backlog como coluna; Cancelado como coluna; cartão duplicado entre painel e
coluna.

### Teste 3 — Backlog antecede Chamado e OS 🔒 (BL 002)

> **Sua regra:** *"Backlog contém escopos já validados, mas ainda sem compromisso de execução. A
> seleção do PCM cria um Chamado e o envia para Demanda. Apenas pendências escolhidas pelo PCM
> entram no Backlog."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 3.1 | Abrir **PCM → Clientes → (cliente) → Visão 360 → Preventivas → Pendências técnicas** | Lista de pendências, agrupadas por ativo | |
| 3.2 | Selecionar 2 pendências e usar **"Compor Backlog"** | Um item de Backlog agrupando as 2 é criado | |
| 3.3 | **Conferir:** foi criado algum Chamado ou OS? | **Nenhum.** Compor Backlog não cria Chamado nem OS | |
| 3.4 | No item de Backlog, informar **GUT** (gravidade, urgência, tendência) | Prioridade registrada no item de Backlog (não na OS) | |
| 3.5 | Usar **"Liberar escopo"** no item do Backlog | Agora sim: um Chamado é criado **e entra em Demanda** | |
| 3.6 | Conferir a origem no Chamado criado | Mostra de quais pendências veio (origem e histórico preservados) | |
| 3.7 | Liberar **só parte** de um item de Backlog com 4 pendências | Chamado criado só com o escopo liberado; **as demais continuam no Backlog, intactas** | |

**O que invalida:** criar Chamado/OS já na composição; perder a origem; a parte não liberada sumir
ou mudar de situação.

### Teste 4 — Demanda é estado do Chamado, não entidade 🔒 (BL 002, BL 007)

> **Sua regra:** *"Demanda é um estado do Chamado pronto para planejamento, e não uma entidade
> independente. Chamado adiado por curto prazo retorna para Demanda."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 4.1 | Conferir a coluna **Demanda** no Kanban | Mostra Chamados liberados do Backlog que ainda não viraram OS | |
| 4.2 | Criar OS a partir de um Chamado em Demanda | A OS nasce direto em **Planejamento** (já passou da triagem), não em Solicitação | |
| 4.3 | Procurar um cadastro/menu separado chamado "Demanda" | **Não existe** — Demanda é só a etapa do Chamado | |
| 4.4 | Pegar um Chamado já em Planejamento e adiá-lo | Volta para **Demanda**, sem perder histórico | |

---

## Bloco B — Auvo, T−24 e execução

### Teste 5 — Gatilho único e contingência auditada 🔒 (BL 004)

> **Sua regra:** *"Manter um único gatilho normal: confirmação PCM + T−24. Transformar criação
> manual em contingência auditada."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 5.1 | Confirmar uma Visita com mais de 24h de antecedência | Envio fica **programado**, nada sai para o Auvo ainda | |
| 5.2 | Confirmar uma Visita que começa em menos de 24h | Tarefas saem **imediatamente** para o Auvo | |
| 5.3 | Reprogramar a data **antes** do envio | Só recalcula o T−24, sem criar tarefa nova | |
| 5.4 | Reprogramar **depois** do envio | **Atualiza a mesma tarefa** no Auvo — não cria segunda tarefa | |
| 5.5 | Tentar abrir OS manualmente no Auvo **sem** a capacidade `execucao.contingencia_auvo` | Recusa com mensagem clara ("sem capacidade de contingência"), não tela em branco nem erro técnico | |
| 5.6 | Repetir **com** a capacidade concedida | Pede **motivo obrigatório** antes de abrir | |
| 5.7 | Conferir o registro da contingência | Registra **quem** abriu (pessoa real, não "sistema"), **quando** e **por quê** | |
| 5.8 | Abrir manualmente uma OS que estouraria a capacidade do dia | Avisa antes de reservar a tarefa, não depois | |

**O que invalida:** contingência sem motivo; registro atribuído ao "sistema" em vez da pessoa;
reprogramação gerando tarefa duplicada.

### Teste 6 — Retorno do campo cai em Validação PCM 🔎 (BL 004, BL 007)

> **Sua regra:** *"Retorno do Auvo atualiza a OS e a envia para Validação PCM; não encerra
> automaticamente o Chamado."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 6.1 | Finalizar uma tarefa **no Auvo** | No SSO, a OS vai para **Validação PCM** — não para Finalizado | |
| 6.2 | Conferir o Chamado dessa OS | Continua **aberto**, aguardando a validação | |
| 6.3 | Conferir se os registros de campo (fotos, respostas, materiais) chegaram | Chegaram normalmente, sem esperar a validação do PCM | |

### Teste 7 — Finalizar exige capacidade 🔒 (BL 005, BL 007)

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 7.1 | Com usuário **sem** `execucao.validar`, tentar mover a OS para Finalizado | Recusa com mensagem nomeada; a OS **continua** em Validação PCM | |
| 7.2 | Com usuário **com** a capacidade, repetir | OS finalizada | |
| 7.3 | Tentar em **lote** com usuário sem a capacidade | Recusa igual, sem deixar metade do lote finalizado | |

---

## Bloco C — Pendências, deslocamento e agenda

### Teste 8 — Pendências agrupadas por ativo, sem perder o achado 🔒 (BL 008)

> **Seu critério literal:** *"Sete achados no mesmo quadro aparecem em um cartão com sete
> pendências; o PCM envia somente duas ao Backlog; as cinco restantes conservam sua situação."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 8.1 | Executar uma preventiva com vários itens **Não OK** no mesmo quadro/equipamento | A preventiva é **concluída** (Não OK não a mantém aberta) | |
| 8.2 | Abrir Pendências técnicas do cliente | **Um cartão** por ativo, com a contagem de pendências dentro | |
| 8.3 | Conferir um item respondido **OK** | Não virou pendência | |
| 8.4 | Conferir se algum Chamado/OS foi criado automaticamente | **Nenhum** — a falha não cria Chamado nem OS sozinha | |
| 8.5 | Selecionar **2** das pendências e compor Backlog | Só as 2 vão; **as demais conservam a situação**, sem alteração | |
| 8.6 | Abrir uma pendência individual | Mostra a resposta de origem, o ativo e a evidência | |
| 8.7 | Usar o filtro por ativo | Filtra sem perder o agrupamento | |
| 8.8 | Reenviar o mesmo achado (reabertura) | Não duplica a pendência | |

**Observação:** em alvo do tipo **Grupo quantitativo** (sem TAG individual) o comportamento é o
mesmo — está coberto por teste automatizado.

### Teste 9 — Deslocamento: residencial × operacional 🔒 (BL 009)

> **Sua regra:** *"Residência → primeiro cliente e último cliente → residência **não computam**,
> inclusive com veículo da empresa sob guarda do técnico. Escritório → cliente, cliente → cliente,
> cliente → escritório e retiradas a serviço **computam**. O computável ocupa jornada, mas não
> reduz as horas contratadas do cliente."*

Caminho: **PCM → Clientes → (cliente) → Visão 360 → Estrutura → Capacidade e Agenda → Fontes de
Demanda →** expandir a Visita **→ "Conferir trechos de deslocamento"**.

| # | Trecho declarado | Resultado esperado | OK? |
|---|---|---|---|
| 9.1 | Residência → primeiro cliente | **Não computa** | |
| 9.2 | Último cliente → residência | **Não computa** | |
| 9.3 | Residência → cliente **com veículo da empresa em casa** | **Não computa** (a guarda do veículo não muda a regra) | |
| 9.4 | Escritório → cliente | **Computa** | |
| 9.5 | Cliente → cliente | **Computa** | |
| 9.6 | Cliente → escritório | **Computa** | |
| 9.7 | Retirada/entrega a serviço | **Computa** | |
| 9.8 | Conferir os totais na mesma tela | Mostra total computado **e** não computado, separados | |
| 9.9 | Tentar mudar o enquadramento "na mão" | **Não é editável** — é sempre derivado de origem e destino | |
| 9.10 | Conferir as horas contratadas do cliente | **Não foram reduzidas** pelo deslocamento | |
| 9.11 | Declarar trechos que estouram a jornada | Registra e informa; **não bloqueia** o PCM nem classifica hora extra sozinho | |

**Pendência conhecida (não é defeito de teste):** o sistema mostra o total computável, mas **não
compara com um limite de jornada**, porque não existe jornada contratada cadastrada. Se você quiser
esse alerta, é uma regra nova a definir (quantas horas, por quem).

### Teste 10 — Materiais e Aquisições 🔒 (BL 010)

> **Sua regra:** *"Preservar o texto original e permitir estruturação opcional. O PCM define
> responsável, impacto, necessidade de orçamento e situação. Responsável é Cliente ou Sinérgica.
> Informação de disponibilidade do cliente não é conferência técnica."*

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 10.1 | Técnico registra necessidade de material no Auvo | O **texto original** chega íntegro ao SSO | |
| 10.2 | No PCM, estruturar em itens | É **opcional** — dá para seguir só com o texto | |
| 10.3 | Definir responsável **Cliente** e depois **Sinérgica** | Troca registrada com histórico | |
| 10.4 | Cliente informa disponibilidade | Fica claro que é **informação**, não conferência técnica | |
| 10.5 | Campo encontra material faltando/errado | **Atualiza/reabre a pendência existente** — não cria outra do zero | |
| 10.6 | Procurar tudo por cliente e por OS | Encontra | |

### Teste 11 — Orçamento operacional e proteção de custo 🔎 (BL 011)

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 11.1 | Gerar um orçamento operacional a partir de uma OS | Criado, **opcional** (dá para seguir sem) | |
| 11.2 | Conferir o cálculo com **fator 1,5** | Preço = **150% do custo** (markup de 50%) — nunca 1,5% | |
| 11.3 | Conferir onde ficam os tributos | **Configuráveis** na aplicação, não fixos no código | |
| 11.4 | Abrir a visão do **Cliente** | Cliente **não vê** custo interno, nota de aquisição, tributos internos, markup ou margem | |
| 11.5 | Registrar aprovação obtida por WhatsApp/e-mail | O PCM consegue registrar a aprovação externa | |

### Teste 12 — Origem única dos faturáveis 🔎 (BL 012)

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 12.1 | Gerar um faturável a partir de uma despesa/material | Item aparece em "A faturar" com a origem rastreável (Visita, OS, Chamado ou cliente) | |
| 12.2 | Tentar gerar **outro** faturável da **mesma origem** | **Recusado** — origem não fatura duas vezes | |
| 12.3 | Financeiro recusar ou ajustar um item | Permitido, com registro de quem fez | |
| 12.4 | Conferir classificação | Interno, faturável, contratual ou coberto por orçamento | |

---

## Bloco D — Permissões e segurança

### Teste 13 — Capacidades sensíveis 🔎 (BL 005) · *não exige ativação*

Caminho: **Configurações → Capacidades** (superadmin).

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 13.1 | Criar um perfil (ex.: "Operador PCM") e conceder capacidades | Perfil criado; capacidades por **ação**, não só leitura/escrita do módulo | |
| 13.2 | Operador com escrita operacional tenta **aprovar** sem a capacidade | Recusado | |
| 13.3 | O mesmo operador tenta **ver custo interno** | Recusado | |
| 13.4 | Usuário Financeiro tenta **alterar a operação** | Recusado | |
| 13.5 | Usuário Cliente tenta ver **outro condomínio** | Recusado | |
| 13.6 | Conferir se há nome de pessoa dentro da regra | **Não há** — pessoas recebem grupos e capacidades | |
| 13.7 | Conferir o registro das concessões | Toda concessão fica auditada | |

### Teste 14 — Revogação imediata 🔎 (BL 006) · *não exige ativação*

> **Sua regra:** *"Desativação, revogação e mudança crítica de perfil passam a valer sem atraso
> operacional relevante. Sessões existentes não preservam poderes revogados."*

Caminho: **Configurações → Capacidades → "Revogar ou reativar usuário"**.

| # | O que fazer | Resultado esperado | OK? |
|---|---|---|---|
| 14.1 | Com o usuário-alvo **logado em outra máquina**, revogue o acesso | Na **próxima ação** dele o acesso é negado — **sem precisar deslogar ou esperar o token expirar** | |
| 14.2 | Repetir com o usuário logado em **dois dispositivos** | Perde nos dois | |
| 14.3 | Reativar o usuário | Volta a funcionar na próxima ação | |
| 14.4 | Tentar revogar **a si mesmo** | Bloqueado com mensagem clara | |
| 14.5 | Conferir a trilha | Revogação e reativação ficam auditadas com motivo | |

> Este era o **risco de segurança aberto** apontado na auditoria. Era o item mais crítico da lista
> e é o teste mais importante deste caderno.

---

## Bloco E — API e MCP (não são tela)

Estes dois são contratos técnicos, validados por chamada autenticada e não por tela. Peça à equipe
uma demonstração ao vivo; o roteiro abaixo é o que ela deve mostrar.

### Teste 15 — API de domínio 🔎 (BL 014)

| # | O que deve ser demonstrado | Resultado esperado | OK? |
|---|---|---|---|
| 15.1 | Chamada **sem autenticação** | Recusada | |
| 15.2 | Chamada autenticada, usuário **sem** a capacidade de cadastro | Recusada com erro nomeado, nunca erro técnico genérico | |
| 15.3 | Criar um lote de levantamento | Entra em **staging**, nunca no cadastro oficial | |
| 15.4 | Repetir a mesma chamada com o mesmo identificador | **Não duplica** (idempotência) | |
| 15.5 | Enviar payload inválido | Erro de validação claro, nada gravado | |
| 15.6 | Consultar prévia do lote | Mostra o que entraria, sem efeito | |
| 15.7 | Pedir "rodar um SQL qualquer" | **Não existe essa possibilidade** — nenhuma ferramenta genérica de SQL é exposta | |

### Teste 16 — MCP controlado 🔎 (BL 015)

| # | O que deve ser demonstrado | Resultado esperado | OK? |
|---|---|---|---|
| 16.1 | Listar as ferramentas disponíveis à IA | Catálogo **fechado e nomeado** — não é "acesso ao banco" | |
| 16.2 | Consultar dados de um cliente | Só o escopo permitido ao usuário; não cruza clientes | |
| 16.3 | Pedir à IA uma escrita no cadastro oficial | **Impossível** — primeira entrega é só leitura | |
| 16.4 | Chamar uma ferramenta fora do catálogo | Erro nomeado | |
| 16.5 | Conferir o registro de uso | Registra **quem** chamou, **qual** ferramenta e o resultado | |
| 16.6 | Revogar o acesso do usuário (teste 14) e repetir a chamada | Negado imediatamente | |

---

## Bloco F — Itens do pacote que esta entrega **não** cobriu 🚫

Não há o que testar. Estão aqui para você confirmar a priorização da próxima rodada.

| Item | Regra do pacote | Situação |
|---|---|---|
| **BL 013 — Navegação por função** | Organizar em Trabalho / Gestão / Administração; menu por grupo; rota oculta também bloqueada | **Não iniciado.** Spec e plano escritos, nenhuma task executada |
| **Assessment → Inspeção "Diagnóstico Inicial do Cliente"** | Assessment deixa de existir como módulo | **Não iniciado** (faz parte de BL 013) |
| **PMOC → modalidade do Plano de Manutenção** | Visão filtrada, sem módulo nem cadastro próprios | **Não iniciado** (faz parte de BL 013) |
| **Área única "Materiais e Aquisições" no menu** | Agrupar a jornada de material | **Não iniciado** (depende de BL 013) |
| **Kanban — coluna "Campo a conciliar"** | Terceira fila de entrada: OS aberta no Auvo sem Chamado | **Não entregue.** Decisão documentada: a ligação com a triagem de origem Auvo não foi concluída a tempo, e uma coluna sempre vazia enganaria mais do que a ausência |
| **Agenda do Técnico mostrando as OS vinculadas** | Agenda é projeção da Visita, não cadastro paralelo | **Não entregue.** O diagnóstico foi feito e a causa está nomeada: a Agenda é tabela própria e ninguém escreve nela a partir da Visita. Exige decidir quem passa a escrever |
| **Monitor consolidado de exceções do Auvo** | Visita não confirmada, falha de envio, tarefa órfã | **Não existe** em lugar nenhum do sistema (achado novo desta rodada) |
| **Matriz completa de transições do Kanban** | "Arrastar respeita transições permitidas" | Só a entrada em Finalizado tem guarda; as demais transições seguem livres |

---

## Encerramento

| Campo | Preencher |
|---|---|
| Data da validação | |
| Ambiente (produção / homologação) | |
| Quem validou | |
| Itens **OK** | |
| Itens **Não OK** | |
| Decisão sobre abrir `chamado-multiplas-os` em produção | |
| Prioridade acordada para BL 013 (navegação) | |
