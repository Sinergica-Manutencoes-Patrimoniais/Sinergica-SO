---
name: "docs-planejamento-plano-manutencao-triagem-squawk-270-integracao-md"
description: "Documento Sinérgica SO: Squawk 2.70 — triagem do recorte de integração"
alwaysApply: false
---

# Squawk 2.70 — triagem do recorte de integração

Análise estática do log `/tmp/sso-squawk-audit-782CFLI3/tmp/lint-final.log`: 884 migrations, 114 alertas em 64 arquivos; nenhuma regra suprimida e nenhum erro de parser. As convenções locais passaram; o Squawk retornou falha. A base `22aca391` termina em 0229: 19 alertas em 16 arquivos da base e 95 em 48 arquivos incorporados depois. Isso não prova quais migrations estão aplicadas no banco remoto.

## Agrupamento por tabela

Origem indica a primeira declaração `CREATE TABLE` encontrada nos arquivos do ensaio, não a existência ou o volume reais no ambiente. O vínculo de alerta à tabela é por proximidade textual na migration e precisa de revisão antes de qualquer decisão operacional; `não encontrada` inclui tabelas herdadas ou declarações não reconhecidas. Números são migrations, e categorias preservam o nome da regra.

| Tabela | Primeira criação identificada | Alertas: migration/regra |
| --- | --- | --- |
| `atendimento.canais_externos` | 0057 — base | 0060 `ban-drop-constraint` |
| `atendimento.conversas` | 0039 — base | 0044 `ban-drop-constraint` |
| `atendimento.mensagens` | 0039 — base | 0043 `ban-drop-constraint`, 0063 `ban-drop-constraint` |
| `atendimento.personas` | 0041 — base | 0054 `ban-drop-constraint` |
| `comercial.contratos` | 0190 — base | 0194 `ban-drop-constraint`, 0276 `constraint-missing-not-valid`, 0276 `disallowed-unique-constraint` |
| `comercial.propostas` | 0182 — base | 0389 `ban-drop-not-null` |
| `config.sso_usuario_perfis` | 0239 — recorte | 0242 `adding-field-with-default`, 0242 `adding-not-nullable-field` |
| `config.usuarios` | 0002 — base | 0004 `ban-drop-constraint` |
| `financeiro.lancamentos` | 0106 — base | 0117 `ban-drop-constraint` |
| `financeiro.lancamentos_eventos` | 0117 — base | 0119 `ban-drop-constraint` |
| `pcm.areas` | 0095 — base | 0282 `constraint-missing-not-valid`, 0282 `disallowed-unique-constraint` |
| `pcm.calendario_contratual_series` | 0276 — recorte | 0313 `constraint-missing-not-valid`, 0313 `disallowed-unique-constraint` |
| `pcm.capacidade_esforco_declaracoes` | 0977 — recorte | 1051 `adding-foreign-key-constraint`, 1051 `constraint-missing-not-valid`, 1051 `ban-drop-constraint` |
| `pcm.chamado_continuacoes_propostas` | 0330 — recorte | 0333 `adding-foreign-key-constraint`, 1187 `ban-drop-constraint`, 1187 `constraint-missing-not-valid` |
| `pcm.chamado_escopo_parcelas` | 0330 — recorte | 0333 `adding-foreign-key-constraint` |
| `pcm.chamados` | 0134 — base | 0151 `ban-drop-constraint`, 0333 `adding-foreign-key-constraint` |
| `pcm.funcionarios` | 0031 — base | 0082 `ban-drop-constraint` |
| `pcm.inspecao_itens` | 0019 — base | 0091 `ban-drop-constraint`, 0174 `ban-drop-constraint` |
| `pcm.inspecoes` | 0019 — base | 0185 `ban-drop-constraint` |
| `pcm.listas_materiais` | 0322 — recorte | 0328 `ban-drop-constraint`, 0328 `constraint-missing-not-valid` |
| `pcm.ocorrencias_preventivas` | 0224 — base | 0304 `constraint-missing-not-valid` |
| `pcm.ordens_servico` | 0001 — base | 0282 `constraint-missing-not-valid`, 0282 `disallowed-unique-constraint` |
| `pcm.plano_transicoes_historico` | 0416 — recorte | 0419 `ban-drop-constraint`, 0419 `constraint-missing-not-valid` |
| `pcm.plano_versoes` | 0261 — recorte | 0345 `constraint-missing-not-valid` |
| `pcm.pmoc_schedules` | 0023 — base | 0023 `ban-drop-constraint` |
| `pcm.portal_visita_publicacoes` | 0477 — recorte | 0497 `ban-drop-constraint` |
| `pcm.regras_visita_contratual` | 0276 — recorte | 0313 `constraint-missing-not-valid`, 0313 `disallowed-unique-constraint` |
| `pcm.rotinas_manutencao` | 0261 — recorte | 0262 `adding-foreign-key-constraint`, 1577 `adding-foreign-key-constraint` |
| `pcm.sso_backlog_composicoes` | 0375 — recorte | 0377 `prefer-bigint-over-smallint`, 0377 `prefer-bigint-over-smallint`, 0377 `prefer-bigint-over-smallint`, 0377 `prefer-bigint-over-smallint`, 0377 `constraint-missing-not-valid` |
| `pcm.sso_ciclos_backlog_eventos` | 1106 — recorte | 1124 `ban-drop-constraint`, 1124 `constraint-missing-not-valid` |
| `pcm.sso_conferencia_linhas` | 0462 — recorte | 0469 `ban-drop-constraint`, 0469 `constraint-missing-not-valid`, 0469 `adding-serial-primary-key-field` |
| `pcm.sso_fila_preventiva_pcm` | 1494 — recorte | 1501 `ban-drop-constraint`, 1501 `constraint-missing-not-valid` |
| `pcm.sso_foto_staging_ativo` | 0541 — recorte | 0954 `ban-drop-constraint`, 0954 `constraint-missing-not-valid` |
| `pcm.sso_ingestao_foto_reservas` | 0968 — recorte | 0984 `adding-foreign-key-constraint`, 0984 `constraint-missing-not-valid` |
| `pcm.sso_levantamento_incorporacoes` | 0352 — recorte | 0359 `ban-drop-constraint`, 0359 `constraint-missing-not-valid`, 0741 `ban-drop-constraint`, 0741 `constraint-missing-not-valid`, 0741 `disallowed-unique-constraint` |
| `pcm.sso_levantamentos` | 0315 — recorte | 0320 `ban-drop-constraint`, 0320 `constraint-missing-not-valid` |
| `pcm.sso_pendencias_decisoes` | 0371 — recorte | 0586 `ban-drop-constraint`, 0586 `constraint-missing-not-valid` |
| `pcm.sso_pendencias_tecnicas` | 0371 — recorte | 0586 `ban-drop-constraint`, 0586 `constraint-missing-not-valid`, 0906 `adding-foreign-key-constraint`, 0906 `ban-drop-not-null`, 0906 `constraint-missing-not-valid` |
| `pcm.sso_reservas_ciclo_legado` | 1714 — recorte | 1719 `ban-drop-not-null` |
| `pcm.visita_composicao_conferencia_gate` | 0622 — recorte | 0627 `adding-field-with-default` |
| `pcm.visita_confirmacoes` | 0291 — recorte | 0292 `constraint-missing-not-valid`, 0292 `disallowed-unique-constraint` |
| `pcm.visitas` | 0282 — recorte | 0313 `constraint-missing-not-valid`, 0313 `disallowed-unique-constraint` |
| `relacionamento.vinculos` | 0047 — base | 0199 `ban-drop-constraint` |

Além dos alertas acima, há 29 `renaming-object`, dois `ban-drop-function` e um `ban-drop-sequence`; são alterações de contratos de funções/triggers ou sequência, sem classificação de tabela por esta busca. Eles também exigem avaliação de consumidores, ACL e dependências; `RENAME` seguido de wrapper não demonstra compatibilidade por si só.

## Operações e encaminhamento

- `comercial.contratos` (0190 na base; alertas 0194/0276), `pcm.ordens_servico` (0001; 0282), `pcm.areas` (base; 0282) e `pcm.ocorrencias_preventivas` (0224; 0304) podem conter dados anteriores ao recorte. Unicidades, checks, FKs, defaults e remoções podem bloquear escritas, exigir varredura ou falhar por dados existentes; levantar versão, volumes, duplicidades, locks e compatibilidade antes de decidir implantação.
- Tabelas criadas no recorte, como `pcm.rotinas_manutencao`/`pcm.plano_versoes` (0261), séries e regras contratuais (0276), `pcm.sso_levantamento_incorporacoes` (0352), `pcm.sso_pendencias_tecnicas` (0371), composição (0375), fotos (0541) e fila (1494), podem já ter dados quando alteradas por migrations posteriores. Criação no mesmo conjunto não implica tabela vazia nem elimina risco de concorrência.
- `CHECK`/FK: para novas mudanças, avaliar `NOT VALID` seguido de `VALIDATE` em transação separada; unicidade não suporta esse caminho genérico e pode exigir índice único concorrente e anexação após verificar duplicidades, se compatível. `EXCLUDE`, `DROP`, renomeações e mudanças de nulidade precisam de plano próprio; não aplicar essas receitas indiscriminadamente.
- Migrations históricas não foram alteradas. Uma migration aditiva posterior não elimina bloqueios que ocorreriam na aplicação da migration anterior. Para artefatos já aplicados, preservar histórico; para pendentes, avaliar estado real, compatibilidade de versões, plano de manutenção e janela, com revisão das consequências e validação isolada. Não suprimir regras para obter PASS.

As categorias foram contadas por diagnóstico, não por operação única: uma constraint pode produzir mais de um alerta. Este inventário não é aprovação de release nem validação de dados/ACL de produção.
