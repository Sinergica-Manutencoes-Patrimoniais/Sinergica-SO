# E01-S204 — Definição única de "OS aberta" e unificação das contagens

**Origem:** ponto C do reteste (Fabrício, 27/11/2026): Dashboard 1.171 × lista de Clientes 1.605 ×
Chamados 2.705, chip Backlog 0. Caderno: DEF-40 e DEF-49 (`docs/validacao-caderno-2026-11/resultado-parcial.md`).
**Decisões do dono (27/11/2026):** D1–D8 abaixo, aceitas como recomendadas.

## Levantamento (antes)

| Tela | Fonte | Critério de "aberta" |
|---|---|---|
| Início, card PCM "OS Abertas" | `fn_kpis_ordens_servico` | OS fora de finalizado/cancelado, sem ponto; **inclui pré-chamado** |
| PCM > Clientes, carteira | navegador, `ordens_servico` | OS fora de finalizado/cancelado; **inclui ponto de visita** e pré-chamado |
| Visão 360 "OS abertas" e "Backlog" | tamanho da lista | os dois iguais à lista (OS + pré-chamado, sem ponto) |
| Chamados, "Chamados e OS abertos" | `fn_kpis_operacao` | OS + pré-chamado + Chamado sem OS (soma sem parcelas) |
| Chamados, chip "Backlog" | navegador, página carregada | `status = 'backlog'` só nas linhas carregadas (≈0) |
| Dashboard PCM "OS Abertas" | navegador | OS fora do histórico, sem ponto; inclui pré-chamado |
| Relatório Diário "OS abertas" | navegador | OS **criadas** no dia |

Causa do DEF-40 (Escritório 1 × 11): truncamento a 1.000 linhas do PostgREST na carteira, já corrigido
em E01-S163 (PR #132). Reproduzido localmente antes desta story.

## Decisões

- **D1** Pré-chamado (OS sem Chamado) não conta como OS aberta; conta à parte.
- **D2** OS em Validação PCM conta como aberta.
- **D3** Backlog = OS aberta sem data, técnico e tarefa Auvo.
- **D4** Chamados mostra "Demanda em aberto" com as três parcelas.
- **D5** Carteira exclui ponto de visita.
- **D6** Relatório Diário: "OS criadas no dia".
- **D7** Mantém o nome "Backlog", com definição no glossário.
- **D8** Só PCM interno; Portal do Cliente fica fora (achado registrado no PR).

## Critérios de aceite

- **AC-1** Uma classificação no banco (`pcm.fn_classificar_item_operacao`) define OS aberta, backlog, pré-chamado, chamado aberto e histórico. pgTAP.
- **AC-2** `pcm.fn_demanda_em_aberto`: as três parcelas somam o "abertas" de `fn_kpis_operacao` com os mesmos filtros. pgTAP.
- **AC-3** `pcm.fn_contagem_operacional_por_cliente`: carteira = Visão 360 por Cliente; soma da carteira = OS abertas do Início. pgTAP.
- **AC-4** Contagens são `security invoker`, sem `anon`; pcm:leitura vê, sem pcm vê zero. pgTAP (permitido e negado).
- **AC-5** Início, carteira, Visão 360 e Dashboard PCM mostram "OS aberta" pela definição; Visão 360 escreve o critério na tela.
- **AC-6** Chamados mostra "Demanda em aberto" e as parcelas; chip Backlog é a contagem do servidor.
- **AC-7** Relatório Diário rotula "OS criadas no dia"; "Backlog atual" segue D3.
- **AC-8** Glossário atualizado (`docs/glossary.md`, "Contagens operacionais").

## Fora de escopo

Portal do Cliente; chips "Sem técnico" e "Sync Auvo c/ erro" (seguem sobre a página carregada);
divergência KPI × total da lista causada pelo filtro de triagem de inspeção; remoção das RPCs antigas.
