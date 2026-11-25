---
name: continuidade-homologacao-2026-11-25
description: Continuação da estrutura 360, entrada Materiais e Aquisições e exemplos do Escritório.
alwaysApply: false
---

# Continuação da homologação — 25/11/2026

Owner: Codex, autorizado por Lucas. Branch `feat/E01-S190-jornadas-estrutura-materiais`.
Ambiente publicado: <https://so-sinergica.netlify.app>. Cliente de exemplo:
**Sinérgica - Escritório**, id `741a283b-8e23-449f-83c7-668f35c98f20`.
As cinco contas já existem; acessos e matriz em [contas de teste](contas-de-teste-2026-11-24.md).
A versão usada no aceite deve ser o SHA do deploy do Netlify, registrado junto à evidência.

## Entrega de código

- E01-S190 AC-9/AC-10: Clientes e Estrutura → Cliente → Estrutura. Busca global por nome,
  código ou TAG, com tipo explícito; navegação Área/Local/Sistema/Equipamento/Componente/Grupo.
  Detalhes e identidades existentes permanecem; localização física não vira pertencimento funcional.
- E01-S179 AC-7/AC-8: Trabalho → Materiais e Aquisições → Cliente. Central, disponibilidade,
  exceções e orçamento da OS reutilizados; troca de Cliente desmonta contexto anterior.
- Filtro de situação inclui aguardando aquisição, dispensada e concluída, além dos quatro anteriores.
- Migrations 1893/1894: consulta de leitura e ativação dos cinco contratos mediados de Materiais.
  Nenhuma concessão alterada; publicação no Portal e integração Auvo não foram ativadas.
- Publicar servidor antes do front. Depois de merge/deploy, conferir com os perfis da rodada.
  Código implementado não é evidência de aceite operacional.

## Exemplos para o ambiente publicado

Lucas escolheu o Escritório publicado, sem envio real ao Auvo. SQL fonte:
[preparar](../../supabase/tests/fixtures/homologacao-escritorio-preparar.sql) e
[aposentar](../../supabase/tests/fixtures/homologacao-escritorio-aposentar.sql).

Execução pelo SQL Editor como postgres ou psql com conexão administrativa:
`psql "$SSO_HOMOLOGACAO_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/homologacao-escritorio-preparar.sql`.

O script exige o Cliente exato e a conta Gestor PCM já existente. Cria IDs fixos, títulos
`[TESTE HOMOLOGAÇÃO]` e técnico sem vínculo Auvo. A numeração de Chamado/OS continua sendo
a gerada pelo sistema; não procurar pelos números propostos no INSERT. Repetição não duplica.

Cenários: OS provisória na fila Campo a conciliar; Visita planejada em duas horas, com OS
vinculada e responsável, visível na Agenda; mesma Visita aparece como exceção não confirmada T−24.
ID externo da OS de campo é **simulado**, explicitado no título, sem tarefa criada no Auvo.

Proteções: anti-loop transacional `app.auvo_sync_write`, Visita nunca confirmada, contrato de
exemplo termina desabilitado e nenhuma abertura de gate ou concessão. O contrato é habilitado
somente dentro do mesmo bloco atômico para satisfazer a guarda de integridade; outras transações
nunca observam esse estado. Antes de concluir, o script exige zero outbox e zero tentativa T−24
para os exemplos; qualquer falha reverte todo o bloco.

A aposentadoria cancela somente a Visita não operada e faz soft-delete de OS/Chamados; conserva
processamentos e histórico append-only. Não cancela tarefa externa. Exemplo já operado exige
tratativa própria; o script recusa a aposentadoria automática.

**Estado da execução publicada:** ainda não realizada nesta sessão. Falta conexão administrativa
ou execução do SQL pelo Lucas no Dashboard; pergunta enviada no chat. URL/chave pública local não
autorizam semear esses dados. Validação local usa exatamente os mesmos arquivos SQL.

## Validação e limites

- Teste pgTAP `E00-S28_exemplos_homologacao.test.sql`: criação, replay, consultas reais dos três
  roteiros, aposentadoria e ausência de efeitos no Auvo.
- Teste pgTAP de pesquisa: tipos/códigos, cursor, contexto, outro Cliente e revogação.
- Teste pgTAP de Materiais: sete estados, recusa sem identidade e gates mediados.
- Testes UI: busca, navegação e retorno, recusa, seleção/troca de Cliente e opções de situação.
- Decisão de conversão dos contratos PMOC existentes permanece pendente; não foi inferida.
- Este recorte não habilita Chamado 1:N, respostas automáticas do Zé ou credenciais Meta.


## Evidência local — 25/11
Banco recriado do zero sob sbdb.lock: 302 arquivos / 4.012 testes PASS; depois, revisão focada
atualizada: 30 testes PASS (inclui perfil PCM leitura real e revogação do módulo com token antigo).
CI local: esteira, fidelidade, Mermaid, migrations, Edge Functions, nove gates de design,
arquitetura, gitleaks, testes, typecheck e build passaram. O lint bruto legado reprova a dívida
já baselinada; a baseline efetivamente usada na CI passa sem dívida nova.
Revisão adversarial: cursor, contexto inexistente, literal %, outro Cliente, sem identidade,
revogação e replay exercitados. Sem achado alto/médio aberto na implementação deste recorte.
Execução publicada dos exemplos continua dependente de acesso administrativo.
