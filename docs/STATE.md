---
name: STATE
description: Handoff do Plano de Manutenção para continuação em outro computador.
alwaysApply: true
---

# STATE — Memória viva do projeto

## 2026-11-05 — S165/S166: replay de escolha e projeções após aprovação

- Escolhas de nova data Calendário/Visita preservam pedido em 40001 genuíno; apenas conflito específico inicial libera reconferência. Aprovação de revisão invalida também projeções de obrigações, fila e geração após recibo confirmado, evitando dados anteriores à versão.
- Revisão estática da geração/versionamento não identificou outra falha inequívoca; `CiclosUniformes` já usa apenas mediador existente. Nenhum teste, typecheck, build ou ensaio executado por solicitação atual. Migrations 1780–1785 e UI aguardam validação em lote; sem deploy/Auvo.

## 2026-11-05 — S165/S166: fallbacks e contexto de vínculo

- Ciclos uniformes, decisão de vencimento e transição de Plano deixam de chamar fallbacks privados inacessíveis; mediadores ainda exigem suas flags e pedidos incertos são preservados. Geração contratual tem protocolos antigos distintos e não foi alterada.
- Escolha de nova Visita invalida impactos corretos; ambas escolhas invalidam estado persistido e avaliações. `VincularSerieRotina` remonta por ator/Cliente/Plano/versão/Rotina para não exibir pedido de outro contexto.
- **Nenhum teste, typecheck, build ou ensaio executado por solicitação atual.** Migrations 1780–1785 e alterações UI/cache aguardam validação conjunta, especialmente flags, compatibilidade de pedidos existentes, sessão e replay. Sem deploy/Auvo.

## 2026-11-05 — S165/S166: atualização de fuso e uso canônico

- Declaração de fuso agora invalida preflight de aprovação e conferência de séries; lote de Calendário invalida consulta de uso canônico. Objetivo: evitar dados anteriores após mutação; sem mudança de regras ou gates.
- Inspeção de RPCs privadas restantes encontrou mediadores por flags ou geração sujeita a rollout coordenado; nenhuma mediação adicional inequívoca foi criada.
- **Nenhum teste, typecheck, build ou ensaio executado por solicitação atual.** Alterações de UI e migrations 1780–1785 aguardam validação em lote. Sem deploy/Auvo.

## 2026-11-05 — S165/S166: esforço e replay de legado

- `EsforcoGrupo` usa apenas mediador existente quando flag ligada; com ela desligada informa indisponibilidade, sem chamar núcleo privado. Nenhuma flag habilitada.
- Integração legada e reabertura Grupo preservam pedido diante de 40001 genérico; reabertura libera reconferência apenas em P0012 específico inicial. Inspeção das funções 1735/1643/0718/0340 não localizou 40001 explícito de negócio no vínculo; não converter erro real genericamente. Testes foram alterados, sem execução.
- **Não executar testes, typecheck, build ou ensaios por solicitação atual.** Alterações de UI, testes e migrations 1780–1785 aguardam validação em lote. Sem deploy/Auvo.

## 2026-11-05 — S165/S166: inventário e proposta normativa mediados

- ADR-1642/migration 1784 mediam inventário agregado de geração legada chamado pela UI; ADR-1643/migration 1785 mediam proposta de exigência normativa. Núcleos/gates permanecem privados, mediadores conferem ator/Cliente e permissão sob trava. Revisão estática independente não apontou bypass concreto; UI oculta dados durante recarga/erro também nos diagnósticos 1780.
- Lote multirrotina preserva pedido em 40001 genuíno e só libera reconferência após conflito P0015 específico; teste ajustado sem execução. `DetalhePlano` descarta respostas antigas ao trocar/cancelar Rotina/versão.
- **Nenhum teste, typecheck, build ou ensaio executado por solicitação atual.** Migrations 1780–1785 e alterações UI/cache aguardam validação conjunta, compilação, ACL, replay e jornadas; gates default fechados, sem deploy/Auvo.

## 2026-11-05 — S165/S166: encerramento e caches

- ADR-1641/migration 1783 mediam proposta de encerramento que chamava núcleo privado, mantendo `execucao.validar`, Cliente/Plano, gate e replay. UI preserva pedidos incertos, confirmação vinculada aos dados e invalida escopo/diagnóstico em P0010. Revisão estática independente sem bypass concreto.
- Geração Calendário invalida obrigações/consulta/histórico inclusive após lote parcial. `DetalhePlano` descarta retorno atrasado da localização de cópia após trocar/cancelar Rotina ou versão.
- **Nenhum teste, typecheck, build ou ensaio executado por solicitação atual.** Migrations 1780–1783, cache e UI aguardam validação conjunta, inclusive compilação, ACL, replay, concorrência e jornadas. Gates default fechados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: escopo e atualização de prévias

- `PreviaVencimentosPlano` usa mediador 1533 já existente no lugar de RPC privada; depende também de `sso_obrigacoes_preparadas_mediadas_gate`. ADR-1640/migration 1782 mediam seleção/prévia/diagnóstico/declaração de escopo preservando núcleos privados e `execucao.validar`; conflito de revisão usa P0011 e UI mantém replay incerto. Revisão estática sem bypass concreto.
- Comparação legado e ciclos uniformes recarregam ao repetir janela e ocultam resultado ao alterar datas. Preparação de Visita individual/lote invalida prévias de ciclos e obrigações.
- **Nenhum teste, typecheck, build ou ensaio executado por solicitação atual.** As migrations 1780–1782 e alterações de UI/cache aguardam validação em lote, ACL, replay, sessão, gates e jornadas. Sem deploy/Auvo.

## 2026-11-05 — S165/S166: localização de cópia e cache de Visita

- ADR-1639/migration 1781 mediam localização de cópia de Rotina revisada, antes chamada por UI como RPC privada; núcleo/gates permanecem. Revisão estática independente não identificou bypass concreto.
- Prévia de Visitas refaz a consulta do mesmo período e limpa confirmação; criação de Visita invalida prévias de ocorrências e ciclos. Teste de prévia foi acrescentado, sem execução.
- **Não executar testes, typecheck, build ou ensaios por solicitação atual.** 1780–1781, caches e teste novo aguardam validação em lote, inclusive compilação, ACL, sessão, UI e geração sobre série recém-vinculada. Gates default fechados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: vigência e diagnósticos sem validação executada

- ADR-1637/migration 1779 mediam leitura/histórico/decisão de vigência de série e corrigem ambiguidade de ID; antes da orientação de suspender testes, clone compilou até 1779 e fixture/UI passaram segundo registros dos agentes. Geração sobre série recém-vinculada segue sem comprovação prática; driver foi ajustado.
- ADR-1638/migration 1780 mediam os diagnósticos de modo Visita e exigência aprovada que chamavam RPCs privadas; telas usam mediadores e conferem sessão. Revisão estática independente sem bypass concreto. VigenciaSerieRotina invalida prévias de Visita/ciclos após alteração ou conflito para evitar cache obsoleto.
- Conforme solicitação atual, **não executar testes, typecheck, build ou ensaios**; 1780 e invalidação de cache ainda não foram validadas. Antes de homologar, executar lote de validação adequado, incluindo compilação 1780, ACL/Cliente, UI/replay e jornada da série recém-vinculada. Gates default fechados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: vínculos de série por Visita

- Jornada na navegação normal por Visita identificou ACL privada em listagem de série. ADR-1635/migration 1777 criam consulta mediada autenticada e UI a consome sem expor núcleo privado. Fixture SQL cobriu positivo/ator/Cliente/ACL; ainda falta concorrência de consulta.
- ADR-1636/migration 1778 criam comando mediado de vínculo, preservando núcleo privado, autorização/gates/replay; conflito de revisão usa P0011 e UI preserva tentativa incerta. Clone limpo compilou 1614–1778 e fixture passou para positivo/replay/P0011/ator/Cliente/ACL; UI 3/3 e revisão independente passaram. HTTP específico do conflito não testado.
- Navegação normal em clone percorreu aprovação 1045 real → retirada → preparação da nova Visita; OS sintética independente preservada, sem nova OS/outbox. Relógio simulado e escolha/vínculo/PMOC eram fixture; não prova criação do vínculo pela UI nem homologação. Gates default fechados; sem Auvo/deploy.

## 2026-11-05 — S165/S166: jornada pela aplicação normal

- `apps/web/e2e/s166-isolado/executar-app-revisao.py` passou em aplicação real, clone e rede interna: login → PCM/Cliente/Preventivas → edição de alvo/recorrência/tolerâncias → submissão → impacto Visita/PMOC/fuso → aprovação 1045 real → origem e geração Calendário. Banco confirmou nova versão/ocorrência, tolerâncias 2/5, OS/fotografia históricas intactas e nenhuma OS/outbox adicional. Fixture/vínculo/Chamado sintéticos e gates ligados apenas no clone; não equivale a homologação.
- Inventário de flags/gates por cenário foi ampliado em `docs/planejamento/plano-manutencao/inventario-flags-s165-s166.md`; não habilita configurações nem comprova fontes externas.
- Compatibilidade de transição 1776: UI antiga com banco novo preserva pedido mas não recupera automaticamente; UI nova/banco antigo pode repetir 40001. Sequência indicada: banco primeiro e interface depois, gate fechado durante intervalo, sem deploy realizado. Roteiro `supabase/tests/manual_E01-S165_rollout_transicao_1776.md`.
- Próximo passo: CI, fontes externas e ensaio de rollout antes de homologação; gates default fechados, sem Auvo real.

## 2026-11-05 — S165/S166: transição e navegação normal

- ADR-1634/migration 1776 tratam `revisao_obsoleta` na suspensão/encerramento/retomada com P0011; UI preserva replay incerto/40001 real. HTTP suspensão em clone passou de timeout >7s para resposta P0011; fixture SQL, UI 3/3, typecheck e revisão independente passaram. Rollout coordenado UI/backend.
- `apps/web/e2e/s166-isolado/executar-app-normal.py` percorreu aplicação real isolada de login até Cliente → Preventivas → Planos → Rotinas, com dados/flags sintéticos. Ainda não prova aprovação/geração pela navegação completa ou fontes externas.
- Inventário `docs/planejamento/plano-manutencao/inventario-flags-s165-s166.md` registra 125 flags encontradas e gates comprovados das jornadas centrais; oito flags centrais adicionadas ao `.env.example` como false. Mapeamento completo e habilitação por jornada permanecem pendentes. Sem deploy/Auvo.

## 2026-11-05 — S165/S166: lote 1775 e alteração de dia

- UI de alteração de dia preserva pedido perante 40001 real; apenas P0018 específico inicial libera reconferência. Teste focado 4/4 passou. Três arquivos de testes foram formatados sem mudança funcional e passaram Biome.
- Clone compilou 1614–1775 em ordem e passou 24 fixtures SQL; 8 arquivos UI/33 testes passaram após atualizar mock antigo para P0019. Outro lote direcionado passou 37 testes e typecheck. Registro `supabase/tests/manual_E01-S165_S166_lote_isolado_1775.md`; não equivale à CI completa ou ACL global.
- `lint:migrations` permanece exit 1 com 474 avisos Squawk em 42 migrations históricas; 1775 não foi apontada. Gates default fechados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: classificação legada e lote consolidado

- ADR-1633/migration 1775 tratam conflito definitivo de classificação de legado com P0019; UI preserva pedido incerto e erro real. Clone compilou 1614–1775, fixture SQL testou conflito/positivo/replay e HTTP isolado devolveu P0019 e recibo de replay anterior; UI 2/2, revisão independente sem bypass concreto. Rollout frontend/backend coordenado.
- Clone limpo compilou 1614–1774 em ordem e passou 23 fixtures SQL; typecheck web passou. Aprovação real 1731 em clone recusou avaliação tardia e passou após remover fontes sintéticas, com replay idêntico. Isso não prova fontes externas, ACL global, CI remoto ou aprovação com avaliação persistente.
- Próximo passo: CI e revisão integral para homologação; gates default fechados. Sem deploy/Auvo.

## 2026-11-05 — S165/S166: feedback de permissão e auditoria de bordas

- UI de Rotina informa autorização em alteração ou indisponível sem apagar pedido de replay; seis testes focados passaram. Backend/gates não alterados.
- Revisão estática das bordas examinadas de decisão de impacto, PMOC, transições e fila constatou trava antes da autorização; não foi identificado defeito concreto nesse recorte. Não cobre todos os comandos nem constitui prova concorrente integral.
- Uma revisão automática bloqueou duas tentativas da frente paralela de teste concorrente por possível risco de segurança. Outra frente realizou revisão estática, mas não repetiu ensaios concorrentes sem hipótese concreta. Gates default fechados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: revogação na revisão e leitura de fila

- ADR-1631/migration 1773 serializam revogação com início e submissão/devolução de revisão antes de autorização/replay; corrida reproduzida e corrigida nas duas ordens, replay e negação após revogação passaram. Roteiros `supabase/tests/manual_E01-S165_autorizacao_revisao_concorrencia_1773.md` e `...transicoes_revisao_concorrencia_1773.md`.
- ADR-1632/migration 1774 serializam revogação nas leituras legadas de fila Calendário/Visita; concorrência nas duas ordens, Cliente indevido e isolamento incorreto passaram. Roteiro `supabase/tests/manual_E01-S166_autorizacao_leituras_fila_1774.md`. Revisões independentes sem bypass concreto.
- Clone limpo compilou 1614–1774 em ordem numérica; fixtures de edição/aprovação, retomada/fila e Visita passaram em rollback. UI preserva pedidos incertos em classificação de legado/decisão de impacto; 19 testes focados passaram. Gates default fechados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: revogação em Rotinas e fila Grupo

- ADR-1629/migration 1771 serializam revogação com inclusão, edição e retirada de Rotina antes de autorização/replay, exigindo READ COMMITTED. Corrida de edição foi reproduzida antes e bloqueada nas duas ordens depois; caminhos positivos/replays dos três comandos passaram em clone, com revisão independente.
- ADR-1630/migration 1772 movem trava antes da autorização/replay da fila Grupo. Corrida de replay contra revogação foi reproduzida e corrigida nas duas ordens; clone limpo compilou até 1772 e fixtures passaram. Roteiros `supabase/tests/manual_E01-S165_autorizacao_rotina_concorrencia_1771.md` e `supabase/tests/manual_E01-S166_autorizacao_fila_grupo_1772.md`.
- Aprovação UI preserva tentativa para 40001 genuíno e só trata P0011/revisão obsoleta como rejeição definitiva inicial; três testes passaram. Próximo passo: revisão das demais bordas de autorização e CI/homologação. Gates default fechados, sem deploy/Auvo.

## 2026-11-05 — S165/S166: revogação durante geração

- Auditoria reproduziu criação de ciclo após revogação concorrente de `plano.gerir` quando gate de origem estava desligado. ADR-1628/migration 1770 serializam autorização em fronteiras de geração Calendário/Visita e exigem READ COMMITTED antes de autorização/replay.
- Clone compilou 1770; revogação × lotes dos dois modos recusou concorrência nas duas ordens, replay igual, Cliente sem concessão negado. Criação nova de Calendário também foi testada nas duas ordens após correção. Roteiro `supabase/tests/manual_E01-S166_autorizacao_geracao_concorrencia_1770.md`; sem Auvo/deploy.
- UI da fila explica que entrada cancelada não pode ser reincluída pela tela; 8 testes focados passaram. Próximo passo: revisão final/CI; gates default fechados.

## 2026-11-05 — S165/S166: replay de migrations e lock 0304

- PostgreSQL novo descartável aplicou migrations 0001–1769 em transações e passou 17 pgTAP S165/S166 após atualizar quatro expectativas antigas de SQLSTATE em três arquivos de teste. Bootstrap manual parcial de auth e Storage 0001–0046; um teste usou loopback TCP, sem rede externa. Não equivale a `supabase start && supabase test db`, ACL global ou CI completa. Recursos removidos.
- Ensaio 0304 com 200 mil linhas sintéticas/56 MB confirmou contenção entre leitura e ALTER nas duas ordens; sem concorrência migration levou 41 ms no ambiente local, número não extrapolável para produção. Sem FKs/triggers/dados reais. Roteiro `supabase/tests/manual_E01-S166_ensaio_lock_0304.md`.
- Próximo passo: CI completa e ensaio de rollout com volume representativo antes da homologação; gates fechados, sem deploy/Auvo. Disco livre ~9 GiB.

## 2026-11-05 — S165/S166: riscos de rollout e cancelamento UI

- `apps/web/e2e/s166-isolado/executar-fila-cancelamento.py` passou em navegador/HTTP/clone isolados: UI cancelou Visita, leitura/banco confirmaram `cancelado`, botão de inclusão desabilitado. Preparação e permissões sintéticas; SQL anterior já recusou reinclusão por RPC. Sem navegação integral nem Auvo.
- Os 11 alertas Squawk reais foram detalhados em `supabase/tests/manual_E01-S165_S166_auditoria_squawk_1769.md`: principal risco 0304 valida constraint em `ocorrencias_preventivas`, tabela preexistente; outras FKs/constraints podem bloquear em rollout parcial e 1719 requer compatibilidade com NULL. Migration posterior não evita locks anteriores; ensaio com volume representativo e janela de aplicação são necessários antes de rollout.
- Auditoria de aprovação não identificou defeito novo nas fontes SSO auditadas; não comprova fontes externas/CI. Gates default fechados, sem deploy/Auvo. Próximo passo: testes de banco/CI e ensaio de rollout seguro para homologação.

## 2026-11-05 — S165/S166: auditoria de gates e cancelamento

- AC6 Visita em clone até 1769: preparo/inclusão/replay/cancelamento reais, reinclusão e Chamado após cancelamento recusados, fonte alterada sinalizada, sem OS; setup/permissões sintéticos. Sem prova UI desta jornada.
- `audit:esteira`: link histórico quebrado corrigido; permanecem 1.599 documentos sem frontmatter, incluindo 1.541 ADRs. Não reescrever ADRs históricos nem enfraquecer gate; baseline diferencial foi avaliada mas não implementada.
- Squawk: 474 alertas em 42 migrations já capturadas no backup; 415 S165/S166, dos quais 404 são cascata do parser em 0276/0345 que compilaram no PostgreSQL. Outros 11 exigem avaliação de locks/compatibilidade antes de aplicação real. Detalhes `supabase/tests/manual_E01-S165_S166_auditoria_squawk_1769.md`. Nenhuma conclusão sobre produção.
- Próximo passo: tratar gates/rollout e completar revisão para homologação; gates default fechados, sem deploy/Auvo.

## 2026-11-05 — S165/S166: escopo e lote consolidado

- ADR-1627/migration 1769 tratam revisão obsoleta na inclusão/retirada de Rotina com P0011; UI de retirada conserva pedidos incertos e erro real 40001. Clone testou operações e replay; UI 3/3, typecheck e revisão independente passaram. Gates permanecem fechados.
- Lote SQL isolado com migrations 1614–1769 passou 21/21 fixtures, todas revertidas; registro `supabase/tests/manual_E01-S165_S166_lote_isolado_1769.md`. Não comprova ACL global, CI remoto ou fontes externas. Sem deploy/Auvo.
- Próximo passo: concluir revisão/CI do workspace e validar fontes para homologação.

## 2026-11-05 — S165/S166: arquitetura e verificação de CI

- Quatro violações XLSX foram corrigidas movendo serialização à infraestrutura e injetando extratores nos serviços; `arch:check`, typecheck web e 38 testes focados passaram. Revisão detectou chamadores Deno sem dependência e import sem extensão; corrigidos, `deno check` dos dois caminhos e smoke direto/worker com 59 linhas passaram. Prévia de cronograma ainda faz XML/matriz na thread principal, fora do timeout de extração; risco de desempenho permanece.
- `check:edge-functions` permanece falhando por 28 funções não declaradas: adicioná-las ao config pode incluí-las no deploy, incluindo função com rollout explicitamente pendente. Config e check preservados, sem deploy; outros bloqueios da esteira e Squawk continuam registrados abaixo.
- AC7 S166: tolerância configurada e ancoragem foram comprovadas; avaliação atual recebe data informada. Spec não exige explicitamente cálculo automático a partir da execução; não foi inventada regra. Gates default fechados, sem Auvo real.
- Próximo passo: resolver gates CI com escopo e segurança apropriados e completar revisão de fontes antes de homologação.

## 2026-11-05 — S165/S166: tolerância e gates locais

- Jornada UI/backend isolada configurou tolerância antes=2/depois=5, aprovou e gerou ocorrência com os valores preservados e vencimento ancorado; OS histórica intacta. Teste domínio 10/10 cobriu limites e próximo ciclo. Avaliação atual de prazo é informativa e usa data fornecida na tela; integração automática com execução não comprovada.
- Gates locais: Spec Kit, Mermaid e typecheck web passaram. `audit:esteira` falhou com 1.597 achados, Squawk com 474 alertas em 42 migrations, arquitetura com 4 violações XLSX e verificação de Edge Functions por funções não declaradas; são resultados do workspace amplo, não prova de regressão desta story. CI completa e db-tests desde zero não executados. Registro `supabase/tests/manual_E01-S165_S166_verificacao_ci_local.md`.
- Biome focal de quatro arquivos S165/S166 foi corrigido; verificação focal passou e 15 testes passaram. Próximo passo: avaliar gates amplos, cobertura das fontes e homologação; gates default fechados, sem deploy/Auvo.

## 2026-11-05 — S165/S166: edição até geração pela UI

- ADR-1626/migration 1768 tratam revisão obsoleta da edição de Rotina com P0011; formulário preserva tentativa incerta/40001 real. Clone compilou, fixture de edição/aprovação e revisão independente passaram; rollout UI/backend coordenado.
- `apps/web/e2e/s166-isolado/executar-edicao-rotina.py` passou em rede interna: componentes reais editaram alvo/recorrência, submeteram, reconferiram impacto Visita/PMOC/fuso, aprovaram com 1045 real e geraram nova Rotina. OS/fotografia históricas sintéticas inalteradas; nenhuma OS/outbox adicional. Cliente/Chamado/vínculo sintéticos, parte setup com replica no clone; não comprova navegação integral nem fontes externas.
- Lote isolado: 18 fixtures SQL e 70 testes UI passaram após atualizar duas expectativas antigas de SQLSTATE; registro `supabase/tests/manual_E01-S165_S166_lote_isolado_1767.md`. Não equivale ao CI completo ou db-tests global.
- Próximo passo: revisão integral, CI e validação de fontes antes de homologação. Gates default fechados; sem deploy/Auvo real.

## 2026-11-05 — S165/S166: edição real e concorrência PMOC

- `supabase/tests/manual_E01-S165_edicao_rpc_aprovacao_os_1770.sql`: RPC real editou alvo/intervalo, replay passou, submissão e aprovação 1731 com 1045 real preservaram OS/ocorrência históricas e congelaram novo snapshot. Ponte, OS e datas sintéticas, rollback; UI de edição não foi exercida.
- Em clone até 1767, vínculo PMOC real anterior bloqueou geração Plano; geração aberta primeiro conteve vínculo, e após commit uma troca sintética de origem levou a recusa de vínculo por ocorrência exigindo reconciliação. Proposta/decisão e troca de origem sintéticas; não prova todos fluxos concorrentes. Replay positivo do vínculo 1766 devolveu recibo idêntico.
- AC5 PMOC: equipamento, manutenção e laudo microbiológico sintéticos permaneceram idênticos após vínculo e recusa da geração alternativa; sem OS/outbox. Clone descartado, sem deploy/Auvo real.
- Próximo passo: validar edição pela UI e revisão adversarial/CI antes de homologação. Gates default fechados.

## 2026-11-05 — S165/S166: AC5 e AC7 integrados

- S165 AC5: clone com 1045 real aprovou revisão com mudança simultânea de alvo/recorrência e OS aberta conhecida; decisão PCM preservou OS e ocorrência antigas, snapshot novo congelou alvo/intervalo. OS posterior à comparação bloqueou aprovação; alvo incompatível recusou substituição. Ponte/OS/draft sintéticos, rollback. Fixtures `supabase/tests/manual_E01-S165_ac5_*_1768.sql`.
- S165 AC7: suspensão/retomada/encerramento preservaram OS sintética vinculada por ponte criada via RPC; geração futura bloqueada e retomada não gerou automaticamente. ADR-0190 limita vigência ao dia local; agendamento futuro não está especificado. Fixtures `supabase/tests/manual_E01-S165_ac7_*.sql`.
- S166 AC5: rotina diária gerou hoje até hoje+30 inclusivos, excluiu +31 e replay preservou 31 ocorrências. Vínculo PMOC positivo via comandos reais recusou geração alternativa; agenda, contrato/imóvel e ausência OS/outbox preservados. Origem PMOC sintética, concorrência vínculo/geração e laudos não comprovados; testes domínio 29/29. Sem deploy/Auvo.
- Próximo passo: comprovar concorrência PMOC e preservação de laudos, revisão integral e CI. Gates default fechados.

## 2026-11-05 — S165/S166: conflitos de regras e PMOC; replay

- ADRs 1622–1624/migrations 1764–1766 convertem conflitos explícitos de regras/feriados, proposta/decisão PMOC e vínculo de ciclo PMOC; UI preserva replay incerto e erros genuínos. Revisões cruzadas não encontraram bypass. HTTP de criação de regra passou; SQL cobriu PMOC e vínculo; UI feriado 2/2, proposta 4/4 e vínculo 2/2. Replay positivo SQL do vínculo 1766 ainda sem fixture completa; HTTP dos demais modos não comprovado.
- ADR-1625/migration 1767 corrige replay de decisão PMOC para retornar `deduplicacaoAtiva:false` igual ao recibo original. Fixture de igualdade integral passou e revisão confirmou autorização/ACL; typecheck passou.
- Clone compilou até 1767. Próximo passo: demais conflitos ativos, revisão integral e CI antes de homologação; gates default fechados, sem deploy/Auvo.

## 2026-11-05 — S165/S166: conflitos de calendário, PMOC e legado

- ADRs 1619–1621/migrations 1761–1763 tratam conflitos explícitos de regras/feriados, avaliação e classificação PMOC, relação e lote legado. UI reconhece rejeição específica somente no primeiro envio, preservando replay incerto e 40001 real; ACL/assinaturas mantidas e revisões independentes sem bypass concreto.
- Clone compilou até 1763; HTTP autenticado cobriu prévia de regra. Fixtures SQL cobriram conflitos PMOC/ciclo e relação/lote legado. UI mudança de dia 4/4, PMOC 4/4 e relação 2/2; typecheck passou. Feriado e legado ainda sem HTTP específico; operações históricas de regras e outros conflitos não foram todas auditadas.
- Próximo passo: demais caminhos ativos, revisão integral e CI antes de homologação. Gates default fechados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: conflitos de origem e reconciliação

- ADRs 1616–1618/migrations 1758–1760 convertem conflitos explícitos de revisão da origem da Rotina, diagnósticos/pré-condição de impacto e fotografia de reconciliação para P0010/P0011/P0017; UI mantém pedidos incertos e erros reais 40001. Revisões cruzadas preservaram ACL, assinaturas e ordem de replay; rollout frontend/backend coordenado.
- Clone compilou até 1760. HTTP autenticado validou origem obsoleta e replay após mudança; fixtures SQL de diagnóstico e reconciliação passaram. UI origem 2/2, diagnósticos 5/5 e reconciliação 8/8, incluindo replay e 40001 real. HTTP específico 1759/1760 não executado. Sem deploy/Auvo.
- Próximo passo: demais 40001 em feriados, regras, legal, escopo e preparação legada, sem converter serializações reais; depois revisão integral e CI. Gates default fechados.

## 2026-11-05 — S165/S166: conflitos de preparação e retirada

- ADRs 1613–1615/migrations 1755–1757 convertem conflitos explícitos na preparação individual/lote Visita, resolução de retirada e ciclo canônico Calendário em P0011/P0012/P0016. Interfaces distinguem primeira rejeição de replay incerto; erros reais de serialização e ACL permanecem. Revisões independentes sem bypass concreto.
- Clone compilou até 1757. HTTP autenticado testou os dois comandos de Visita; fixtures SQL cobriram resolução e ciclo, com replay; testes UI Visita 5/5, retirada 4/4 e ciclo 3/3. HTTP específico 1756/1757 ainda não foi testado. Sem deploy/Auvo.
- Próximo passo: auditar conflitos restantes e completar revisão integral/CI antes de homologação; gates default fechados.

## 2026-11-05 — S165/S166: conflitos de lote e fila

- ADRs 1610–1612/migrations 1752–1754 tratam conflitos de negócio em prévia e lote de Calendário, comparação/retirada de impacto, confirmação da fila Calendário e exceção Visita, com P0011/P0012/P0015. Erros reais e replay incerto preservados; frontend/backend exigem rollout coordenado. Revisões cruzadas não encontraram bypass concreto.
- Clone compilou até 1754; HTTP isolado validou prévia e escrita de lote com revisão obsoleta, UI multirrotina 6/6. SQL de comparação e fixtures de fila/exceção passaram; UI retirada 4/4 e fila/exceção 12/12. `fila_alterada` ainda sem ensaio de corrida; conflitos específicos 1754 sem prova HTTP. Sem deploy/Auvo.
- Próximo passo: auditar outros 40001 relevantes sem alterar falhas reais, concluir revisão integral e CI antes da homologação. Gates default fechados.

## 2026-11-05 — S165/S166: conflitos de reserva, PMOC e fila

- ADRs 1606–1609/migrations 1748–1751 convertem conflitos explícitos de negócio em reservas, inventário PMOC, fila de Grupo e escolhas de nova data para P0011/P0012/P0013/P0014, preservando erros reais de serialização e replay incerto. UI só libera nova conferência após primeira rejeição definitiva com código/mensagem esperados. Revisões cruzadas não encontraram bypass concreto; frontend/backend devem ser coordenados no rollout.
- Clone compilou até 1751. HTTP/UI em rede interna cobriram reserva Calendário, escolha de nova Visita e reabertura de Grupo (esta de >6s para 5ms); fixtures SQL cobriram PMOC/fila/replay. Testes focados: reservas 8/8, PMOC 2/2, Grupo 6/6 e escolha 8/8; typecheck passou. HTTP dos demais modos ainda pendente.
- Próximo passo: auditar outros conflitos 40001 relevantes, revisão integral e CI antes de homologação. Gates default desligados; sem deploy/Auvo real.

## 2026-11-05 — S165/S166: conflitos HTTP de aprovação e fila

- ADR-1604/migration 1746 convertem apenas revisão obsoleta do núcleo de aprovação para P0011; UI distingue primeira rejeição de replay incerto. HTTP real em clone passou de timeout >7s para resposta P0011; typecheck passou. Harness `apps/web/e2e/s166-isolado/executar-aprovacao-obsoleta.py`.
- ADR-1605/migration 1747 tratam conflito de revisão da fila Visita com P0012; HTTP em clone respondeu em 5ms após timeout anterior >6s. Fixture de replay e testes UI 5/5 passaram, preservando tentativa incerta. Outros 40001 não foram alterados.
- UI/backend Visita validaram conflitos de revisão 1744 e prévia 1745 em clone; gates somente sintéticos. Próximo passo: auditar outros conflitos de negócio e revisão integral/CI antes de homologação. Sem deploy/Auvo real.

## 2026-11-05 — S165/S166: revisão obsoleta e aprovação com avaliação

- Aprovação mediada 1731 em clone, com 1045 intacta e 1742, recusou avaliação tardia (`comparacao_avaliacao_obsoleta`); após remover fontes sintéticas aprovou e repetiu. Ponte/relação/avaliação sintéticas; fixture `supabase/tests/manual_E01-S165_aprovacao_real_avaliacao_tardia_1742.sql`.
- ADR-1602/migration 1744 tratam `revisao_obsoleta` na decisão e nas duas listas com P0011. Ensaio UI/HTTP Calendário passou de 4.351 execuções em ~2s para uma; reconsulta terminou. UI 16/16 cobre primeira tentativa e replay de ambos modos; HTTP Visita pendente. Consumidores externos devem aceitar P0011.
- ADR-1603/migration 1745 tratam comparação obsoleta das duas prévias com P0010. HTTP Calendário passou de timeout >6s para resposta em 11–12ms; Visita passou em fixture SQL. Outros 40001 de negócio permanecem para auditoria. Gates default fechados, sem deploy/Auvo.
- Próximo passo: cobrir conflitos restantes e Visita HTTP, revisão adversarial integral e CI antes de homologação.

## 2026-11-05 — S165/S166: conflito HTTP e avaliação na aprovação

- ADR-1600/migration 1742 revalidam avaliação legada recebida após decisão no trigger de aprovação. Fixture isolada e concorrência do helper nas duas ordens passaram; ainda não provam jornada completa 1731 com essa avaliação.
- Causa do HTTP pendente foi comprovada em clone: PostgREST repetiu RPC que retornava 40001, 838 execuções em ~2 s. ADR-1601/migration 1743 usam P0010 para `comparacao_obsoleta`; UI Calendário/Visita trata conflito definitivo somente na primeira tentativa e mantém replay incerto. Navegador isolado + backend passaram em Calendário: um POST/uma execução, reconferência e alerta; teste UI 12/12 cobriu ambos modos e replay. Outros 40001 ainda exigem auditoria própria. Rollout coordenado backend/UI.
- Próximo passo: auditar conflitos 40001 expostos ao PostgREST, provar aprovação integral com avaliação tardia e CI. Gates default desligados; sem deploy/Auvo real.

## 2026-11-05 — S165/S166: avaliação tardia e HTTP pendente

- ADR-1599/migration 1741 impedem geração substituta quando avaliação chegou à ponte antiga após retirada. Clone validou Calendário e Visita; Visita cobriu duas ordens de concorrência com aprovação 1731 real, ponte e relógio sintéticos. Gates default fechados; sem Auvo/deploy.
- UI 1739: proxy recebeu um POST completo mas PostgREST não respondeu em 45 s; listagem/comparação deram 200. Chamada SQL equivalente em clone separado rejeitou foto obsoleta em 2,7 ms. Amostras de sessão não identificaram causa; não afirmar PASS ou defeito do produto. Recursos descartáveis removidos.
- Próximo passo: identificar causa na camada PostgREST/proxy com teste reproduzível sem dados reais; continuar revisão de fontes e CI antes de homologação.

## 2026-11-05 — S165/S166: vínculo Visita e comparação pela UI

- ADR-1598/migration 1740 impedem novo vínculo de Visita com legado já avaliado, serializam avaliação e preservam replay. Clone testou negativa, vínculo positivo e concorrência nas duas ordens; sem Auvo.
- A comparação 1739 carregou pela UI isolada com backend real, mas teste de decisão após avaliação não concluiu: submit persistiu tentativa e enviou HTTP, sem resposta em 12 s; uma decisão preexistia na fixture e não se provou nova escrita. Sessão PostgreSQL ativa não tinha bloqueadores visíveis; causa indeterminada. Harness registra diagnóstico sem dados sensíveis; não atribuir PASS ou falha ao produto sem investigação adicional.
- Clone 1739 comprovou CAS obsoleto e concorrência na comparação de Calendário; frontend precisa preceder migration em rollout por schema estrito. 1740 e fixtures preservados, gates default fechados; sem deploy/Auvo. Próximo passo: investigar latência HTTP/RPC em clone e validar jornada UI/backend antes de CI/homologação.

## 2026-11-05 — S165/S166: avaliação na comparação e prévia real

- ADR-1597/migration 1739 incluem avaliação legada vinculada na comparação CAS de impactos e UI, preservando fotografia histórica sem avaliação. Clone testou calendário e concorrência nas duas ordens; CAS recusou foto antiga. Frontend deve ser atualizado antes da migration porque schema anterior é estrito. Typecheck passou.
- `apps/web/e2e/s166-isolado/executar-avaliacao.py` passou para prévia Calendário com avaliação em navegador isolado e backend até 1738: alerta visível e reserva bloqueada; fixture sintética, não cobre aprovação com avaliação ou 1739 pela UI. Primeira falha de createdb não teve causa recuperável; falhas seguintes do harness foram diagnosticadas e corrigidas, sem repetir cegamente. Recursos descartáveis removidos.
- Aprovação 1731 e gerador legado de Visita concorreram em clone; geração anterior bloqueou aprovação por impacto pendente. Ordem inversa do preparador canônico não foi exercida pois recusou rascunho ativo. Roteiros `supabase/tests/manual_E01-S165_aprovacao_indice_legado_concorrencia.md` e `supabase/tests/manual_E01-S165_comparacao_avaliacao_legada_concorrencia_1739.md`.
- Próximo passo: validar 1739 em UI/backend, demais modos/fontes e revisão integral/CI. Gates default desligados; sem deploy/Auvo.

## 2026-11-05 — S165/S166: avaliação na fila de Visita

- Revisão reproduziu fila de Visita tratando legada com avaliação como candidata inerte. ADR-1596/migration 1738 tornam estado indeterminado sob trava e preservam fila para conferência; leitura 1650 usa mesma função. Clone testou com/sem avaliação, replay e concorrência nas duas ordens. Fixtures `supabase/tests/manual_E01-S165_avaliacao_fila_visita_1738.sql` e roteiro concorrente correspondente.
- Aprovação real 1731 concorreu com gerador legado em clone: contenção em ambas ordens; geração anterior fez aprovação recusar impacto pendente. Gate ativado somente no clone, 1045 efetiva. Não comprova todas as fontes.
- Browser isolado repetiu aprovação/retirada/geração Visita com migrations até 1737; teste UI simulado 5/5 cobriu aviso de avaliação e bloqueio da escolha. Prévia com avaliação ainda não foi exercitada com backend real pela UI. Sem deploy/Auvo; gates default fechados.
- Próximo passo: executar jornada integrada após 1738 e revisão adversarial/CI antes de homologação.

## 2026-11-05 — S165/S166: avaliações legadas na revisão

- Revisão adversarial reproduziu avaliador que tratava legado com avaliação como inerte. ADR-1594/migration 1736 mantêm pendência e serializam chegada da avaliação; Calendário e Visita passaram em clone, concorrência Visita nas duas ordens passou (`supabase/tests/manual_E01-S165_avaliador_impacto_concorrencia_1736.md`).
- ADR-1595/migration 1737 mostram avaliação como efeito conhecido nas prévias de Calendário e Visita, sem alterar formato da fotografia; texto UI esclarece necessidade de conciliação. Clone limpo compilou 1614–1737 e fixtures dos dois modos passaram; typecheck web passou. Gates permanecem fechados.
- Lote anterior passou 46 testes TS, 46 assertivas SQL e 9 jornadas SQL em clone sem rede; restauração sem cron/net não prova ACL global ou CI completo. Concorrência de geração em duas sessões passou antes e após versão/selo sintéticos, mas não comprova disputa com aprovação real nem PMOC externo.
- Próximo passo: continuar revisão adversarial, provas de concorrência e CI seguro antes de homologação. Sem deploy/Auvo.

## 2026-11-05 — S165/S166: vínculo e feriado pela borda real

- `apps/web/e2e/s166-isolado/executar-legado.py` passou em rede interna: UI real selecionou e vinculou legada existente pela 1735 e incluiu a preparada em `aguardando`; banco confirmou ponte única e nenhuma OS. Relação/ocorrência são fixtures sintéticas; não cobre navegação integral nem Auvo.
- AC-1: `supabase/tests/manual_E01-S166_geracao_ou_supressao_integrada.sql` passou 15/15 em clone pela RPC pública 1271, incluindo gate, supressão/auditoria, repetição, capacidade e ocorrência zero, revogação e ausência de OS/outbox. Indicadores agregados específicos não foram localizados.
- Revisão adicional da 1735 não reproduziu bypass por alias duplicado: constraint de identidade impediu montagem. Travas globais ainda podem afetar latência de outros Clientes; carga não medida. Nenhuma migration nova.
- Próximo passo: revisão adversarial integral das stories e CI, observando limites de fontes e UI; flags/gates default desligados, homologação pendente. Sem deploy/Auvo real.

## 2026-11-05 — S165/S166: vínculo legado e fila após avaliação

- ADR-1593/migration 1735 expõem vínculo mediado de ocorrência legada existente, selecionada explicitamente pelo PCM, sem gerar OS/Auvo. Jornada AC-6 em clone: suspensão/retomada, decisão, preparação vencida, relação declarada, vínculo e fila `aguardando`. Interface de seleção usa flag desligada; testes focados 2/2 e typecheck passaram, ainda sem browser integrado dessa ação.
- Avaliação recebida bloqueia nova integração e novo Chamado; fila projeta `verificacao` quando avaliação chega após inclusão, mantendo estado histórico e cancelamento. Consulta v2 permite à UI distinguir essa situação e evitar confirmação inválida. Jornada SQL e testes UI 4/4 passaram; concorrência nas duas ordens passou em clone limpo 1614–1735. Roteiro `supabase/tests/manual_E01-S166_avaliacao_fila_concorrencia_1735.md`. Performance das travas não medida.
- Jornada isolada S165/S166 agora usa painel real para seleção do Plano e retirada pela UI, antes de preparar Visita também pela UI; relógio e dados sintéticos, 1045 efetiva, sem Auvo. Ainda não é navegação integral do produto.
- Próximo passo: validação em navegador do vínculo 1735, revisão adversarial completa e CI; flags/gates default desligados e homologação pendente. Sem deploy ou envio real.

## 2026-11-05 — S165/S166: exceção em navegador e vencidos

- `apps/web/e2e/s166-isolado/executar-excecao.py` aprovou exceção e mudou dia pela UI real em rede interna, preservando Visitas excepcionada, confirmada, extra, reprogramada e OS sintética; elegível mudou para terça. Dados sintéticos, sem Auvo, recursos removidos.
- ADR-1592/migration 1734 serializam consulta de exceção com revogação de permissão, exigindo READ COMMITTED; clone testou duas ordens e revisão independente não encontrou bypass estático. Gate e flag seguem desligados.
- AC-2 em clone: feriado em 01/01, decisão PCM, retorno sintético em 08/01 e finalização preservaram vencimento 01/01 e próximo ciclo 01/02. AC-6: suspensão/retomada não gerou automaticamente; decisão e preparação individuais entraram na fila em `verificacao`, não prova caso elegível `aguardando`. Fixtures `supabase/tests/manual_E01-S166_feriado_execucao_tardia_integrada.sql` e `supabase/tests/manual_E01-S166_retomada_fila_integrada.sql`.
- Próximo passo: comprovar fila elegível e indicadores aplicáveis, fontes restantes e revisão adversarial completa/CI antes de homologação; sem deploy ou Auvo real.

## 2026-11-05 — S165/S166: jornada isolada, exceção e reconciliação

- `apps/web/e2e/s166-isolado/executar-jornada.py` executou recorte reproduzível em rede interna: login sintético, aprovação S165 por componente real com 1045 efetiva e geração Visita S166 por componente real. Banco confirmou aprovação e duas ocorrências históricas. Relógio avançado no clone e retirada anterior por RPC; não cobre navegação integral do produto nem Auvo. Cleanup executado; imagem Playwright foi mantida.
- ADR-1590/migration 1732 registram exceção aprovada vinculada a Visita com permissões existentes, auditoria e gate desligado. Prévia e alteração contratual preservam Visita; UI usa data/revisão do servidor sob flag desligada. Clone compilou até 1733, fixture, negativas e concorrência nas duas ordens passaram; UI 4/4 e typecheck passaram. Exceções sem Visita não foram modeladas.
- ADR-1591/migration 1733 e UI distinguem fotografia histórica alterada de integração operacional ainda válida após Chamado SSO. Clone confirmou estado e bloqueio por efeito legado; seis testes UI e typecheck passaram. Banco e interface exigem rollout coordenado.
- Próximo passo: ampliar jornada real e revisão adversarial, indicadores agregados e CI antes de homologação. Gates/flags default desligados; sem deploy ou acionamento Auvo real.

## 2026-11-05 — S165/S166: infraestrutura isolada e calendário

- `apps/web/e2e/s166-isolado/bootstrap-interno.py` cria rede interna, clone sintético sem portas/mounts, aplica migrations 1614–1731 e sobe Auth/PostgREST; login sintético e leitura autenticada passaram, recursos foram removidos. Não usa dados reais; navegador/proxy isolados e jornada UI ainda não existem. README registra limites; imagem Playwright não estava local.
- S166 AC-1: fixture de feriado passou 15/15 em clone para supressão, ausência de Visita/ocorrência/esforço/OS/outbox e consulta de referência vazia; indicadores agregados não foram exercitados. AC-3: mudança de dia preservou confirmada, extra, reprogramada, histórico e OS sintética com ID Auvo; exceção aprovada não foi comprovada. Sem chamada Auvo.
- Interface exige vigência na aprovação e sinaliza fotografia obsoleta para reconferência; testes focados 2/2 passaram. Revisão adversarial 1731 cobriu ACL, isolamento e revogação concorrente, sem bypass encontrado; protocolo segue com gate desligado e homologação pendente.
- Próximo passo: completar navegador/proxy isolados e jornada UI→backend; cobrir indicadores e exceção aprovada, fontes restantes e CI. Não houve deploy ou acionamento externo.

## 2026-11-05 — S165/S166: jornadas integradas com guarda real

- Jornadas integradas de Calendário e Visita passaram em clones com 1045 efetiva e gate 1731 ligado apenas nas transações de teste: decisão, aprovação/replay, selo, retirada/replay e geração/replay. Calendário também protegeu OS legada tardia e preservou ocorrência anterior. Fixtures `supabase/tests/manual_E01-S165_jornada_real_calendario_1731.sql` e `supabase/tests/manual_E01-S165_jornada_real_visita_1731.sql`; dados, relógio e algumas fontes sintéticos, transações revertidas.
- Concorrência de aprovação 1731 real e RPC de resultado passou nas duas ordens; gate permaneceu estável durante transação. Trava global ainda afeta outro Cliente; carga não medida. Roteiro `supabase/tests/manual_E01-S165_aprovacao_indice_legado_concorrencia.md`.
- Botão de aprovação e recuperação exigem ambas flags de interface `VITE_SSO_APROVAR_REVISAO_ENABLED` e `VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED`, desligadas por padrão; servidor ainda exige permissão, gate e validadores. Seis testes UI focados passaram. Gate de banco permanece desligado por padrão.
- Próximo passo: validação de fontes/escritores e revisão adversarial completa, fluxo UI real e CI antes de homologação; dados externos não foram comprovados. Sem deploy/Auvo real.

## 2026-11-05 — S165/S166: protocolo de aprovação condicionado

- ADR-1589/migration 1731 substituem corpo incondicional do trigger 1045 por verificação do ator/Cliente, txid, READ COMMITTED, origin, gate mediado e protocolo de validadores existentes. Gate dedicado novo nasce desligado e configurações anteriores são preservadas; não há liberação operacional automática. Revisão independente não identificou bypass estático; não prova cobertura integral.
- Clone compilou 1731 e executou aprovação mediada para Calendário e Visita com 1045 real: gate dedicado ativado somente na transação revertida, replay passou; Visita recusou gate fechado, permissão revogada e trigger obrigatório desabilitado. Fixtures `supabase/tests/manual_E01-S165_aprovacao_real_calendario_1731.sql` e `supabase/tests/manual_E01-S165_aprovacao_real_visita_1731.sql`. Cadastros e tempo sintéticos, sem prova de fontes externas, UI real ou homologação.
- Mudança de dia contratual permite reconferência após rejeição definitiva 40001 da primeira tentativa e preserva replay após resultado incerto; teste UI 2/2 passou. Feriado/dia ainda precisam de prova integrada. Travas de aprovação continuam globais para proteger inserts concorrentes e podem afetar outros Clientes; carga não medida.
- Próximo passo: testar jornada integrada com 1731 sem simular a guarda, fontes/escritores e concorrência; revisão adversarial completa e CI antes de homologação. Gate dedicado permanece desligado; sem deploy/Auvo real.

## 2026-11-05 — S165/S166: comparação e conciliação de Visita

- Prévia de reserva por Visita apresenta datas do par selecionado, possível conflito em coincidência e limites da informação, sem inferir equivalência. Seis testes focados passaram.
- Clone exerceu fluxo 1729–1730 de Visita: escolha, aprovação mediada simulada em rollback, selo sem efeito antecipado, geração legada anterior à vigência, conciliação autenticada após vigência e envio legado bloqueado. Fixture `supabase/tests/manual_E01-S165_visita_reconciliacao_inerte_1730.sql`; relógio e 1045 simulados, sem aprovação real.
- Criação de OS preventiva legada e aprovação sintética concorreram em duas ordens; contenção preservou consistência, mas a trava afetou outro Cliente. Latência sob carga ainda não medida. Roteiro `supabase/tests/manual_E01-S165_aprovacao_indice_legado_concorrencia.md`.
- Próximo passo: cobertura integral das fontes/escritores e revisão adversarial antes de considerar substituição de 1045; flags e homologação seguem fechadas. Sem deploy ou Auvo real.

## 2026-11-05 — S165/S166: conflitos candidatos e retorno

- Reconciliação agora distingue rejeição inicial definitiva 40001, permitindo nova conferência, de pedido com resultado incerto após falha de rede, preservando replay. Testes UI 5/5 e typecheck web passaram.
- Comparação de calendário destaca datas coincidentes como possíveis conflitos para conferência, sem afirmar equivalência e lembrando que datas diferentes também podem exigir análise. Testes UI 2/2 passaram. Clone demonstrou coexistência de ciclos preparados de Planos relacionados sem escolha; isso não prova equivalência nem duplicidade de execução. A comparação é teórica e não cobre Visita ou OS.
- RPC real de resultado preventivo com dados sintéticos concorreu com declaração e aprovação nas duas ordens; retorno foi preservado e efeito impediu aprovação ou exigiu nova conciliação. Trava da aprovação reteve temporariamente retorno de outro Cliente; impacto sob carga não medido. Roteiro `supabase/tests/manual_E01-S165_reconciliacao_legada_inerte_concorrencia.md`.
- Não foi identificada base para exigir classificação negativa de cada par de ciclos. Guardas protegem reservas escolhidas; falta demonstrar cobertura de fontes e revisão antes de alterar 1045. Flags/homologação seguem fechadas; sem deploy/Auvo.

## 2026-11-05 — S165/S166: reconferência e retorno concorrente

- Interface permite reconferência após fotografia ficar desatualizada e oferece a conciliação também na tela de Visita, sob flag desligada. Cinco testes focados e typecheck web passaram.
- RPC real de avaliação preventiva, com retorno sintético em clone, concorreu com declaração nas duas ordens: contenção/foto obsoleta quando o retorno veio primeiro; retorno preservado e reserva recusada quando veio depois. Roteiro `supabase/tests/manual_E01-S165_reconciliacao_legada_inerte_concorrencia.md`; não prova todos os escritores ou aprovação real.
- Leitura 1730 mantém escopo da policy PCM 0305, que permite leitura interna global; não existe concessão individual de leitura PCM por Cliente no modelo identificado. Não foi criada restrição artificial que bloqueie leitores legítimos. Guarda 1045 e flags continuam fechadas; sem deploy/Auvo. Próximo passo: comprovar fontes e escritores restantes e revisão integral para aprovação.

## 2026-11-05 — S165/S166: conciliação de legado inerte após vigência

- ADRs 1587–1588/migrations 1729–1730 implementam conferência PCM auditada de legado inerte especificamente reservado ao SSO, com CAS, reconferência, histórico e revalidação do selo, vigência e efeitos. A geração SSO aceita somente declaração vigente e íntegra; o envio/OS legado continua bloqueado. Consultas operacionais ocultam substituída, enquanto detalhe/histórico preservam identificação. Interface está sob flag desligada.
- Clone compilou migrations 1614–1730; fixture integrada passou para geração legada anterior à vigência, conciliação, replay, Cliente divergente, envio bloqueado, Chamado SSO e nova conferência após mudança. Selo e relógio sintéticos; 1045 intacta. Em duas sessões, alteração primeiro tornou foto obsoleta e declaração primeiro impediu envio legado. Outros escritores e aprovação real não foram integralmente provados.
- Testes focados da interface e typecheck passaram antes do ajuste final de recibos; teste de recibos 2/2 passou. ACL dos comandos exige ator, concessão por Cliente e gate; leitura de estados herda policy PCM existente, que não comprova concessão individual por Cliente (ADR-1588). Flags e homologação permanecem bloqueadas; sem deploy/Auvo.
- Concorrência dos geradores Visita e legado com escolha `somente_sso` passou em clone com aprovação e relógio simulados: contenção, retry, uma preparada SSO e nenhuma duplicata legada. Próximo passo: revisar segurança por Cliente, cobertura dos demais escritores e aprovação real antes de alterar 1045; validar fluxo em lote com flags apropriadas em ambiente isolado.

## 2026-11-04 — S165/S166: triagem inicial e concorrência de geradores

- ADR-1586/migration 1728 permitem decisão preliminar de vencido após ativação inicial, sem exigir retomada, mantendo autorização e verificação da vigência. Plano encerrado recusa decisão nova e aceita replay; suspenso mantém triagem preliminar. Clone compilou e fixtures cobriram ativação, replay, Cliente divergente, data corrente, estados e versão anterior dentro/fora da vigência; testes usam fallback civil São Paulo, não comprovam fuso fotografado.
- Em clone, gerador legado integral aguardou aprovação sintética; após aprovação e relógio simulados, geradores SSO e legado concorreram em Calendário com contenção/retry, uma ocorrência SSO e nenhuma legada duplicada. Roteiro `supabase/tests/manual_E01-S165_aprovacao_indice_legado_concorrencia.md`; não comprova aprovação real ou Visita.
- Lacuna pendente: índice legado `somente_sso` preparado antes da vigência pode impedir geração SSO após vigência. Não afrouxar guarda: a linha é exibida por leitores legados e precisa reconciliação explícita após vigência, preservando histórico e coerência de todos leitores/escritores. Cobertura integral, concorrência Visita e revisão adversarial completa continuam pendentes; 1045 e homologação permanecem bloqueadas, sem Auvo/deploy.

## 2026-11-04 — S165/S166: ponte futura e concorrência de Visita

- ADR-1583/migration 1727 eliminam bloqueio circular da avaliação para escolha explícita `integrar_ponte` em ocorrência legada prevista sem OS, revalidando fotografia e unicidade. Compilação e fixtures Calendário/Visita passaram em clone, incluindo escolha ambígua, foto alterada e OS. Revisão adversarial da alteração estreita não encontrou defeito alto/médio reproduzido; custo em bases grandes não medido.
- Jornadas integradas em clone percorreram escolha, aprovação mediada, selo e vigência simulada. Calendário recusou envio até ponte; Visita recusou OS antes da ponte, gerou ciclo e vinculou ocorrência existente com replay. Outros ensaios `somente_sso` cobriram geração e replay em ambos modos. 1045 e relógio foram simulados em transações revertidas: não demonstram aprovação operacional nem concorrência integral.
- Duas sessões autenticadas disputaram escolha de Visita: contenção, recusa de escolha obsoleta e replay passaram. Aprovação sintética bloqueou mediador do índice legado concorrente. Roteiros em `supabase/tests/manual_E01-S165_reserva_visita_rascunho_concorrencia.md` e `supabase/tests/manual_E01-S165_aprovacao_indice_legado_concorrencia.md`; não comprovam gerador integral concorrente.
- Próximo passo: revisar cobertura integral de fontes/escritores, provar geradores e aprovação concorrentes e executar revisão adversarial completa antes de considerar alteração da guarda 1045. Homologação/deploy bloqueados; sem tarefas Auvo reais.

## 2026-11-04 — S165/S166: legado escolhido e concorrência de reserva

- Revisão encontrou corrida entre avaliação e mudança de escolha de Visita. ADR-1582/migration 1726 serializam pelo Plano antes de ler a escolha; clone compilou migrations até 1726 e ensaio de duas sessões passou: avaliação concorrente recusada, retry após commit reconheceu escolha antiga como inválida. ACL global e revisão integral permanecem pendentes.
- ADR-1581/migration 1725 consideram resolvida apenas ocorrência legada prevista, sem OS ou envio, com escolha explícita atual `somente_legado` e fotografia revalidada. Migrations 1614–1725 compilaram em clone; fixtures de Calendário e Visita passaram para escolha, alteração de fotografia/efeito, OS e substituição. A restauração excluiu cron e exigiu ajuste de ACL; não prova aprovação real nem cobertura integral.
- Em clone até 1724, disputa autenticada da mesma reserva de Calendário preservou uma escolha, recusou fotografia antiga e aceitou replay. Não cobre Visita, planos distintos, aprovação ou geração concorrentes. Roteiro: `supabase/tests/manual_E01-S165_reserva_rascunho_concorrencia.md`.
- Interface invalida identidade de consulta de Visita na mudança de rascunho para aprovada; teste focado 4/4 passou. Próximo passo: provar integração completa e concorrência das demais fontes e realizar revisão adversarial; guarda 1045 e homologação permanecem bloqueadas. Sem Auvo real ou deploy.

## 2026-11-04 — S165/S166: reconciliação por ciclo futuro e rascunho

- ADRs 1570–1576 e migrations 1714–1720 acrescentam reserva explícita PCM por ciclo/índice legado com escolhas SSO/legado/ponte, foto/CAS, auditoria e proteção dos escritores; interface mediada lista preparadas, vinculadas e futuras sem inferir equivalência. Ensaios sintéticos autenticados passaram para calendário/Visita, replay, CAS, isolamento e preparação posterior; concorrência futura integral e cobertura completa das fontes seguem pendentes.
- ADRs 1578–1580 e migrations 1722–1724 permitem escolha em rascunho, selo na aprovação e aplicação após vigência, preservando reserva anterior e histórico. Fixtures calendário e Visita passaram em clone com aprovação/relógio simulados apenas em rollback; teste adicional cobriu preparação e Chamado SSO. Não provam aprovação operacional, fontes externas ou concorrência real. SQL e UI exigem rollout coordenado; 1045 e flags continuam fechadas.
- Typecheck passou; testes UI focados da escolha futura passaram. Sem Auvo/deploy. Falta concluir prova integral dos escritores/cobertura futura e revisão adversarial antes de alterar a guarda de aprovação.

## 2026-11-04 — S165/S166: ponte e reconciliação por janela

- ADR-1567/migration 1711 serializam criação de OS legada e pontes pela mesma ocorrência e exigem READ COMMITTED nos caminhos aplicáveis; não desativam geradores nem alteram OS. Clone com migrations 1614–1711 compilou; isolamento e contenção de linha passaram em testes sintéticos de duas sessões. Restauração excluiu cron/net e teve aviso de ACL cron; não prova ACL global, corrida completa de comandos ou caminho Visita. Guarda 1045 intacta.
- Tela de lote legado permite filtrar janela e selecionar ciclos explicitamente usando 0794/0764 existentes; não afirma cobertura de páginas não carregadas ou ciclos não preparados. UI 2/2 e typecheck passaram. Cobertura futura integral e reconciliação positiva de todas as fontes oficiais continuam pendentes; SSO permanece fonte oficial, sem exigir ausência global Auvo. Sem deploy/Auvo.

## 2026-11-04 — S165/S166: contenção por Chamado e escolha concorrente

- ADR-1565/migration 1709 substituem trava global sobre tabelas de vínculo de Chamado pela trava da linha do Chamado, com verificação das FKs necessárias. Em clone, ensaio reproduziu bloqueio indevido de OS corretiva de outro Cliente antes da correção e sucesso depois; FK do mesmo Chamado bloqueou e fixture de fotografia preventiva passou. Versão final compilou no lote até 1709; FK específica de Visita, carga e revisão adversarial adicionais pendentes.
- Duas sessões autenticadas com preparadas distintas disputando a mesma candidata de Visita: A confirmou, B recebeu contenção e no retry `candidata_ja_escolhida`; replay A retornou sucesso e existe uma escolha. Clone sintético até 1709, sem Auvo; não prova todas as fontes ou aprovação real. Guarda 1045 e gates permanecem fechados.

## 2026-11-04 — S165/S166: revisão adversarial de nova data

- Revisão adversarial identificou e reproduziu escolha histórica impedindo reutilizar Visita, geração antes da vigência e OS tardia por ponte legada. ADRs 1563/1564 e migrations 1707/1708 corrigem os três casos: a verificação da escolha atual é serializada por Plano, geração antecipada é recusada e OS por ponte é reconferida sob trava. Clone limpo compilou até 1708 e fixtures focadas passaram. Concorrência de duas escolhas e fontes externas permanecem pendentes; sem PASS.
- Geração concorrente de calendário e Visita após escolha/retirada foi ensaiada em clones: segunda sessão bloqueada e replay igual após commit. Aprovação e data foram simuladas somente nos clones; concorrência de feriados e aprovação operacional não comprovadas. UI de Visita: 4 testes focados passaram; typecheck passou. Guarda 1045 e gates seguem bloqueados, sem Auvo/deploy.

## 2026-11-04 — S165/S166: escolha explícita de nova data

- ADRs 1558/1559 e migrations 1702/1703 ligam escolha explícita PCM de ciclo de calendário ou Visita candidata existente à avaliação, selo de aprovação, retirada segura de fila e geração sem correspondência automática nem alteração de OS. 1704/1705 tratam fontes nativas SSO sem exigir ponte legada fictícia; 1706 reconfere candidata de Visita sob trava antes de retirar fila. Flags e guarda 1045 seguem fechadas.
- Ensaios de calendário e Visita cobriram escolha → aprovação mediada → selo → bloqueio antes da retirada → retirada/replay → geração/replay. Migrations até 1706 compilaram em clone; fixtures negativas de candidata alterada/feriado passaram. 1045 e data civil foram simuladas apenas nas transações revertidas; cenários com pontes/OS sintéticas não comprovam aprovação operacional, fontes externas, relógio real ou concorrência. Typecheck e 7 testes focados UI passaram.
- ADR1556/1700 exige configuração integral e triggers previstos na aprovação mediada; ADR1557/1701 usa versão operacional na criação de Chamados mantendo replay/histórico. Homologação e deploy continuam bloqueados; não é necessário perguntar de novo regra automática de data, pois PCM escolhe.

## 2026-11-04 — S165/S166: versão operacional por ciclo e retorno

- Correção de interpretação: fontes aprovadas definem SSO como estrutura oficial e Auvo como executor; não exigem comprovar ausência global de tarefas Auvo para aprovação interna. P01/P02/P03 estão fechadas. Mudança de data exige nova versão/vigência e prévia para PCM, sem correspondência automática presumida; pergunta anterior ao usuário não deve ser tratada como regra funcional reaberta. Contrato externo continua gate para envio real.
- ADR-1543/migration 1686 deixam Visita nativa sem ponte ser analisada e exigem classificação dos legados oficiais existentes; fixture focada passou em clone, com 1045 e outras guardas desligadas apenas no teste.
- ADRs 1544–1555 e migrations 1687,1689–1699 preparam escolha explícita de alteração para mesma identidade/alvo/data, versão operacional, selo, fotografia por OS, consumidores de retorno e referência de pendência nativa sem legado fictício. 1045, flags e proteções seguem fechadas. Clone limpo compilou até 1699; testes UI 11/11 e typecheck passaram; fixtures focadas passaram para escolha/replay, selo sintético, criação de OS, legado Visita e retorno nativo.
- Fixture Visita 1699 executou comandos mediados de listagem, classificação, conferência, aprovação/finalização e replay; OS sintética finalizou. Origem, OS e fotografia foram inseridas artificialmente com triggers suspensos na preparação; não prova aprovação real da revisão, criação real da OS encadeada, calendário completo, concorrência nem fontes externas. 1696 não deve ser liberada antes de revisão adversarial e provas. Sem Auvo/deploy.

## 2026-11-04 — S166: componente Grupo com backend real isolado

- Em rede Docker interna e clone descartável, com GoTrue (audience e hook reais), PostgREST, Vite e navegador, login, consulta da prévia e declaração PCM do componente `ConferirGrupoFila` retornaram 200. Uma declaração registrada; fila permaneceu em verificação e nenhuma OS foi criada. Evidência sanitizada em `apps/web/e2e/s166-isolado/evidencia-2026-11-04.txt`; roteiro manual no README. A página montou componente isolado, fixture foi SQL, GoTrue migrou somente clone; não prova navegação completa, Visita, concorrência ou fontes externas. Clone/recursos do ensaio removidos.
- Sem apagar dados em uso, fstrim online no datadisk do Colima devolveu espaço: host passou de ~10 para ~18 GiB livres antes do ensaio; após limpar e aparar novamente, ~17 GiB. Trava 1045 e homologação permanecem bloqueadas; data-base e fontes externas aguardam definição.

## 2026-11-04 — S165/S166: fuso de auth, disco e concorrência Visita

- Hipótese para a prévia ausente no E2E: GoTrue isolado não tinha o hook de token que adiciona `user_role`, exigido por `sso_autorizar_acao`. Configuração do hook para próximo ensaio consta no README isolado; não houve nova jornada nem confirmação da hipótese. Ambiente anterior foi removido.
- Disco: Data com 10 GiB livres; `~/.colima` ocupa 15 GiB, datadisk com cerca de 14 GiB alocados no host e 6,2 GiB em uso na VM. Diferença é compatível com blocos liberados ainda alocados, sem prova da origem temporal; não foi feita limpeza nem compactação.
- Fixture de Visita para 1678 passou em clone com alteração de OS: contenção 55P03, fotografia aceita após rollback e rejeitada após commit. Ponte/OS sintéticas foram inseridas com FK desligada no clone; outras guardas e 1045 ficaram desligadas somente em transações revertidas para isolar o trigger. Não prova aprovação real ou latência sob carga.
- Guarda 1045 e homologação mantidas; decisão sobre data-base e comprovação de fontes externas seguem pendentes.

## 2026-11-04 — S165/S166: login sintético corrigido, jornada pendente

- Fonte do GoTrue indicou audiência ausente; com `GOTRUE_JWT_AUD=authenticated` o login e `/user` reais retornaram 200 no ambiente de rede interna, gateway confirmou clone descartável. A jornada única expirou ao esperar a prévia de Grupo; nenhuma declaração foi enviada. Serviços foram removidos antes de preservar DOM/rede, portanto causa da falha é desconhecida e não se comprovou a jornada UI→backend. Não houve Auvo ou escrita na origem.
- `e2e/s166-isolado/fixture.ts` prepara captura de rota/status sem tokens/corpos e screenshot com conteúdo oculto; README registra audiência. Captura nova não foi executada nem comprova isolamento completo. Roteiro `manual_E01-S165_concorrencia_relacao_decisao.md` documenta ensaio de relação/decisão, não reexecutado após registro.
- Recursos descartáveis foram removidos segundo executor; disco host indica 10 GiB livres (15 GiB antes de duas tentativas), causa não confirmada. Não repetir download de imagens ou jornada até verificar espaço e causa. A aprovação segue bloqueada; data-base e equivalência de fontes externas aguardam definição.

## 2026-11-04 — S165/S166: ensaio de navegador isolado

- Ambiente descartável de rede interna com PostgreSQL, Auth, PostgREST, Vite e navegador foi montado sem portas públicas de banco; clone com ACL e migrations 1614–1683, identidade verificada no gateway e teste pontual de saída externa negado. GoTrue migrou somente o clone. Login do usuário sintético falhou com 400 invalid_credentials apesar de conferência de fixture; não houve jornada UI→backend, JWT forjado, Auvo ou escrita na origem. Contêineres, rede, dump, dependências e imagem baixada do ensaio foram removidos; espaço livre no host permanece 13 GiB contra 15 GiB antes, causa não confirmada.
- Em clone separado, comandos autenticados reais de retirada da declaração legada e decisão comparada foram serializados (a decisão aguardou commit); não cobre criação física de ponte nem OS. Roteiro `supabase/tests/manual_E01-S165_concorrencia_relacao_decisao.md` foi preparado após o ensaio e não reexecutado. Guarda 1045 intacta.
- Continuam pendentes a definição da data-base e a fonte/critérios de equivalência para reconciliar PMOC/legado/Auvo; homologação bloqueada.

## 2026-11-04 — S165/S166: teste integrado de navegador e concorrência

- Ensaio em clone de duas decisões comparadas autenticadas na mesma ocorrência/revisão: primeira confirmou; segunda aguardou e recebeu 40001, sem sobrescrever. Não prova disputa com escritor real de OS/ponte nem todos os caminhos; 1045 preservada.
- O Playwright compartilhado carrega configuração local que aponta a ambiente real e reutiliza servidor; não usá-lo para dados sintéticos. Foram preparados arquivos isolados `playwright.s166-isolado.config.ts`, `vite.s166-isolado.config.ts`, `e2e/s166-isolado/servidor.mjs` e `fixture.ts`, mas NÃO existe ainda gateway/Auth/PostgREST, clone nem jornada E2E validada. Filtro HTTP/service workers não garante isolamento total de rede; falta bloqueio no ambiente e comprovar destino do gateway antes de qualquer escrita. Não houve operação externa nem teste de navegador.
- Fontes positivas PMOC/legado ainda não provam equivalência integral ou ausência de obrigações externas; fonte autoritativa e critérios de reconciliação não estão definidos. Decisão sobre data-base pendente; 1045 e homologação bloqueadas.

## 2026-11-04 — S165/S166: fontes e concorrência

- Auditoria de origem: vínculos positivos PMOC/legado não comprovam equivalência integral de alvo/escopo nem ausência de obrigações externas; fonte oficial de feriados não foi encontrada no código. Não é seguro liberar a guarda 1045 somente por inferência. A decisão sobre mudança de data permanece aguardando usuário.
- Dois ensaios em sessões separadas com clone sintético até 1683 passaram: escrita concorrente em ordens_servico recusou aplicação de retirada 1674 com 55P03; escrita concorrente de ponte recusou prévia de classificação 1683 com 55P03. Não comprovam outras ordens, throughput ou fontes externas. Sem alteração funcional, Auvo ou deploy.

## 2026-11-04 — S165/S166: validação integrada e fontes

- Clone com migrations 1614–1683 e rollback exercitou aprovação mediada, replay, continuidade de três versões e geração sem duplicidade em calendário e Visita. Gates ativados e 1045 desligada somente dentro das transações sintéticas; depois 1045 estava habilitada e não restaram Planos de fixture. Fonte/decisão sintética não comprova exclusividade externa, concorrência nem homologação.
- Teste de interface de calendário até fila passou com componentes reais e RPC simulada; não cobre banco/rede/concorrência e não cria OS/Auvo.
- Existem feriados declarados por Cliente/contrato, mas código não comprova cobertura oficial. Para operação faltam identificação de local/UF, contratos e períodos, relação aplicável e fonte/responsável, além de definir se PCM pode manter lista conferida ou se outra fonte deve ser integrada. Isso não substitui reconciliação PMOC/legado. A questão de mudança de data-base já foi encaminhada ao usuário e continua pendente.

## 2026-11-04 — S165/S166: classificação e recuperação de conflito

- ADR-1540/migration 1683 impedem classificar um par Plano/legado como não relacionado se houver ponte explícita de ocorrência mesmo após retirada da relação. Migrations 1614–1683 compilaram em clone e fixtures de calendário/Visita passaram com rollback; concorrência e custo de travas pendentes. Guarda 1045 intacta.
- A resolução de retirada e reabertura de Grupo liberam nova conferência somente após rejeição definitiva da primeira tentativa; pedidos recuperados ou com resultado incerto mantêm requestId. Sete testes focados e typecheck passaram. Sem Auvo/deploy. Homologação permanece bloqueada; decisão sobre data-base pendente.

## 2026-11-04 — S165/S166: classificação de legado e reabertura de Grupo

- ADR-1537/migration 1680 e interface permitem PCM classificar par Plano/legado como não relacionado com motivo, contexto e fotografia; avaliação deixa de contar apenas classificação ainda atual e volta a apontar pendência quando fontes mudam. Fixture em clone cobriu classificação/replay, alteração, ACL anônima; faltam concorrência, revogação e testes específicos de UI. Reforço de função foi aplicado por CREATE OR REPLACE no clone, portanto falta prova de compilação limpa na ordem final. Fontes externas não são comprovadas; guarda 1045 intacta.
- ADR-1538/migration 1681 permitem reabrir conferência de Grupo explicitamente para calendário e Visita, sem alterar OS ou gerar ocorrência. Três testes de UI e fixture SQL de calendário passaram; faltam SQL de Visita, concorrência e inventário dos demais escritores legados de OS. Gates e homologação seguem bloqueados; sem Auvo/deploy. Decisão sobre data-base ainda pendente.

## 2026-11-04 — S165/S166: Grupo e OS na aprovação

- ADR-1533/migration 1676 e ADR-1536/migration 1679 integram Grupo à conferência de fila sem unidades artificiais. PCM informa fontes/motivo e afirma não ter identificado execução nessas fontes; fotografia dos efeitos locais é revalidada e confirmação da fila é separada. Endpoint antigo aceita replay de declaração existente; novas exigem afirmação explícita. Teste UI e fixture 1679 passaram em clone revertido; a fixture antiga 1676 representa contrato anterior e não deve ser usada isoladamente após 1679. Visita, concorrência e fontes externas permanecem pendentes.
- ADR-1535/migration 1678 revalidam OS conhecidas antes da aprovação. Fixture calendário passou em clone isolando trigger com outras guardas desabilitadas somente em transação revertida; não prova aprovação real. Travas globais exigem avaliação de concorrência/latência e faltam Visita/fontes externas. Guarda 1045 permanece.
- Migrations 1614–1679 compilaram, teste UI e typecheck passaram; fixture de retirada Visita 1674 também passou. Gates e homologação bloqueados; sem Auvo/deploy. Decisão de mudança da data-base continua pendente.

## 2026-11-04 — S165/S166: Grupo na fila e revalidação de OS

- ADR-1533/migration 1676 e `ConferirGrupoFila` permitem declaração explícita PCM com fonte/motivo e fotografia de efeitos locais para Grupo sem ponte legada; confirmação da fila é passo separado, sem unidades artificiais ou certeza de fontes externas. Fixture de calendário e teste de UI passaram; Visita, concorrência e fontes externas pendentes.
- ADR-1535/migration 1678 revalidam OS conhecidas da decisão na aprovação. Fixture de calendário passou isolando o trigger e desabilitando guardas somente na transação revertida; não prova aprovação real. Travas de tabelas são globais e exigem ensaio de concorrência/latência; Visita e fontes não vinculadas pendentes. Guarda 1045 intacta.
- Fixture de retirada por Visita passou em clone; migrations 1614–1678 compilaram, typecheck passou. Gates e homologação seguem bloqueados; sem Auvo/deploy. Mudança de data-base continua aguardando decisão.

## 2026-11-04 — S165/S166: retirada aplicada, legado e concorrência

- ADR-1531/migration 1674 e `AplicarRetiradasFila` oferecem comando explícito, paginado e idempotente para aplicar retirada já aprovada e efetiva a entrada sem execução comprovada; leitura não escreve, e OS/fontes incertas permanecem para PCM. Fixture e dois testes de UI passaram; faltam concorrência, fontes não vinculadas e validação operacional.
- ADR-1532/migration 1675 serializam edição e materialização do Plano Preventivo legado pela mesma linha. Em clone descartável, teste de duas sessões passou em ambas ordens, incluindo commit e rollback; cobre READ COMMITTED e comandos canônicos, não escrita privilegiada direta nem fontes externas. Migrations até 1675 compilaram.
- Recibos de geração abrem vínculo contextual ao legado, com seleção e confirmação explícitas; 35 testes focados passaram e typecheck passou. Sem Auvo/deploy. Guarda 1045 e homologação bloqueadas; decisão de data-base continua pendente.

## 2026-11-04 — S165/S166: continuidade de ocorrência mantida e consulta por IDs

- ADR-1528/migration 1671 permite consumir somente a ocorrência histórica específica com decisão e selo de continuidade vigentes, mesmo após retirada da Rotina; não permite novos ciclos nem altera OS/histórico. Fixtures sintéticas de calendário/Visita passaram em clone com ACL preservadas e rollback; selos foram inseridos como fixture, não provam aprovação real ou concorrência. Guarda 1045 mantida.
- ADR-1527/migration 1670 substituem varredura limitada da janela por consulta autorizada de até 775 IDs; 6 testes de interface e fixture SQL de autorização/limite passaram. O cliente depende da migration e requer rollout coordenado; flags continuam desligadas.
- Ações de revisão preservam pedido e requestId após resultado incerto mesmo que retry receba 22023/23514/40001; 3 testes focados passaram. Typecheck passou. Migrations 1614–1671 e três fixtures 1670/1671 passaram em clone com ACL preservadas e rollback, sem cron/net. Faltam integração real, concorrência e decisão pendente sobre data-base; sem deploy ou Auvo.

## 2026-11-04 — S165/S166: recuperação segura e fila multirrotina

- Resultados confirmados da geração multirrotina podem ser selecionados para inclusão explícita na fila, inclusive após interrupção; IDs são reconferidos no Plano. Seis testes focados passaram; sem inclusão automática.
- Recuperação de conflitos em decisões e fila distingue rejeição definitiva na primeira tentativa de replay ou envio incerto: estes preservam o pedido para reconciliação. Na rejeição inicial por continuidade, PCM pode cancelar explicitamente a entrada sem alterar OS. O lote multirrotina registra incerteza antes do envio e preserva recibos anteriores; 4 testes focados de lote e 8 de decisão/fila passaram. Tratamento de erro de cache foi ajustado depois desses testes; typecheck passou.
- Nenhuma migration nesta etapa; concorrência e integração real seguem pendentes. Guarda 1045 e homologação bloqueadas; sem Auvo/deploy. Decisão sobre data-base pendente.

## 2026-11-04 — S165/S166: fuso, conflito e lote de Rotinas

- ADR-1523/migration 1666 usam a data civil da versão aplicável nas transições de suspensão, encerramento, retomada e decisão de vencido quando os gates existentes de fuso estão ativos; gates desligados preservam o comportamento anterior, configuração parcial e fuso ausente bloqueiam. Fixture passou em clone revertido com fusos em dias diferentes; não comprova concorrência nem fontes contratuais externas.
- A jornada de geração por calendário permite conferir até 25 Rotinas e processá-las sequencialmente, com progresso e recuperação por item; não é atômica entre Rotinas e não cria OS/Auvo. ADR-1521/migration 1664 mantêm gate de origem durante lote conferido; fixture de gate, ator, PMOC e replay passou em clone revertido. Faltam integração real e concorrência.
- Telas de impacto recuperam de erro SQL 40001 definitivo mediante reconferência, preservando resultado incerto; 4 testes focados passaram. Jornada multirrotina: 2 testes focados passaram; typecheck passou. Guarda 1045 e homologação seguem bloqueadas; decisão sobre data-base pendente.

## 2026-11-04 — S165/S166: histórico de origem, OS e fila após integração

- ADR-1519/migration 1662 integra OS ativas encontradas em vínculos conhecidos à comparação e confirmação da decisão; fontes sem vínculo seguem incompletas e há limite de 100 OS. Fixture sintética de calendário passou em clone revertido: deduplicação da mesma OS por duas fontes, divergência de Cliente sem exposição e status alterado invalidando fotografia; conflito inconsistente foi inserido com triggers desabilitados apenas na fixture. Visita, fontes não vinculadas, custos/travas e concorrência permanecem pendentes.
- ADR-1520/migration 1663 acrescenta à comparação a Rotina e questionário da versão que originou a ocorrência, distinguindo-a da versão imediatamente anterior. Com migrations 1614–1663, ensaios de 3 versões e fixtures de decisão/questionário passaram em clone para calendário e Visita; snapshot ausente é indeterminado. Aprovação testada com 1045 desligada somente na transação revertida.
- Após integração com legado, recibos de calendário e Visita, individual/lote, oferecem conferência da fila sem ação automática; 28 testes focados e typecheck passaram. Homologação/deploy bloqueados, sem Auvo real. Decisão sobre ocorrência futura após mudança da data-base ainda pendente.

## 2026-11-04 — S165/S166: decisão com questionário e seleção de Visitas

- ADR-1516/migration 1659 incluem ciclo ou Visita/semana na comparação conferida. ADR-1517/migration 1660 incluem fotografias por hash de questionário histórico e fonte atual, revalidando antes de decisão e aprovação. Migrations 1614–1660 e fixtures de calendário/Visita passaram em clone revertido: alteração com mesmo ID, replay, fotografia atual e fotografia alterada antes de aprovação. Para alcançar o trigger, 1045 foi desativada somente na transação sintética. Faltam concorrência e revisão adversarial; schema estrito v2 exige rollout coordenado servidor/cliente.
- A lista de obrigações permite incluir Visitas selecionadas uma a uma, com confirmação, progresso e recuperação idempotente após falha parcial; UI explicita que a operação não é atômica. Não cria OS/Auvo. Quatro testes focados de seleção e comparação passaram; gates continuam desligados. A definição sobre mudança da data-base permanece pendente.

## 2026-11-04 — S165/S166: decisão comparada e fila de calendário

- ADR-1514/migration 1657 e formulários conectam a decisão à comparação conferida no servidor. Gate desligado; com ele ativo, nova decisão pela rota antiga é recusada, mantendo replay antigo. Fotografia nova não pode ser associada a decisão histórica; comparação obsoleta é recusada. Migrations 1614–1657 e fixtures de calendário/Visita passaram em clone revertido; faltam concorrência real, revisão adversarial e comprovação do conteúdo/versão de questionário e fontes OS. Guarda 1045 intacta.
- Preparação por calendário, individual e em lote, abre conferência da fila a partir dos recibos, sem inclusão automática. Typecheck e 13 testes de interface passaram.
- Ensaios de três versões estendidos até geração: calendário e Visita reutilizam a ocorrência original e registram um único uso, sem OS/Auvo; aprovação exercitada somente em clone com guarda 1045 desabilitada na transação revertida. Não habilitar gates nem publicar. A decisão operacional sobre mudança de data continua pendente.

## 2026-11-04 — S165/S166: continuidade e decisão com comparação

- ADR-1510/migration 1653 preservam na revisão seguinte a ocorrência selada na versão anterior mesmo que ela não tenha sido novamente materializada. Ensaios sintéticos em três versões para calendário e Visita passaram com rollback; aprovação testada com guarda 1045 desativada somente na transação de teste. Não autoriza homologação nem prova concorrência.
- ADR-1511/migration 1654 e interface associam a comparação à Rotina lógica e apresentam referência anterior e rascunho, inclusive em continuidade selada; falha de comparação bloqueia decisão. Confirmação é invalidada ao mudar comparação ou data; 2 testes focados passaram após correção de reconfirmação. Compilação em clone passou; comparação ainda não é selo transacional e faltam testes SQL funcionais próprios.
- Preparação individual e em lote de Visitas agora permite abrir conferência da fila a partir do recibo, sem inclusão automática; 9 testes focados passaram. Typecheck passou após ajustes. Gates seguem desligados; sem Auvo real ou deploy. Decisão do usuário sobre mudança de data permanece pendente.

## 2026-11-04 — S165/S166: resolução obsoleta e revalidação de fonte

- ADR-1506/migration 1649 e `ResolverRetiradaImpacto.tsx` distinguem retirada vigente e obsoleta sem alterar recibo histórico; fixtures sintéticas de calendário e Visita passaram após restauração do escopo. Mudança de data com ocorrência futura depende de definição PCM solicitada ao usuário.
- ADR-1507/migration 1650 fazem fila de Visita apresentar fonte atual e recusam novo Chamado quando registro está cancelado/em verificação ou fonte deixa de ser elegível; flags continuam desligadas. Fixture sintética passou para fonte alterada, bloqueio e cancelamento, sem OS. Clone sem owner/cron/net não comprova ACL de produção, concorrência ou todos os consumidores.
- Ensaio `manual_E01-S165_aprovacao_calendario_clone.sql` passou no clone e rollback: início/submissão, decisão, classificação PMOC, aprovação real, replay, vigência e selo. A ACL e a guarda 1045 foram alteradas SOMENTE na transação sintética, fuso foi fixture; Visita, concorrência e fontes reais não foram provados. ADR-1508/migration 1651 adicionam wrapper autenticado e adapter mediado, sem abrir a guarda 1045. Fixture sintética passou para ACL, gate fechado, ator/Cliente divergentes, revogação e rejeição pela 1045; replay usou recibo inserido como fixture e não prova aprovação real pelo wrapper nem corrida. Typecheck passou.
- Typecheck e 10 testes focados de interface passaram; migrations 1614–1650 e fixtures 1649/1650 passaram no clone. Backup remoto `560c84b` preserva o lote capturado; alteracoes posteriores exigem novo snapshot. Homologação, gates e deploy seguem bloqueados; sem Auvo real.

## 2026-11-04 — S165/S166: retirada de escopo e fila por Visita (em andamento)

- ADR-1503/migration 1646 conferem que a identidade de Rotina e alvo foi realmente retirada antes de registrar resolução, voltar a considerá-la resolvida ou selar aprovação. Não implementam a reconciliação de mudança de regra/alvo; guarda 1045 permanece. Compilou em clone descartável; testes sintéticos transacionais de calendário e Visita passaram para escopo presente/retirado, replay e escopo restaurado. Alterações de escopo foram feitas diretamente na fixture; faltam fluxo real, concorrência e aprovação real.
- ADR-1504/migration 1647 e telas preparam fila separada para ciclos por Visita, com gate desligado. Ensaio sintético revertido cobriu inclusão com fonte legada elegível, consulta, replay, conflito, cancelamento, bloqueio de reinclusão, revogação e ausência de OS. Ainda faltam confirmação após vínculo, fontes alteradas após inclusão, concorrência, origem com OS/grupo e integração ao painel cronológico.
- ADR-1505/migration 1648 ligam a fila de Visitas ao painel de Preventivas em seção própria e com flags desligadas. Typecheck e 2 testes da interface passaram; ensaio sintético com migrations 1614–1648 e rollback cobriu inclusão/replay/cancelamento, filtros, cursor, Cliente, revogação e ACL anônima. Clone por dump sem pg_cron/pg_net nem owner não comprova ACL de produção, concorrência, várias páginas ou ciclo sem ponte.
- Homologação e deploy continuam bloqueados; sem Auvo real. Snapshot de proteção em `origin/backup/sso-wip-20261104`, commit `2295dd6`; envio ao repositório público autorizado pelo usuário. Alterações posteriores ao snapshot ainda não estão no remoto.

## 2026-11-04 — S165/S166: conferência e sessão nas telas de geração

- Confirmações de relação, materialização e lotes ficam vinculadas aos dados, seleção, revisão e motivo/fonte conferidos; atualização relevante exige nova confirmação. Consultas em erro ou revalidação bloqueiam materialização em lote.
- Prévia e lote canônicos por Visita conferem identidade atual antes da requisição e após resposta, preservam tentativa diferente/pendente e isolam estado ao trocar contexto; prévia serializa envios na mesma tela. Isso não substitui autorização e idempotência do servidor nem coordenação entre abas.
- 12 testes focados passaram com serviços simulados, incluindo troca de sessão e alteração da Visita; validação integrada e cobertura de todos os caminhos seguem pendentes. Concorrência por Visita foi ensaiada em clone sintético descartado: preparação concorrente, mudança PMOC antes e depois da geração; scripts em `supabase/tests/manual_E01-S166_visita_concorrencia_*.sql`. Não comprova escritores externos nem aprovação real.
- A guarda 1045, gates, homologação e deploy continuam bloqueados; sem Auvo real.

## 2026-11-04 — S166: concorrência de calendário/PMOC

- Ensaios em duas sessões num clone sintético descartado, com migrations até 1645: geração concorrente recebeu 55P03 e, após commit, reutilizou a ocorrência única; alteração PMOC em andamento impediu geração e, após commit, exigiu nova conferência; geração em andamento impediu alteração PMOC por trava. Scripts e ordem em `supabase/tests/manual_E01-S166_concorrencia.md`. Nenhum envio externo.
- Cobertura limitada a uma Rotina por calendário, classificação não relacionada e três ordens específicas; não comprova concorrência de aprovação, Visita, múltiplos Planos, escritores externos ou lote. Gate, guarda 1045, fontes/fuso, homologação e deploy permanecem pendentes.

## 2026-11-04 — S166: protocolo nas entradas históricas de Visita

- ADR-1502/migration 1645 mantêm assinaturas e ACL históricas, mas exigem gate da ponte, dupla concessão e protocolo de concorrência ao usar as três RPCs históricas enquanto a continuidade da revisão estiver ligada. Com continuidade desligada preservam guardas anteriores.
- `manual_E01-S165_S166_ponte_visita_mediada.sql` passou com migrations 1614–1645 em transação sintética revertida: com continuidade ligada e ponte desligada, lista/materialização/lote diretos recusam; com continuidade desligada a lista chega à validação anterior; com gates de teste ligados o fluxo mediado segue válido.
- Permanecem inventário de consumidores externos, testes de concorrência em sessões separadas, aprovação real e revisão adversarial. Gates e guarda 1045 ficam fechados; sem deploy ou Auvo real.

## 2026-11-04 — S165/S166: ponte legada de Visita mediada

- ADR-1501/migration 1644 mediam leitura e materialização individual/lote de Visita, exigindo sessão, `plano.gerir`, `visita.confirmar` e protocolo nas escritas; também mediam conferência e comparação legada. Telas usam mediadores. Corrigida ambiguidade `id` na listagem de versões. Gate da ponte permanece desligado.
- `manual_E01-S165_S166_ponte_visita_mediada.sql` passou em banco sintético, com rollback: Visita futura, relação, vínculo idempotente, início da revisão e decisão de impacto; avaliação reconhece ponte e replay com concessão revogada é recusado. Typecheck passou.
- As permissões diretas históricas das RPCs de Visita foram preservadas e precisam ser inventariadas e cortadas de forma compatível antes da ativação; lote, comparação de calendário, concorrência, aprovação real e fuso externo seguem pendentes. Homologação, deploy e Auvo real bloqueados.

## 2026-11-04 — S165/S166: ponte legada de calendário mediada

- ADR-1500/migration 1643 criam gate próprio desligado e RPCs autenticadas para listagem, histórico, declaração e materialização individual/em lote da ponte de calendário; núcleos permanecem privados. Telas usam a mediação e conferem sessão. Corrigida ambiguidade `id` na função privada de listagem.
- `manual_E01-S165_S166_ponte_legada_mediada.sql` passou em banco sintético com rollback: gate, ator, ACL e revogação; relação e materialização idempotentes, seguidas da decisão de impacto com fonte individual vinculada. A fixture ajusta snapshot artificialmente e cobre um ciclo, sem provar equivalência global. Typecheck e 5 testes focados da tela passaram.
- Ainda falta mediar/verificar a ponte de Visita e demais consultas legadas, testar lote, concorrência e aprovação real. Gates, guarda 1045, fuso, homologação, deploy e Auvo real seguem bloqueados.

## 2026-11-04 — S165: decisão mediada de impacto por Visita

- `supabase/tests/manual_E01-S165_impacto_visita_mediado.sql` passou em banco sintético com rollback: prepara Visita, inicia revisão por RPC, decide impacto e fotografa efeitos, verifica replay e revogação de `visita.confirmar`. Avaliação identifica ausência de ponte legada e não autoriza aprovação.
- Abrange uma Visita sem OS/ponte e uma sessão; aprovação, alterações nas fotografias, múltiplas versões e concorrência continuam pendentes. Guarda 1045, homologação, deploy e Auvo real seguem bloqueados.

## 2026-11-04 — S165: decisão mediada de impacto em calendário

- `supabase/tests/manual_E01-S165_impacto_calendario_mediado.sql` passou em banco sintético com rollback: cria ciclo, inicia revisão pela RPC, registra decisão mediada e fotografia de efeitos, verifica replay e avaliação. A fonte legada ausente é identificada como incompleta; aprovação permanece não autorizada.
- Escopo de uma ocorrência sem OS ou vínculo legado; não valida aprovação, reconciliação, Visita, mudanças de fotografia ou concorrência. Guarda 1045, homologação, deploy e Auvo real seguem bloqueados.

## 2026-11-04 — S165/S166: continuidade por Visita em duas versões

- `supabase/tests/manual_E01-S165_S166_continuidade_visita.sql` passou em banco sintético com rollback e migrations 1614–1642: reuso da Visita por outra versão sem selo é recusado; com decisão e selo inseridos como fixture, a nova versão reutiliza uma única ocorrência e registra uso.
- O ensaio cria versão e selo diretamente; não valida aprovação real ou criação transacional dos selos. Data histórica diferente, lote por Visita, fontes externas, concorrência e revisão adversarial seguem pendentes. Gates, guarda 1045, homologação e deploy permanecem fechados.

## 2026-11-04 — S166: geração por Visita e PMOC

- `supabase/tests/manual_E01-S166_pmoc_visita.sql` passou em banco sintético com migrations 1614–1642 e rollback: PMOC sem classificação bloqueia Visita; após classificação não relacionada, preparação e replay mantêm uma ocorrência, sem OS ou outbox. Revogação de `visita.confirmar` recusa consulta e mudança posterior no PMOC bloqueia novo pedido, preservando replay anterior.
- Um cenário regular em sessão única: faltam revisão e reuso de Visita, data histórica diferente, lote e concorrência entre sessões. Fontes externas/fuso não comprovados, gates e guarda 1045 mantidos, homologação e deploy bloqueados.

## 2026-11-04 — S165/S166: continuidade de calendário em duas versões

- `supabase/tests/manual_E01-S165_S166_continuidade_calendario.sql` passou em banco sintético com rollback e migrations 1614–1642: sem selo de continuidade, reuso por outra versão falha; com decisão e selo inseridos artificialmente como fixture, a segunda versão reutiliza a ocorrência sem duplicá-la. Teste também confirma que a guarda 1045 continua recusando token de aprovação.
- A fixture cria versão e selo diretamente: não testa a aprovação real, criação transacional dos selos, versões sucessivas, retirada, Visita ou concorrência. Isso não autoriza homologação nem deploy; gates e restrições de fontes/fuso permanecem.

## 2026-11-04 — S166: guarda inversa PMOC/OS em execução isolada

- `supabase/tests/manual_E01-S166_guarda_os_pmoc.sql` passou em banco sintético e transação revertida, com migrations 1614–1642. Com ocorrência preparada, classificação obsoleta bloqueou inserção de OS PMOC; classificação atual como não relacionada permitiu; nova alteração voltou a bloquear outra OS e permitiu atualizar observação da OS existente. Nenhum envio externo.
- Cobertura de inserção direta com privilégio de fixture, em sessão única; não comprova fluxo real de usuário, related/mesmo alvo, concorrência, atualização de status, aprovação ou fontes externas. Gate, guarda 1045, homologação e deploy seguem fechados.

## 2026-11-04 — S166: autorização e replay da classificação PMOC

- `supabase/tests/manual_E01-S166_pmoc_permissoes_retry.sql` passou em banco sintético, com migrations 1614–1642 revertidas ao final: ator divergente, permissão `cadastro.aprovar` revogada, fotografia e revisão obsoletas são recusados; repetição idêntica não duplica classificação/auditoria; payload alterado conflita e replay com permissão revogada é recusado.
- Escopo limitado à classificação de calendário por sessão única; faltam autorização de Visita, aprovação, chamada de OS PMOC e concorrência em sessões separadas. Guardas, homologação e deploy seguem fechados.

## 2026-11-04 — S166: lote e PMOC

- `supabase/tests/manual_E01-S166_pmoc_lote.sql` passou em banco sintético com migrations 1614–1642 e rollback: primeiro ciclo preparado é revertido quando o segundo encontra PMOC sem classificação; após classificação não relacionada, ambos são preparados, sem OS; replay devolve recibo, inclusive após alteração do PMOC.
- Cobertura limitada a lote diário de dois ciclos, sem aprovação, Visita, conciliação de fontes relacionadas, concorrência ou permissões negativas. Gates e guarda 1045 continuam desligados/bloqueados; homologação, deploy e Auvo real não autorizados.

## 2026-11-04 — S166: materialização individual e PMOC

- `supabase/tests/manual_E01-S166_pmoc_materializacao.sql` passou em banco sintético, com migrations 1614–1642 em transação revertida: materialização é recusada enquanto PMOC da data não está classificado; após classificação não relacionada cria uma ocorrência sem OS; replay retorna o mesmo recibo, inclusive depois de mudança no agendamento. A classificação fica obsoleta após essa mudança.
- Evidência cobre somente calendário individual em um cenário; não cobre aprovação, outras versões, lote, Visita, Chamado/OS PMOC, concorrência ou permissões negativas. Gates, guarda 1045, fuso contratual, homologação, deploy e Auvo real seguem bloqueados.

## 2026-11-04 — S166: diagnóstico integrado PMOC/calendário

- `supabase/tests/manual_E01-S166_pmoc_conferencia_ciclo.sql` executou com migrations 1614–1642 em banco sintético e transação revertida. No cenário simples, PMOC sem classificação exige revisão; classificação auditada como não relacionado permite origem Plano; alteração posterior de estado invalida a fotografia e volta a exigir revisão.
- Evidência limitada a um cenário de leitura/classificação: não exercita aprovação, materialização, Visita, lote, Chamado/OS, concorrência, revogação ou replay. Não altera o bloqueio de homologação/deploy nem comprova fontes externas/fuso. Próximo passo: validação dos demais caminhos e reconciliação de casos já existentes.

## 2026-11-04 — S166: guarda inversa na abertura de OS PMOC

- ADR-1499/migration 1642 preparam guarda de nova OS PMOC ou mudança do vínculo para verificar ocorrências de Plano preparadas na mesma data, versão vigente e classificação humana atual; conflito exige reconciliação. Mudanças de status e OS históricas não são alteradas. Gate segue desligado.
- Migrations 1614–1642 compilaram em banco sintético com rollback. Faltam testes funcionais de ambas as ordens de criação, classificação, permissões, isolamento e concorrência com escritores legados, além de impacto operacional. Fontes externas não estão comprovadas; guarda 1045, fuso, revisão adversarial, homologação, deploy e Auvo real seguem bloqueados.

## 2026-11-04 — S165/S166: PMOC nos consumidores legados

- ADR-1498/migration 1641 integram a conferência PMOC da data à guarda de vigência usada por vínculos e materialização legados, entrada/confirmar fila e criação de Chamado. A consulta usa a versão única vigente no vencimento e exige reconciliação para vínculo concorrente ou classificação pendente. Replays e registros anteriores permanecem preservados; gate de origem continua desligado.
- Migrations 1614–1641 compilaram em banco sintético com rollback. Faltam testes funcionais e concorrentes abrangendo consumidores, replays, Chamados/OS existentes, lote e dados históricos. Declaração PCM não comprova fontes externas; guarda 1045, fuso, revisão adversarial, homologação, deploy e Auvo real seguem bloqueados.

## 2026-11-04 — S166: conferência PMOC por Visita

- ADR-1497/migration 1640 integram a guarda de agendamento PMOC da data à preparação por Visita, incluindo data histórica na reutilização. O contexto da classificação mediada (1639) também reconhece Visita regular vigente e exige `visita.confirmar`; a prévia por Visita oferece a conferência. Gate permanece desligado.
- Migrations 1614–1640 compilaram em banco sintético com rollback; typecheck web passou. Testes funcionais e concorrentes seguem pendentes, incluindo lote, alteração de regra e data histórica diferente, que pode exigir reconciliação adicional. Não há comprovação integral de fontes/fuso. Guarda 1045, homologação, deploy e Auvo continuam bloqueados.

## 2026-11-04 — S166: classificação PMOC após aprovação

- ADR-1496/migration 1639 e `ConferenciaPmocCiclo` preparam listagem por data e classificação humana de agendamento relacionado ou não relacionado ao Plano na versão vigente, com evidência, motivo, controle de revisão, fotografia e replay idempotente. A consulta de origem reconhece a classificação; Plano, agendamento e OS permanecem intactos. Agendamento relacionado exige vínculo válido para a versão; erros inequívocos de validação permitem nova conferência. Gate segue desligado.
- Migrations 1614–1639 compilaram em banco sintético, com rollback; typecheck web passou. Faltam testes funcionais de aprovação anterior, PMOC posterior, vigência, vínculo, concorrência, permissões, recuperação e lote; a evidência é humana, não prova fonte externa. Guarda 1045, fuso, revisão adversarial, homologação, deploy e Auvo real continuam bloqueados.

## 2026-11-04 — S166: PMOC da mesma data sem vínculo

- ADR-1495/migration 1638 fazem origem efetiva considerar agendamentos ativos PMOC do Cliente na data. Exige fotografia atual e classificação para a versão aprovada, ou vínculo válido para outra Rotina/alvo; caso contrário a geração de origem Plano fica pendente de conferência. Consultas na tela são invalidadas após classificação. Gate continua desligado.
- Migrations 1614–1638 compilaram em banco sintético, com rollback; typecheck web passou. Falta implementar classificação para versão já aprovada quando um PMOC é criado posteriormente ou a versão inicial não tem inventário. Testar fontes, permissão, histórico, datas, concorrência e rollback; fuso e exclusividade global não comprovados. Guarda 1045, homologação, deploy e Auvo permanecem bloqueados.

## 2026-11-04 — S166: origem efetiva na chamada individual (Codex)

- ADR-1494/migration 1637 conectam a guarda transacional de origem à materialização individual, incluindo reutilização de ocorrência existente, após o replay idempotente. Mesmo gate do lote permanece desligado. Fonte PMOC não mapeada permanece indeterminada; não há prova de exclusividade global.
- Migrations 1614–1637 compilaram juntas em banco sintético com rollback. Faltam testes funcionais de chamada direta, replay, conflito, concorrência, lote e integração com legado. Guarda de aprovação 1045, homologação, deploy e Auvo continuam bloqueados.

## 2026-11-04 — S165/S166: inventário PMOC na revisão (Codex)

- A decisão de impacto PMOC também apresenta a fotografia de origem e rejeita alteração entre leitura e confirmação. Ao receber rejeição inequívoca por revisão ou fotografia obsoleta, a interface permite nova conferência; falha incerta preserva tentativa para replay idempotente.
- A lista identifica imóvel, contrato, período e evidência anterior; a classificação exige que a fotografia confirmada pelo PCM ainda seja a atual sob as travas da transação. Mudanças na cadeia exigem nova conferência.
- ADR-1493/migration 1636 e `InventarioPmocRevisao` preparam inventário de todos os agendamentos PMOC do cliente, inclusive sem vínculo, classificação humana auditada com evidência, fotografia e controle de revisão. A avaliação identifica classificação ausente ou obsoleta, vínculo divergente, cadeia inconsistente e histórico futuro; sob gate de continuidade, bloqueia aprovação com pendências. A tela exige escolha explícita e invalida consultas ao mudar decisões, vínculos ou origem. `VITE_SSO_INVENTARIO_PMOC_REVISAO_ENABLED` e gates ficam desligados. Nenhum agendamento ou OS é alterado.
- Migrations 1614–1636 compilaram juntas em banco sintético, em transação revertida; typecheck web passou. Classificação humana não comprova fonte externa nem exclusividade global. Faltam testes funcionais, concorrência e autorização, inclusive paginação, revisão obsoleta, histórico, vínculos e rollback; validar custo de inventário integral por Plano e locks globais. Guarda 1045, homologação, deploy e Auvo real permanecem bloqueados.
- Próximo passo: integrar fontes PMOC e legado a todos os consumidores e reconciliar coincidências de ciclos com histórico existente; comprovar fuso e fontes antes de validação integrada e revisão adversarial.

## 2026-11-04 — S166: origem efetiva em lote (Codex)

- ADR-1492/migration 1635 e `MaterializarLoteCalendario` preparam conferência de até 31 ciclos por origem. Sob gate de lote e protocolo de concorrência, o núcleo reavalia cada ciclo e reverte o lote inteiro se não for origem Plano; replay já confirmado preserva recibo. Interface compara a prévia com o servidor, bloqueia nova tentativa em pendência/conflito e preserva repetição anterior. Registro de origem ou vínculo invalida as consultas. Gate e `VITE_SSO_ORIGEM_LOTE_ENABLED` ficam desligados.
- Migrations 1614–1635 compilaram juntas em transação revertida no banco sintético; typecheck web passou. Faltam testes funcionais, lote parcialmente preparado/rollback, conflitos PMOC, concorrência de locks e replay; consulta cobre apenas vínculos explicitamente registrados e não prova exclusividade global.
- Próximo passo: concluir reconciliação de fontes PMOC e legadas, integração da decisão de revisão e consumidores, validar fuso/concorrência e revisar adversarialmente antes de habilitar. Guarda 1045, homologação, deploy e Auvo permanecem bloqueados.

## 2026-11-04 — S166: origem efetiva antes de preparar ciclo (Codex)

- ADR-1491/migration 1634 e `MaterializarCicloCanonico` preparam consulta da origem por versão, Rotina, alvo e vencimento. A tela distingue Plano, PMOC vinculado, PMOC pendente, revisão e conflito; não oferece nova preparação SSO quando origem não é Plano e preserva repetição de tentativa prévia. Registro de origem ou vínculo invalida a consulta. `VITE_SSO_ORIGEM_EFETIVA_CICLO_ENABLED` e gates permanecem desligados.
- Migrations 1614–1634 compilaram juntas em transação revertida no banco sintético. Typecheck web passou; faltam testes funcionais, múltiplas versões, conflitos, concorrência e retry. A origem Plano não comprova exclusividade global e agendamentos PMOC sem vínculo continuam indeterminados.
- Próximo passo: concluir reconciliação dos casos de mesma identidade/data, vínculos PMOC não mapeados, demais consumidores e comprovação de fuso; manter guarda geral 1045, homologação e deploy fechados até validação integral e revisão adversarial. Sem Auvo real.

## 2026-11-04 — S165/S166: impactos PMOC na revisão (Codex)

- ADR-1490/migration 1633 e `ImpactoPmocRevisao` preparam listagem e decisões por vínculo PMOC, com fotografia de agendamento, propriedade/contrato, decisão PCM e origem. A avaliação acusa decisões ausentes, obsoletas, reconciliação e vínculo inválido. Ao aprovar, trigger sob gate de continuidade exige impactos conferidos e associa a nova versão aos vínculos mantidos com mesmo alvo/Rotina e vigência; revisões seguintes reconhecem usos anteriores. Nenhum agendamento ou OS é alterado.
- Migrations 1614–1633 compilaram juntas em transação revertida no banco sintético; typecheck web passou. `VITE_SSO_IMPACTO_PMOC_REVISAO_ENABLED` e gates seguem desligados. Não foram executados testes funcionais/concorrentes, rollback da aprovação, revisões sucessivas ou testes de fontes/autorizações; validar consistência das fotografias e locks e executar revisão adversarial.
- Agendamentos sem vínculo continuam indeterminados; falta comprovar exclusividade global PMOC/Plano, resolver reconciliações PMOC e de mesma data, consumidores existentes, fuso e condições integrais de aprovação. Guarda independente 1045, homologação, deploy e Auvo real continuam bloqueados.

## 2026-11-04 — S166: visibilidade e guarda de ciclos PMOC (Codex)

- ADR-1489/migration 1632 e `ObrigacoesPmoc` preparam lista dos vínculos declarados no Plano, com situação do agendamento e marcação de revisão ou conflito. Sob gate de vínculo PMOC, triggers impedem inserir ou alterar identidade de ocorrência por calendário/Visita que coincida com vínculo PMOC histórico; ambos lados usam a mesma trava de identidade. Não altera PMOC, OS ou tarefas.
- Migrations 1630–1632 compilaram em transação revertida no banco sintético; typecheck web passou. `VITE_SSO_OBRIGACOES_PMOC_ENABLED` e gates continuam desligados. Testes funcionais, concorrência nas duas ordens, performance da consulta, permissões e revisão adversarial pendentes. A guarda só cobre vínculos explícitos: não comprova ausência de PMOC não mapeado nem exclusividade global; não integra fila/execução PMOC.
- Próximo passo: integrar consumidores operacionais PMOC e reconciliar ocorrências preexistentes/retiradas, completar fontes e fuso para aprovação, e executar testes integrados antes de qualquer ativação. Guarda 1045, homologação e deploy permanecem bloqueados; sem Auvo real.

## 2026-11-04 — S166: vínculo explícito de ciclo PMOC (Codex)

- ADR-1488/migration 1631 e componente `VinculoCicloPmoc` preparam associação imutável entre proposta, última decisão validada pelo PCM, Rotina/alvo/versão e agendamento. Exigem confirmação humana de alvo e obrigação, evidência, origem PMOC já declarada, data atual, autorização e ausência de ocorrência do Plano na mesma identidade/data, incluindo Visita. Agendamento/OS não são alterados. Vínculo com decisão ou agendamento modificado aparece como precisando de revisão; nova proposta pode substituir vínculo desatualizado sem apagar histórico.
- Migrations 1630/1631 compilaram juntas em transação revertida no banco sintético; typecheck web passou. Gates e `VITE_SSO_VINCULO_CICLO_PMOC_ENABLED` desligados. Não foram executados testes funcionais, concorrência, revogação, revisão posterior, propriedade/contrato ou duplicações. Declaração PCM não comprova fonte externa nem exclusividade global; filas e consumidores PMOC ainda não estão integrados.
- Próximo passo: integrar vínculo PMOC à visualização e aos consumidores da obrigação sem criar ocorrência duplicada; tratar ciclo já existente por reconciliação, fechar inventário de geradores e comprovar concorrência/fuso antes de aprovação. Guarda 1045, homologação, deploy e Auvo real permanecem bloqueados.

## 2026-11-04 — S166: conferência PMOC mediada (Codex)

- ADR-1487/migration 1630 e interfaces preparam diagnóstico, proposta e decisão PMOC por RPCs mediadas; as funções originais eram privadas. A mediação confere sessão, permissões e gates, retém requestId para replay e reconfere data de agendamento antes de nova proposta ou decisão. Interfaces validam páginas e ocultam conteúdo durante revalidação. `VITE_SSO_PMOC_MEDIADO_ENABLED` e gate novos permanecem desligados.
- Migration 1630 compilou em transação revertida em banco sintético e typecheck web passou. Faltam testes funcionais, concorrência, revogação, paginação e revisão adversarial. Proposta e validação PCM ainda não comprovam equivalência de alvo/contrato nem ativam deduplicação; não alterar PMOC nem liberar aprovação com base nelas.
- Próximo passo: construir vínculo comprovável de alvo/contrato, integrar à exclusividade dos geradores e concluir reconciliação de coincidências; manter guarda de aprovação, homologação e deploy fechados. Sem Auvo real.

## 2026-11-04 — S165/S166: resolução de retirada futura (Codex)

- ADR-1486/migration 1629 e interface sob `VITE_SSO_RESOLUCAO_IMPACTO_ENABLED=false` preparam resolução auditada de decisão `exige_reconciliacao` por retirada de geração futura, vinculada à revisão específica. Na aprovação, retirada é selada somente se não anterior à vigência. Avaliação deixa de contar somente decisão resolvida; nova decisão exige nova análise. Guardas existentes bloqueiam novos vínculos/fila/Chamado sem selo de manutenção; OS e histórico não são modificados.
- Migrations 1614–1629 compilaram em sequência em transação revertida no banco sintético; typecheck web passou. Ainda não foram executados testes funcionais ou concorrentes; validar autorizações, revisão e fotos obsoletas, replay, data anterior, ocorrência com OS, fila prévia e todas as portas de geração. A retirada com coincidência de nova regra/data permanece exigindo reconciliação em vez de duplicar. Gate de continuidade, guarda independente de aprovação 1045, homologação e deploy continuam fechados.
- Próximo passo: integrar fontes PMOC e legado com identidade comprovável, resolver coincidência de regra/data sem duplicidade e verificar consumidores/filas já existentes; depois validação integrada e revisão adversarial. Nenhuma ação real no Auvo.

## 2026-11-04 — S165/S166: vigência em legado, fila e Chamado (Codex)

- ADRs 1483–1485/migrations 1626–1628 preparam verificação da versão única vigente no vencimento e do selo de continuidade antes de novos vínculos/materializações legadas, entrada/confirmar fila e criação de Chamado preventivo. Calendário e Visita são cobertos onde há fluxo correspondente. Replays e Chamados existentes preservados; cancelamento de fila permanece disponível. Gate de continuidade desligado mantém comportamento anterior.
- Migrations 1618–1622 e 1625–1628 compilaram juntas em transação revertida no banco sintético. Falta teste funcional e concorrente, inclusive pendências históricas, revisão futura, vigências ausentes/sobrepostas, múltiplas versões, retirada de escopo, rollback e outros escritores. Fonte PMOC/legado e fuso continuam sem prova integral; guarda 1045, homologação e deploy permanecem bloqueados.
- Próximo passo: implementar reconciliação real de decisões `exige_reconciliacao` e seus efeitos futuros sem cancelar OS, completar inventário de geradores/consumidores, prova de PMOC/fuso e validar integração integral antes de revisão adversarial.

## 2026-11-04 — S165/S166: decisão em reutilização de ciclo (Codex)

- ADR-1482/migration 1625 preparam exigência de selo de continuidade ao reutilizar ocorrência de outra versão, inclusive quando a série e regra permanecem iguais. Sem esse ajuste o gerador contornava a decisão de revisão para o caso de série igual. Mesma versão e gate desligado preservam comportamento anterior; falha reverte a transação.
- Migrations 1618–1622 e 1625 compilaram juntas em transação revertida no banco sintético. Não foram executados testes funcionais/concorrentes; validar regras iguais/diferentes, três versões, replay, rejeição e recuperação antes de habilitar. Guarda independente de aprovação, homologação, deploy e Auvo continuam bloqueados.
- Próximo passo: completar reconciliação real de ocorrências cujo impacto exige alteração, PMOC/legado e prova de fontes e fuso; revisar demais caminhos e consumidores para impedir bypass antes da revisão adversarial.

## 2026-11-04 — S165: conferência de fuso das séries (Codex)

- ADR-1481/migration 1624 e prévia de aprovação com `VITE_SSO_CONFERENCIA_FUSO_SERIES_ENABLED` desligada comparam fuso declarado e contrato de referência com séries de Rotinas por Visita vigentes na data proposta. Apontam ausência de vínculo/regra e divergência. Correspondência entre cadastros não comprova fonte contratual externa ou histórico e não libera aprovação; não supor que Plano sem Visitas tenha fuso validado.
- Migration 1614/1624 compilou em transação revertida no banco sintético; typecheck web passou. Validar funcionalmente séries múltiplas, vigências, clientes, concorrência, permissões e impacto dos locks globais. Guarda de aprovação e homologação seguem fechadas.
- Próximo passo: concluir comprovação de fontes PMOC/legado, fuso histórico e tratamento de reconciliação e integrar à aprovação e geração; a guarda 1045 permanece ativa até prova integral e revisão adversarial.

## 2026-11-04 — S166: escolha de origem para Visita (Codex)

- A prévia de ocorrências por Visita agora usa o mesmo componente de declaração de origem por Rotina e alvo já ligado ao calendário; o texto do ciclo canônico reflete a possibilidade preparada de continuidade aprovada. Typecheck web passou; não há teste funcional nem homologação desta ligação. Gate da origem segue fechado.
- Próximo passo: integrar PMOC e Plano por identidade de alvo e vínculo operacional verificáveis, contemplar consumidores legados e provar aprovação/geração sob concorrência; não inferir equivalência apenas por data ou Cliente. Guardas de aprovação, homologação e deploy permanecem fechadas.

## 2026-11-04 — S166: origem de geração declarada (Codex)

- ADR-1480/migration 1623 e interface `OrigemGeracaoRotina` preparam consulta e declaração auditada de origem `plano` ou `pmoc` para Rotina e alvo da versão aprovada. A tabela existente exigida pelo gerador não possuía comando de aplicação; a origem diferente de uma já registrada é recusada e requer transição própria. Não cria ocorrência/OS, não altera PMOC nem comprova exclusividade entre os geradores. Gate e `VITE_SSO_ORIGEM_ROTINA_ENABLED` ficam desligados.
- Migration 1623 compilou em transação revertida no banco sintético; typecheck web passou. Testes funcionais de autorização, replay, concorrência, sessão, associação de alvo e transição não foram executados; avaliar impacto dos demais geradores PMOC/legado antes de ativar.
- Próximo passo: concluir deduplicação efetiva de PMOC e Plano com evidência de identidade e contrato, integração de legado e aprovação de revisão, e testar continuidade para calendário e Visita em três versões. Manter homologação, deploy e Auvo real bloqueados.

## 2026-11-04 — S165/S166: continuidade por Visita e usos entre versões (Codex)

- ADR-1478/migration 1621 preparam selo de decisão de Visita na transação de aprovação; com gate de continuidade ligado, reutilização entre versões exige selo, mesma Visita, Rotina lógica e alvo, preservando data e ocorrência antigas. Avaliação parcial de Visita é conferida antes do selo. Guarda independente de aprovação continua bloqueada.
- ADR-1479/migration 1622 corrigem decisões, listagens, avaliação e selos para incluir ocorrência usada pela versão anterior mesmo quando originada em versão mais antiga. Índices de uso por versão e locks sobre tabelas de uso foram preparados. Gate continua fechado; demais consumidores precisam ser inventariados.
- Migrations 1618–1622 compilaram em sequência no banco sintético, em transação revertida. Não há teste funcional destas mudanças: validar três versões, mudança de regra/dia, concorrência das duas modalidades, rollback, replay, locks e impactos de Grupo. Faltam fontes/consumidores de PMOC/legado, tratamento de decisões de reconciliação, prova integral para aprovação e revisão adversarial; não homologar, publicar nem acionar Auvo real.

## 2026-11-04 — S165/S166: continuidade de ciclo na aprovação (Codex)

- ADR-1477/migration 1620 preparam selo transacional, imutável e opt-in das decisões `manter_sem_alterar` para ocorrências futuras quando a revisão for aprovada; checam revisões e fotografias parciais de calendário/Grupo. Gerador canônico passa a permitir coincidência de data com regra alterada apenas com selo da versão aprovada e identidade do mesmo Plano, Rotina lógica e alvo; reutiliza ciclo e ocorrência existentes. Gate novo fechado por padrão. Guarda independente 1045 continua bloqueando aprovação de revisão.
- Migrations 1618–1620 compilaram juntas em transação revertida no banco sintético; nenhum ensaio funcional ou concorrente desta mudança foi executado. A captura não prova integralidade de fontes nem reconciliação PMOC/legado; consumidores que pressupõem série original e semântica de índices novos precisam de revisão. Testar aprovação, rollback, autorização, repetição, duas sessões, regra alterada e impactos de Grupo antes de habilitar.
- Próximo passo: completar inventário/prova de impacto de Visitas e legado e integrar com a autorização transacional de aprovação sem remover a guarda 1045 até cobertura e testes completos; conferir consumidores da continuidade e casos onde decisão exige reconciliação. Homologação, deploy e Auvo real seguem bloqueados.

## 2026-11-04 — S165/S166: fotografia de efeitos de Grupo (Codex)

- ADR-1476/migration 1619 adicionam complemento imutável à decisão mediada de impacto com Grupo, evidências, intenção, vínculos explícitos, Chamado por ciclo e OS observadas, incluindo outras versões ligadas ao mesmo ciclo. Avaliação compara a última decisão com fontes atuais; tela mostra fotografias ausentes e desatualizadas. Decisões anteriores sem complemento exigem nova decisão, não fotografia retroativa. Alterações de decisão invalidam avaliações relacionadas.
- Migration 1618/1619 compilou em conjunto em transação revertida no banco sintético; typecheck web passou. Testes funcionais de fontes, replay, isolamento Cliente, duplicações, locks globais e corrida permanecem pendentes. Os locks SHARE NOWAIT são globais e requerem medição de carga e revisão adversarial antes de ativação. Gate e flags continuam fechados.
- Próximo passo: conectar avaliação e decisões à aprovação transacional e à geração S166, preservando o trabalho existente. Completar inventário de fontes não fotografadas, PMOC e legado, reconciliação de ciclos distintos e provar concorrência. Fotografia ainda é parcial e não libera aprovação, deploy ou Auvo.

## 2026-11-04 — S165/S166: decisões por ocorrência mediadas (Codex)

- ADR-1475 e migration 1618 preparam mediação autenticada para listar e registrar decisões de impacto de ocorrências de calendário e Visita, cujas RPCs anteriores eram privadas. As telas usam essa mediação, revisam sessão, validam ordenação/paginação e recibos e preservam tentativa idempotente. Gate novo e `VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED` permanecem desligados; não ligam aprovação, geração ou Auvo.
- Migration 1618 compilou em transação revertida no banco sintético isolado. Typecheck web passou; testes funcionais integrados, ordem de locks, replay e autorização precisam ser comprovados antes de habilitar. A decisão atual fotografa pontes legadas e OS, mas não cobre vínculos de OS a Grupos Quantitativos nem todas as fontes/consumidores.
- Próximo passo concreto: integrar os vínculos e efeitos de Grupo e demais origens à fotografia e à avaliação de impacto; depois ligar decisões comprovadas à transição de versão e geração S166, preservando histórico e reconciliando ciclos. As decisões parciais atuais não alteram a geração nem autorizam aprovação; S165/S166 continuam em desenvolvimento.

## 2026-11-04 — Desenvolvimento S165: mediação de revisão (Codex)

- ADRs 1471–1474 e migrations 1614–1617 preparam chamadas mediadas para diagnósticos de revisão, contratos versionados de perguntas/evidências, fotografia de pré-condições e declaração de fuso. Interfaces correspondentes usam as novas RPCs, verificam sessão e rejeitam respostas inconsistentes; os novos gates no banco e quatro flags de interface permanecem desligados. Não conceder acesso direto às funções privadas nem habilitar aprovação de revisão com fontes incompletas.
- `pnpm --filter @sinergica/web typecheck` passou. As quatro migrations compilaram em conjunto em banco sintético dentro de transação revertida; isso não valida seu comportamento, sequência completa ou ambiente real. Nenhuma suíte funcional foi executada nesta rodada, conforme solicitado. Testes de componentes existentes precisarão ser adaptados aos novos contratos e flags.
- S165 ainda não está concluída: faltam cobertura integral e reconciliação de fontes/consumidores de impacto e geração legada (dependências S166/S170/S176 e inventário), AC-5/AC-7 ponta a ponta, concorrência e ordem de locks, autorização/RLS, replay, snapshots e revisão adversarial. Avaliar também ativação conjunta de gates antigos e novos; homologação e deploy continuam bloqueados. Nenhuma tarefa real no Auvo.

## 2026-11-04 — Conferência de OS preexistente S175 (Codex)

- ADR-1470/migration 1613 preparam acompanhamento de OS previamente existentes sem aplicação automática; vinculações novas exigem conferência PCM também para o primeiro evento. Executor apresenta pendência em vez de afirmar aplicação, e prévia informa a regra ao operador. Processamentos históricos sem fotografia continuam pendentes. Gates fechados; sem deploy ou Auvo real.
- `deno check` e typecheck web passaram; migrations 1611–1613 compilaram juntas em transação revertida em banco sintético com versão inicial de 1610. A cadeia final, incluindo a versão final de 1610, ainda não foi testada funcionalmente. Validar atualizações concorrentes, permissões, rastreabilidade, reentregas, contrato de fornecedor e revisão adversarial. Usuário solicitou lista para comandar tarefas individualmente; aguardar a próxima story antes de novo desenvolvimento.

## 2026-11-04 — Reentrega e avanço limitado S175 (Codex)

- Migrations 1611/1612 e ADR-1469 preparam reconhecimento idempotente da reentrega inicial e avanço automático exclusivo de `solicitacao` para `em_execucao` quando evento de campo indica andamento ou conclusão e a OS acompanhada permanece sem edições intermediárias. Não conclui OS, não altera Chamado ou validação PCM e não avança outros estados. A confirmação manual mantém status anterior e valida essa condição no recibo.
- `deno check` passou; definições 1611/1612 compilaram juntas em transação revertida no banco sintético. Fluxo funcional ainda não testado; validar reentregas, gatilhos e efeitos da transição, concorrência com edição/cancelamento, permissão, identidade e contrato real do fornecedor, RLS/FORCE e revisão adversarial antes de habilitar. Gates permanecem fechados; sem deploy ou Auvo real.

## 2026-11-04 — Conferência PCM de evento de campo S175 (Codex)

- ADR-1468/migration 1610 e `VITE_SSO_CONFERENCIA_EVENTO_CAMPO_ENABLED` desligada preparam comparação de campos atuais com último evento aceito, confirmação por operador autorizado com motivo, revisão e ordem, tentativa recuperável e recibo auditado. Revisão ou evento alterado rejeita a decisão; vínculo do técnico é mostrado e reconferido. Confirmação não altera status, Chamado, validação PCM ou detalhes brutos da origem. Serviço e PCM continuam sujeitos aos gates da 1609 e ao novo gate, todos fechados.
- `pnpm --filter @sinergica/web typecheck` passou. Versão inicial da 1610 carregou no banco sintético e as definições finais das duas funções compilaram em transação revertida; conjunto final da migration, UI e fluxo não foram testados. O banco sintético não comprova Auth/Storage oficiais.
- Antes de habilitar, validar mudanças concorrentes de OS, evento, vínculo do técnico, Cliente e contrato, ordem de locks, replay, privacidade, todos os triggers/escritores, RLS/FORCE e revisão adversarial. Executor, gates, homologação e deploy seguem fechados; sem tarefa real Auvo. Prosseguir com demais stories e bateria final.

## 2026-11-04 — Aplicação versionada de evento de origem S175 (Codex)

- ADR-1467 e migration 1609 preparam aplicação idempotente, por serviço e gate inicialmente fechado, de dados declarados de eventos aceitos para OS novas criadas pelo importador. Revisão privada acompanha qualquer atualização da OS; alteração intermediária, Cliente/tarefa divergente, contrato alterado ou OS preexistente bloqueia aplicação e preserva triagem. Não altera status, validação PCM ou Chamado; não solicita tarefa Auvo.
- Executor preparado chama a aplicação somente com `SSO_ORIGEM_CAMPO_APLICAR_EVENTOS_ENABLED=true`; resultado fica explícito e timeout exige repetir mesmo evento. `deno check` da composição passou; versão inicial da 1609 carregou no banco sintético, mas mudanças finais de Cliente/contrato ainda não foram reaplicadas, e nenhum teste funcional/concorrente foi executado. O banco sintético não equivale a Auth/Storage oficiais.
- Faltam validação completa da migration final, todos os escritores de OS e seu impacto nos triggers/locks, concorrência, replay, transição de status e proveniência/contrato real, além de revisão adversarial. Gates, deploy e homologação fechados; próximo passo continuar as stories e executar bateria final.

## 2026-11-04 — Resultado de eventos de origem S175 (Codex)

- O executor preparado agora rejeita recibo incoerente entre reutilização e aplicação inicial; conserva os motivos de triagem do banco. Eventos posteriores aceitos, registrados sem atualização da OS pelo núcleo atual, ficam pendentes com motivo explícito; evento atrasado é identificado como ignorado, e conflitos permanecem pendentes. Isso evita apresentar registro como atualização efetiva.
- Alteração ainda não testada. Faltam aplicação transacional dos eventos aceitos preservando correções PCM e precedência, prova independente do contrato real do fornecedor, proteção contra concorrência/replay e revisão adversarial. Executor e gates permanecem fechados; nenhum processamento real no Auvo. Próximo passo: continuar a implementação das stories antes da bateria final.

## 2026-11-04 — Estados da fila de reconciliação S185 (Codex)

- O painel da fila diferencia pendente, processando, falha e enviado sem confirmação remota; exibe data de envio registrada quando disponível. Páginas de itens fora de ordem/repetidas ou notas repetidas interrompem a apresentação e oferecem reconsulta; seleção em lote é suspensa durante erro/reconsulta e limpa na troca de filtro. Tentativas já guardadas continuam recuperáveis pelo componente responsável.
- Alteração ainda não testada; validar paginação concorrente, seleção, retry, sessão, filtros e acessibilidade na bateria integrada. O painel não comprova efeito remoto nem implementa retentativa externa. Gates, deploy e homologação permanecem fechados; próximo passo é continuar implementação pendente das stories.

## 2026-11-04 — Resultado da criação em lote de Grupos (Codex)

- S176/S178: a incorporação de Grupo com código já estava preparada nas migrations 1405/1406 e respectivas interfaces, sob gates desligados. A seleção em lote agora mostra após confirmação as linhas criadas com nome, quantidade, código informado e ID do Grupo, mantendo o resultado apenas no contexto da tela. O código exibido é o informado no pedido, não uma consulta independente do registro definitivo. A verificação de IDs duplicados também normaliza maiúsculas/minúsculas.
- Alteração de interface ainda não testada; validar resposta perdida, sessão, múltiplas abas, lote e atribuição de código reais na etapa integrada. Não conclui a incorporação nem libera gates/homologação. Próximo passo: continuidade das stories e validação integrada das migrations e permissões. Sem deploy/Auvo real.

## 2026-11-04 — Cancelamento da ingestão de comprovante S180 (Codex)

- A rota preparada de ingestão verifica cancelamento observado após o hash, depois da reserva/recuperação e antes de upload ou confirmação; estado inesperado da reserva não inicia upload. Se o cancelamento ocorre com operação já em voo, a reserva continua sujeita à reconciliação pelo mesmo pedido. A verificação não comprova propagação do cancelamento pelo Edge Runtime nem revoga efeitos já enviados.
- `deno test supabase/functions/pcm-comprovante-ingestao/ingestao-digest.test.ts`: 11 passaram, incluindo cancelamento após reserva e após upload com dependências simuladas. Integração real de Auth/Storage, concorrência, policies compartilhadas e revisão adversarial seguem pendentes; gate fechado, sem deploy ou Auvo real.
- Próximo passo: continuar implementação das stories e investigar policy de upload S180 conforme ADR-0800/0837.

## 2026-11-04 — ACL e concorrência no banco sintético (Codex)

- No container descartável `sso-validacao-isolada-20261104`, a fixture `auth.role()` passou a ler os claims JSON também. Mediação, recuperação e reserva com digest S180 passaram 52 verificações; S168 T-24 passou 18. Com cópias temporárias dos quatro ensaios adaptadas a credencial sintética e TCP interno, concorrência de S166/S177, S168, S173 e S180 passou 50 verificações. Não altera fontes de credenciais nem prova Supabase/Auth real.
- Bateria transacional não manual: 210 arquivos, 2.734 verificações aprovadas e três arquivos com problema. Corrigido teste S178 para usar `matches` do pgTAP instalado (7/7) e ensaio S167 para habilitar a guarda no mesmo rollback da transição (14/14). O ensaio restaurou índice e gate fechado após rollback; não autoriza transição operacional. A bateria inteira não foi repetida após esses ajustes.
- Único problema remanescente identificado nessa bateria: upload direto S180 falha porque policy compartilhada avalia helper S178 sem EXECUTE. Não conceder acesso ou substituir policies sem matriz completa, revisão adversarial e rollout coordenado conforme ADR-0800/0837. Próximo passo: concluir essa análise e a implementação pendente das stories; Auth/Storage oficiais, CI e homologação ainda não comprovados. Cron desligado, nenhum job ativo, fila HTTP e Vault vazios; sem deploy ou tarefa Auvo real.

## 2026-11-04 — Reconstrução e regressão SQL (Codex)

- Banco `sso-validacao-isolada-20261104` reconstruído sem rede, porta, dados reais ou histórico oficial: migrations locais 0001–1608 aplicadas em sequência após corrigir colisão de nome na 1538. `cron.launch_active_jobs=off`, 12 jobs desativados, fila HTTP e Vault vazios; container parado após os testes. Fixture Auth usa claims sintéticos e coluna `email_confirmed_at` artificial; Storage só até script 0046, pois 0047 exige `iceberg_namespaces`. Não prova Supabase/Auth/Storage oficiais.
- S166/S176: 1538 ainda não aplicada oficialmente passou a usar gate `sso_foto_atestado_grupo_mediada_gate` separado do gate S176; teste transacional dos gates 7/7. Testes estruturais S169 de snapshot e fonte passaram 12/12; não satisfazem revisão ou teste integrado exigidos pelo ADR-0888 para ligar UI.
- Bateria transacional não manual inicial: 210 arquivos, 2.509 asserções aprovadas e 27 arquivos com falhas/interrupções. Quatro fixtures históricas receberam os campos de identidade/Grupo já presentes nas suas ocorrências; são dados sintéticos e ainda não comprovam correspondência com o Plano legado. Reexecutados 17 arquivos antes afetados: 14 passaram, três continuam interrompidos por permissão ou conexão entre sessões. A contagem de 27 antecede essa correção e não é resultado final da suíte. Relatório inicial em `/tmp/sso-20261104-db-tests.json`.
- Próximo passo: diagnosticar os arquivos restantes em isolamento, em especial S180 ACL/policies e S168 T-24, além dos testes de concorrência com segunda sessão; confirmar limites do Auth/Storage sintético antes de interpretar falhas. Não conceder privilégios para fazer testes passarem. Continuar implementação pendente das stories; homologação, gates e deploy fechados, sem tarefas reais Auvo.

## 2026-11-04 — Validação integrada em andamento (Codex)

- Retomada autorizada com testes antes do encerramento do desenvolvimento. Banco `sso-validacao-isolada-20261104` criado sem rede ou portas, cron desativado; testado saudável e parado ao fim da sessão, ainda sem migrations do projeto. Não é evidência de integração nem de ACL/Storage oficiais. Container anterior de runtime preservado.
- Checagem de tipos passou nos seis pacotes após correções em interfaces; testes de importação atualizados para exigir prévia e confirmação. Jornada com servidor simulado passou; publicação mediada S183 recebeu três testes de interface para revisão, sessão alterada e preservação de quantidades. Não substituem testes de banco, Auth/RLS, concorrência ou revisão adversarial.
- Suíte web repetida com configuração sintética: 2.409 passaram, zero falharam e 20 ignorados; os três novos testes de publicação passaram em execução separada. Teste de isolamento do Portal passou; graphify atualizado. ADR-1465/1466 e migrations 1607/1608 seguem sem aplicação ou teste integrado. Gates, homologação e deploy continuam bloqueados; nenhuma tarefa real no Auvo.

## 2026-11-01 — Validação isolada do Plano e Caderno (Codex)

- Web: 2.349 testes passaram, nenhum falhou e 20 foram ignorados na rodada completa; nove condicionais de fuso e composição de Local e a leitura das duas fontes XLSX passaram em execuções adicionais. `typecheck` passou. Integrações reais continuam pendentes.
- Banco descartável `sso-teste-db-isolado-20261101`: sem rede nem portas expostas, cron desligado; migrations locais aplicadas após corrigir sintaxe das 1318, 1332, 1342 e 1343. Bateria pgTAP não manual: 202 arquivos, 2.620 verificações, 4 arquivos falharam/interromperam por ACLs de S166/S177 e policy compartilhada de upload S180. Não ampliar permissões nem conectar policy experimental sem rollout coordenado e revisão adversarial. Cinco roteiros manuais S182 passaram em fixture separada parcialmente simulada.
- Próximos passos: reconciliar interfaces e ACLs privadas com rollout seguro, investigar policy de Storage conforme ADR-0800/0837, revisar 465 achados Squawk e 45 problemas do gate de funções, testar Auth/Storage e concorrência reais em ambiente de homologação seguro. Detalhes em `docs/planejamento/plano-manutencao/impedimentos-desenvolvimento.md`. Sem deploy nem acionamento real do Auvo.
- Novos ensaios pgTAP S166/S177 passaram com concessões e gates apenas transitórios: geração, replay, feriado, supressão prévia, código e alias, revogação e bloqueio na ordem em que mudança de autorização começa primeiro. Privilégios foram revertidos; ordem inversa e rollout continuam pendentes.
- S167: ensaio transacional passou 14 verificações para duas OS, replay, Cliente/revisão divergentes e preservação de número/vínculo legado, após remoção temporária do índice e da trigger apenas no banco descartável. Rollback confirmou ambos restaurados e gates fechados. Ensaio de duas sessões passou 17 verificações de criação, replay e revogação concorrentes em cópia descartada. A implementação operacional 1:N permanece bloqueada por migração coordenada, consumidores, concorrência adicional e revisão; os ensaios não autorizam remoção real.
- S180: ensaio reversível de substituir expressões das policies por `CASE` não corrigiu a falta de EXECUTE da S179; a hipótese foi descartada e nenhuma policy ou ACL persistiu alterada. O dispatcher segue experimental, conforme ADR-0800/0837.

## 2026-10-30 — Concorrência e interface isolada S169 (Codex)

- Em PostgreSQL sintético sem TCP, fechamento do gate de cronograma iniciado primeiro bloqueou leitura e, após commit, leitura foi negada; leitura iniciada primeiro segurou fechamento até lock timeout. Leitura segurou a trava de autorização e, com trava exclusiva simulada primeiro, recusou `autorizacao_em_alteracao`. Gates foram fechados e banco parado. Fixture de autorização é simulada: isso não comprova todos os escritores reais, outras capacidades, outras ordens, HTTP/RLS oficial ou ausência de deadlocks.
- Preparado componente isolado para exportação parcial PDF/XLSX, janela de até 366 dias e filtros; cancela tentativa, limpa dados e não baixa arquivo após troca de contexto, mantém edição em erro e impede edição/duplo envio enquanto ocupado. Não está ligado a qualquer tela/rota, conforme ADR-0888; não ativar até integração e revisão. Feriados oficiais, fontes legadas e capacidade seguem ausentes; não é cronograma completo.
- Testes focados atuais 6/6; typecheck e suíte web com configuração sintética passaram (2.213 testes, 20 ignorados); graphify 92515. Sem deploy/Auvo real.

## 2026-10-30 — Revisão adversarial da fonte S169 (Codex)

- `1075_E01-S169_fonte_cronograma_parcial.sql` — alta, reproduzida em banco sintético: RPC devolvia Ocorrência com alvo divergente da fotografia; consumidor recusava, mas chamada direta não. ADR-0891/1076 criam entrada que valida Rotina, modo e alvo antes de devolver a página e revogam execução direta do núcleo; adapter atualizado. Em transação sintética, alvo/Rotina/modo divergentes foram negados, página com segunda linha inválida falhou integralmente, linha válida retornou; ACL observada nova authenticated=true, antiga=false, anon/service_role=false. Nenhum dado oficial modificado.
- Hipóteses abertas, não PASS: dupla leitura pode perder alterações que ocorrem e são revertidas entre requisições; fingerprint não prova autenticidade; índice JSON da fotografia é reconstruído por página e precisa de medição em volume; cobertura de fontes legadas, feriados e capacidade não comprovada. Teste pgTAP estrutural atualizado mas não executado em ambiente oficial; falta concorrência de gates/capacidades, isolamento HTTP real e revisão adversarial completa. Gate/tela/homologação fechados.
- Testes web focados 15/15, typecheck e suíte com configuração sintética passaram (2.207 testes, 20 ignorados); graphify 79159. PostgreSQL sintético parado. Sem deploy ou Auvo.

## 2026-10-30 — Preparação autenticada de cronograma S169 (Codex)

- Conectados snapshot, fonte parcial, filtro por tipo/ID/modo, composição e geradores PDF/XLSX em fluxo que relê todas as páginas e recusa mudanças observáveis na fotografia ou ocorrências antes da entrega. Janela, feriados e filtro são copiados antes de awaits; checa usuário por `auth.getUser` em torno de cada página e ao final. Não garante atomicidade/ausência de troca logo após verificação e não substitui autorização transacional, fontes ausentes ou revisão adversarial. Gate/tela continuam fechados; cronograma declara cobertura desconhecida, não execução.
- Testes focados 16/16 incluem SDK Supabase com transporte simulado, recusa HTTP 403 e alteração observada de identidade; sem banco oficial, HTTP real ou tarefa Auvo. Typecheck e suíte com configuração sintética passaram (2.207 testes, 20 ignorados); graphify 96740. Faltam consistência concorrente real, feriados, fontes legadas, capacidade, auditoria, testes de contrato e revisão adversarial antes de integrar à tela.

## 2026-10-30 — Fonte parcial do cronograma S169 (Codex)

- ADR-0890/migration 1075 preparam RPC por Cliente/Plano/versão/período para ocorrências preparadas de calendário e Visita, paginada por tipo/ID, com gate próprio fechado, `plano.gerir` via 1074 e `visita.confirmar`. Data da Visita usa fuso da própria Visita; cancelamento mantém estado/revisão e retorna data programada nula. Retorna cobertura desconhecida, não execução. A UI não foi conectada e não há liberação operacional.
- Fixture PostgreSQL sintética sem TCP e sem dados reais: ensaios em rollback cobriram gate, Cliente/permissão, cursor, conversão de fuso e cancelamento; erro inicial de `id` ambíguo corrigido antes de qualquer aplicação oficial. Banco sintético parado. Adapter e coletor preparam validação de páginas, fotografia, alvo/modo, estado e ordenação; testes web focados 8/8 com RPC simulada. Faltam testes pgTAP oficiais, consistência de fontes sob alterações concorrentes, outras ocorrências legadas, feriados, demanda e revisão adversarial; não é cronograma completo. Typecheck e suíte com configuração sintética passaram (2.198 testes, 20 ignorados); graphify 6275. Sem deploy/Auvo.

## 2026-10-30 — Composição de cronograma S169 (Codex)

- Preparados composição e geradores PDF/XLSX para fotografia aprovada e ocorrências informadas: baseline usa recorrência ancorada e vigência, feriado de calendário não desloca vencimento; programação informada é linha separada, sem afirmar execução. Rejeita Cliente/Plano/versão/alvo divergente, duplicidade e dados ausentes; Rotinas por Visita não projetadas ficam explícitas. Feriados são somente declarados e cobertura sempre desconhecida, sem inferir 52 visitas, capacidade ou completude. Testes focados 34/34 incluindo calendário legado, PDF e XLSX real.
- Esta composição ainda NÃO recebe fonte operacional real, filtro, autoria/versão de programação nem prova de exclusões/feriados/capacidade; tampouco está ligada à tela. Não é cronograma operacional completo, não satisfaz integralmente AC-6 e não libera gate. Typecheck e suíte com configuração sintética passaram (2.195 testes, 20 ignorados); graphify sessão 11797. Sem deploy ou Auvo real.

## 2026-10-30 — Projeção filtrada e artefatos S169 (Codex)

- Preparados filtros por tipo/ID de alvo e modo sobre fotografia completa; mesma projeção alimenta PDF e XLSX, identifica versão, alvo/Rotina, filtro, fingerprint e tempo a validar, sem cronograma nem capacidade. Caso de uso coleta fotografia, gera arquivo e só o devolve após reler e comparar todas as páginas. Testes com RPC/gateway simulados cobrem alteração durante geração; não provam autorização/concorrência real, auditoria nem integração da tela. Continuação depende da revisão e testes integrados do ADR-0888; gate fechado.
- Corrigida quebra de linhas no helper PDF compartilhado: palavra longa podia perder caracteres; teste reproduziu 88 de 200 antes da correção. Agora preserva partes e considera largura da fonte; testes focados 23/23, incluindo PDF real e XLSX. Typecheck e suíte com configuração sintética passaram (2.190 testes, 20 ignorados); graphify sessão 56627. Sem deploy ou Auvo real.

## 2026-10-30 — Identidade do alvo da fotografia S169 (Codex)

- A RPC 1073 aceitava objeto `alvo` diferente do vínculo funcional na Rotina: teste sintético reproduziu. ADR-0889/migration 1074 preparam entrada que valida todas as Rotinas da fotografia, exige exatamente um vínculo e corresponde tipo/ID; execução autenticada direta da 1073 é revogada e adapter atualizado, exigindo rollout coordenado. Dados existentes não são alterados. Gate continua fechado e tela não ligada à RPC.
- PostgreSQL local sem TCP, fixture de auth/config: consulta com alvo divergente e com dois vínculos rejeitadas, alvo válido retornado; grants observados authenticated nova=true, antiga=false, anon/service_role nova=false. Ambiente parado; ensaio foi em rollback. Testes focados web 8/8, typecheck e suíte com configuração sintética passaram (2.183 testes, 20 ignorados); graphify atualizado. Falta teste pgTAP oficial de comportamento (há teste estrutural), concorrência de revogação/gate e revisão adversarial. Não homologar ou fazer deploy.

## 2026-10-30 — Consumidor da fotografia S169 (Codex)

- Preparados caso de uso e adapter da RPC 1073: páginas de 100 com cancelamento, validação de tipos/identidade, quantidade/posição, fingerprint, metadados e duplicidade; reconferência refaz todas as páginas e compara o conteúdo, não só hash. Teto de 1.048.575 Rotinas corresponde ao limite de linhas XLSX menos cabeçalho. Testes focados 7/7 com gateway/RPC simulados. Código ainda não está ligado à tela conforme ADR-0888; falta integração real, paginação em Supabase, rechecagem em corrida, autorização/gate e revisão adversarial.
- Typecheck passou; suíte web com configuração sintética passou 2.182 testes, 20 ignorados. Graphify em sessão 93673. Gates e homologação permanecem fechados; sem deploy ou tarefas Auvo.

## 2026-10-30 — Fotografia paginada S169 (Codex)

- ADR-0888/migration 1073 preparam leitura paginada de campos selecionados do snapshot aprovado, com gate novo desligado, sessão/capacidade/Cliente/versão, trava compartilhada de autorização e gate, limite de 100, identidade única e fingerprint para detectar alteração entre páginas. Não expõe JSON bruto de questionários ou custos. A interface ainda NÃO consome esta RPC; validação de todos os tipos/recorrência e integridade referencial, projeção para PDF/XLSX, filtros, capacidade, cronograma, auditoria e concorrência continuam pendentes. Não habilitar gate/homologação/deploy.
- Em PostgreSQL sintético local, sem rede TCP e com funções auth/config substituídas por fixtures, migration foi aplicada, teste inicial de existência falhou antes e passou depois. Ensaios em rollback cobriram gate, permissão, outro Cliente, paginação, nome/alvo da fotografia, não exposição de questionário, limite, duplicata e alvo inválido. Não substituem pgTAP oficial, RLS/HTTP reais, concorrência ou revisão adversarial. Script estrutural pgTAP adicionado, ainda não executado; ambiente sintético está parado em `/tmp/sso-s169-pg.dpUjY8l5` e não tem dados reais. Graphify sessão 17396.

## 2026-10-30 — XLSX experimental S169 (Codex)

- A versão consultada agora pode ser gerada em XLSX real com `write-excel-file` 4.1.1 local, sem CDN e sem leitura de arquivo externo. CSV/XLSX compartilham linhas tipadas; XLSX guarda texto com aparência de fórmula como texto. UI adicionada sob `VITE_SSO_EXPORTAR_PLANO_XLSX_ENABLED`, desligada por padrão, e repete checagem de autorização antes do download. Não habilitar em produção: conferência atual compara metadados/contagem, não conteúdo do snapshot; exportação filtrada, cronograma, capacidade opcional e integração transacional ainda faltam. Não considerar T009–T016 concluídas.
- Teste de domínio inspeciona arquivo OOXML/ZIP, incluindo ausência de fórmula; testes de interface cobrem mistura de versão, revogação e download com mocks: 10/10. Typecheck e suíte web com variáveis sintéticas passaram (2.175 testes, 20 ignorados); build passou tanto padrão quanto com as duas flags de exportação ligadas e gerou chunk separado XLSX. Build alerta chunk principal acima de 500 kB; graphify atualizado. `pnpm audit --prod` reportou seis advisories em Vite e Zod, nenhum em `write-excel-file` ou `fflate`; não se trata de aprovação de segurança ou revisão adversarial.

## 2026-10-30 — Exportação CSV S169 e ambiente de diagnóstico (Codex)

- CSV experimental da versão aprovada agora registra Cliente, versão e vigência, filtro, ausência de capacidade, dados de Rotinas e tempos a validar; células potencialmente interpretadas como fórmula recebem proteção e versão sem Rotinas mantém todas as colunas. Testes focados 5/5; não é XLSX nem cronograma, e a comparação de metadados não comprova conteúdo do snapshot. XLSX, filtros, capacidade opcional e dados operacionais seguem pendentes.
- Typecheck passou. Suíte web sem variáveis de ambiente falhou em 12 arquivos; os erros exibidos incluíram ausência de URL/chave Supabase. Com URL local e chave sintética, suíte passou 2.170 testes, 20 ignorados; graphify atualizado. Não é teste de integração com banco nem comprova que os itens ignorados passaram.
- Por autorização de Lucas, Colima foi apagado e recriado vazio: o container sintético `sso-diagnostico-isolado-20261030c` e sua imagem foram removidos sem recuperação pelo Colima. Os resultados históricos abaixo permanecem evidências dos ensaios, não estado atual do banco. Para novos testes SQL é preciso recriar fixture isolada e aplicar migrations; nenhum banco oficial foi alterado. Gates e homologação permanecem fechados; sem deploy ou tarefas reais Auvo.

## 2026-10-30 — Identidade da exportação de Plano S169 (Codex)

- A exportação experimental já existente produz PDF e CSV, não XLSX ou cronograma operacional. Antes, poderia receber Plano/versão/Rotinas incompatíveis ou repetidas e ainda passar pela conferência de quantidade. Agora PDF/CSV exigem Cliente do Plano, versão aprovada do mesmo Plano e Rotinas distintas ligadas à mesma versão/Plano; inconsistente bloqueia botões. Regra de domínio e interface passaram testes focados; comparação não comprova que conteúdo ou paginação refletem snapshot íntegro nem substitui autorização no servidor.
- A biblioteca XLSX legada carrega código de CDN e consta como SEC-008; não foi usada para nova importação/exportação sem análise. Continuam pendentes XLSX seguro, cronograma real, filtros e capacidade opcional, fotografia conferível, autorização/concorrência e integração de S169/S165/S166/S178. Suíte web e typecheck pendentes desta alteração; gates e homologação fechados, sem deploy ou Auvo.

## 2026-10-30 — Limpeza da tentativa na conversão integral S167 (Codex)

- Após confirmação da OS, a conversão comparava a tentativa salva antes de aguardar a atualização de cache, mas apagava sem nova conferência depois; uma tentativa substituta podia ser perdida nesse intervalo. Teste reproduziu a perda. Antes da limpeza agora reconfere o pedido após os efeitos assíncronos; divergência ou armazenamento ilegível preservam o registro e informam que a OS já foi confirmada. 16 testes focados passaram com gateway simulado; não prova coordenação cross-tab ou operação real.
- Typecheck e graphify em sessões 47305/11137; suíte anterior segue na sessão 85160 e não cobre necessariamente esta última alteração. Continuar múltiplas OS, escopo e revisão da SPEC_DEVIATION; gates e homologação fechados, sem deploy/Auvo.

## 2026-10-30 — Tentativas de gestão de escopo S167 (Codex)

- Gestão de parcelas/continuidade não conferia tentativa no retry e apagava incondicionalmente o armazenamento após resposta. Agora confere antes do envio e remoção, invalida consultas após sucesso e serializa envio na instância; o componente já era isolado por usuário/Cliente/Chamado. Teste reproduziu retry inseguro; testes de substituição e resposta tardia passaram junto aos de transição: 14/14 com RPC simulada. Não prova idempotência/autorização no servidor nem coordenação cross-tab.
- Suíte anterior passou 2.159 testes, 20 ignorados; typecheck dessa rodada passou. Typecheck e graphify da alteração atual estão em execução nas sessões 54518/59350. Próximo passo: continuidade e fechamento integral de S167, reconciliação da SPEC_DEVIATION e demais stories; gates/homologação fechados, sem deploy/Auvo real.

## 2026-10-30 — Tentativas das transições de Chamado S167 (Codex)

- Encerrar, cancelar e reabrir Chamado sobrescreviam tentativa salva em retry e podiam apagar outra tentativa após resposta tardia. Agora verificam a tentativa antes de enviar/remover, recusam sobrescrita, serializam envios na instância, invalidam consultas após sucesso e isolam estado por usuário/Cliente/Chamado. Testes reproduziram as três falhas; 12 testes focados passaram, cobrindo as três ações e retry idêntico com RPC simulada. Isso não substitui idempotência, autorização, concorrência cross-tab ou integração real no servidor.
- Typecheck, suíte web e graphify em andamento nas sessões 4707, 6905 e 57310. Próximo passo: completar fluxos S167/escopo e demais stories; gates e homologação bloqueados, sem deploy/Auvo real.

## 2026-10-30 — Leitura de escopo S172 (Codex)

- Consulta antiga retornou OS durante revogação concorrente de `execucao.validar` em banco sintético. ADR-0887/migration 1072 preparam entrada volátil com trava da autorização e dos gates de escopo/origem; núcleo anterior fica privado e adapter usa nova entrada. 1072 aplicada persistentemente apenas no container diagnóstico; banco/UI exigem rollout coordenado.
- Guarda passou 4/4 após falhar 4/4, e dois scripts SQL de escopo passaram 19/19 em rollback; dois testes web focados e typecheck passaram. Revogação iniciada primeiro fez nova consulta negar `autorizacao_em_alteracao`. Gates fechados após ensaio, cron off, jobs ativos/fila HTTP/Vault vazios. Suíte web anterior passou 2.150 testes com 20 ignorados; nova suíte e graphify em sessões 69536/74649.
- Faltam ordem inversa, gates/autorizações alternativas, ACL/HTTP oficiais e revisão adversarial; escopo é declarativo e não prova execução. Continuação das stories, homologação e deploy pendentes; sem Auvo real.

## 2026-10-30 — Leitura individual de esforço S172 (Codex)

- Reproduzida em banco sintético leitura de esforço de OS durante revogação em andamento. ADR-0886/migration 1071 preparam entrada serializada única para OS, ocorrência de calendário e ocorrência de Visita, fechando execução direta dos dois núcleos; adapter usa novo contrato. 1071 aplicada persistentemente apenas no container diagnóstico. Gate fechado após ensaio; sem deploy oficial.
- Teste de privilégios passou 5/5 depois de falhar 5/5; testes SQL dos três tipos passaram 27/27 em rollback; adapter/UI 10 testes focados e typecheck passaram. Revogação primeiro fez nova entrada retornar `autorizacao_em_alteracao`; falta ordem inversa, concorrência de gate/outras fontes, ACL/HTTP oficiais e revisão adversarial. Cron off, zero jobs ativos, fila HTTP/Vault vazios. Suíte web e graphify em sessões 50995 e 92701.
- Próximo passo: validar concorrência restante, outras leituras diretas e completar fontes/simulação e demais stories. Gates e homologação fechados; sem deploy ou Auvo real.

## 2026-10-30 — Concorrência das fontes paginadas S172 (Codex)

- No container sintético, transação que consultou as três fontes segurou revogação e quatro fechamentos de gate; todos atingiram lock timeout. Fechamento do gate de esforço iniciado primeiro fez as leituras aguardarem: demanda continuou disponível por não exigir esse gate; esforço e ocorrências retornaram seus respectivos erros de gate fechado. Gates foram fechados após ensaio; cron off, jobs ativos/fila HTTP/Vault vazios. Teste de privilégios ampliado passou 12/12, incluindo anônimo e authenticated.
- Suíte web passou 2.148 testes, com 20 ignorados; graphify atualizado. Evidência não cobre cada gate em ambas ordens, outros escritores de autorização, HTTP/ACL oficiais ou condições de deadlock; revisão adversarial e integração de capacidade real seguem pendentes. Sem deploy/homologação/Auvo real.

## 2026-10-30 — Guarda das fontes paginadas S172 (Codex)

- ADR-0885/migration 1070 preparam três entradas serializadas para fontes de demanda, esforço e ocorrências sem OS, com READ COMMITTED, trava de autorização e gates, mantendo núcleos estáveis privados e formato/paginação. UI usa entradas novas; rollout banco/UI coordenado. 1070 aplicada persistentemente apenas no container diagnóstico, nunca no banco oficial.
- Teste de privilégios passou 6/6 após falhar 6/6; fontes e snapshots passaram 85/85 em rollback com 1070 e 1055–1068 sobre 1069 no diagnóstico; 16 testes web focados e typecheck passaram. Revogação de `capacidade.gerir` iniciada primeiro fez as três entradas recusarem `autorizacao_em_alteracao`; revogação revertida e quatro gates fechados. Cron off, zero jobs ativos, fila HTTP e Vault vazios. Suíte e graphify em execução, sessões 76081 e 52806.
- Faltam ensaios da ordem inversa, fechamento de cada gate, outras capacidades/fontes de autorização, ACL/HTTP oficiais e revisão adversarial. Snapshot e fontes continuam incompletos, sem saldo operacional. Gates/homologação/deploy fechados; nenhum envio Auvo.

## 2026-10-30 — Guarda do snapshot S172 (Codex)

- ADR-0884/migration 1069 preparam entrada volátil serializada para as cinco versões do snapshot, travando autorização e gates obrigatórios/opcionais antes dos núcleos estáveis; EXECUTE direto dos núcleos é revogado para authenticated. UI usa nova RPC e informa versão; rollout banco/UI deve ser coordenado. Gates não foram abertos fora do diagnóstico. A 1069 foi aplicada persistentemente apenas no container sintético `sso-diagnostico-isolado-20261030c`, não no banco oficial.
- Teste de privilégios/guarda passou 5/5 após falhar 5/5; cinco scripts de snapshot passaram 54/54 com 1055–1069 em rollback; 15 testes web focados e typecheck passaram. Com dados sintéticos, revogação iniciada primeiro fez nova RPC recusar `autorizacao_em_alteracao`; leitura iniciada primeiro segurou revogação e fechamento do gate, ambos com lock timeout. Fechamento iniciado primeiro fez a leitura aguardar e depois retornar `demanda_capacidade_bloqueada`. Gates do ensaio foram fechados; cron off, zero jobs ativos, fila HTTP/Vault vazios. Suíte web e graphify em execução nas sessões 23669 e 95650.
- Não prova todos os escritores/gates, todas as fontes de autorização, ausência de deadlocks, ACL/HTTP oficiais ou capacidade completa; falta revisão adversarial, testes adicionais e liberação coordenada. Algumas consultas antigas diretas fora dos snapshots ainda precisam ser inventariadas. Sem deploy, homologação ou Auvo real.

## 2026-10-30 — Corrida de autorização no snapshot S172 (Codex)

- No container sintético sem rede, com fixture própria e gates abertos somente para ensaio, uma transação iniciou revogação de `capacidade.gerir` e manteve-a aberta; consulta concorrente à RPC estável `sso_mediar_snapshot_capacidade` retornou dados enquanto a transação de revogação ainda estava ativa. A revogação foi revertida; quatro gates do ensaio fechados novamente. Cron off, zero jobs ativos, fila HTTP/Vault vazios. Fixture sintética permanece no container; não há dados reais.
- ADR-0884 propõe entrada serializada e rollout coordenado. Novo teste `E01-S172_snapshot_autorizacao_serializada.test.sql` falhou 5/5 antes da implementação, como esperado: função nova ausente, funções anteriores ainda concedidas e falta de guarda volátil. Nenhuma correção aplicada ainda. Próximo passo: implementar migration aditiva, atualizar consumidor e testes das cinco versões, provar concorrência/gates nas duas ordens e manter homologação fechada. Isso não prova completude da capacidade ou HTTP/ACL oficiais; sem deploy/Auvo real.

## 2026-10-30 — Limite da simulação integrada S172 (Codex)

- Verificado contrato AC-4–AC-6 contra `SnapshotCapacidade` e RPCs 0990/0992/0994/0999: o retorno atual declara `completude: desconhecida`, limita cada fonte a 100 e não estabelece execução restante, sobreposição ou composição da equipe. `TransicaoVisita` exibe duas consultas independentes; `simularRemanejamento` ainda não recebe fotografia completa/autorizada. Ligar o cálculo existente a esses valores como saldo atenderia apenas visualmente à spec e produziria números sem cobertura comprovada; não foi feito.
- Próximo passo: desenhar e implementar fotografia transacional com cobertura e revisões verificáveis, incluindo fontes de demanda, disponibilidade, execução e equipe; confirmação de alertas deve ser auditada no comando. Gates e homologação fechados, sem deploy/Auvo. Até essa integração, AC-4–AC-6 permanecem abertos.

## 2026-10-30 — Ocorrência de outro Cliente no teste S172 (Codex)

- Fixture de capacidade agora inclui Plano, versão, Sistema, Rotina e ocorrência reais do Cliente B, além da OS B. Teste verifica existência e vínculo dos dois alvos antes de exigir negação ao ator do Cliente A; sete scripts passaram 85/85 verificações com savepoints e rollback. Isso exercita o escopo dos comandos testados, não prova autorização oficial HTTP/RLS nem demais caminhos ou concorrência.
- Próximo passo: integrar capacidade a fontes completas e comandos, completar outras stories e ensaiar autorização real. Banco sintético sem rede e sem cron; gates/homologação bloqueados, sem deploy/Auvo real.

## 2026-10-30 — Finalização e segundo Cliente S172 (Codex)

- Teste de prova de finalização S172 agora reutiliza a fixture real sintética de finalização S168, com IDs coerentes e rollback próprio; passou 9/9 após antes falhar por fixture ausente. A fixture S172 de snapshot inclui Cliente B e OS B reais, sem concessão ao ator A; 83/83 verificações de sete scripts e 13/13 do snapshot passaram em rollback após a mudança. A ocorrência B ainda é identificador inexistente nos casos negativos, portanto não prova isolamento de ocorrência real; não comprova ACL/HTTP oficiais ou concorrência.
- Banco permanece sem rede, cron off, zero jobs ativos, fila HTTP e Vault vazios; nenhuma migration posterior a 1054 persistida. Próximo passo: completar fixture da ocorrência do Cliente B, validar integrações e prosseguir stories. Gates, homologação e deploy fechados; nenhum Auvo real.

## 2026-10-30 — Fontes S172 com fixture isolada (Codex)

- Sete scripts de esforço, mediação, projeção, ocorrências, escopo e OS sem Visita passaram 83/83 verificações com fixture sintética e savepoints; cada script agora inclui a fixture em sua própria transação e passou individualmente com 1055–1068 em rollback. Alguns casos negativos usam identificadores de Cliente inexistentes: não comprovam isolamento com dois Clientes reais.
- O oitavo script, prova de finalização, parou com `sem_acesso` porque precisa de concessão e retorno/finalização adicionais ausentes da fixture; permanece pendente, não tratado como PASS. Próximo passo: preparar fixture de finalização real sintética e executar o teste, além das demais integrações. Banco sem rede/cron; gates e homologação fechados, sem deploy ou Auvo real.

## 2026-10-30 — Fixture autocontida do snapshot S172 (Codex)

- `E01-S172_snapshot_capacidade.test.sql` dependia de registros ausentes e falhava em `alvo_de_concessao_indisponivel`. Adicionada fixture sintética derivada da S168 com identidades próprias, incluída pelo teste em transação revertida. Com 1055–1068 aplicadas na mesma transação, o teste autocontido passou 13/13; primeira execução sem fixture falhou. Teste continua diagnóstico, não prova cobertura operacional ou Supabase oficial.
- Confirmados no container isolado: launcher cron off, zero jobs ativos, fila HTTP/Vault vazios e função da 1068 não persistida após rollback. Próximo passo: validar demais fixtures dependentes, integrações/concorrência e concluir stories. Gates/homologação fechados, sem deploy ou Auvo real.

## 2026-10-30 — Banco diagnóstico restaurado até 1054 (Codex)

- No container `sso-diagnostico-isolado-20261030c`, cópias diagnósticas 0001–0956 e migrations 0957–1054 aplicadas; Storage sintético até 0046, auth.jwt/auth.uid adaptadas à fixture. Sem rede, sem portas, cron desativado, 12 jobs desativados, fila HTTP e Vault vazios. Não representa bootstrap, ACL ou HTTP oficiais, nem histórico oficial de migrations.
- Em transações revertidas, sequência 1055–1068 com cinco scripts S171 passou 74/74; dois scripts independentes S172 passaram 23/23. Um ensaio adicional do snapshot S172 falhou por fixture compartilhada ausente (`alvo_de_concessao_indisponivel`), não concluído: localizar e preparar dependência antes de reutilizá-lo. Primeira tentativa S171 também falhou porque auth.uid da imagem não lia claims; após ajuste sintético, passou. Nenhuma dessas alterações foi aplicada fora do container.
- Próximo passo: continuar testes integrados e concorrência com fixtures completas, avançar implementação das stories; gates e homologação fechados, sem deploy nem Auvo real.

## 2026-10-30 — Bootstrap parcial do banco sintético (Codex)

- Container diagnóstico `sso-diagnostico-isolado-20261030c` está sem rede, sem portas publicadas e com `cron.launch_active_jobs=off`; auth.jwt é fixture. Aplicadas cópias diagnósticas 0001–0062, Storage sintético 0001–0046 com `storage.install_roles=false`, e retomada a partir de 0063. A execução das cópias até 0956 está em andamento na sessão 66309; conferir o resultado antes de continuar, sem reiniciar a sequência cegamente. Não é instalação oficial nem prova de ACL/HTTP; cron contém jobs, mas o launcher está desligado.
- Suíte web após consolidação: 2.148 passaram, 20 ignorados; graphify atualizado. Próximo passo: concluir bootstrap, desativar jobs, conferir fila HTTP e Vault vazios, continuar migrations posteriores e testes em rollback. Gates/homologação fechados, nenhum deploy ou Auvo real.

## 2026-10-30 — Reinício do banco de diagnóstico (Codex)

- Após limpeza autorizada, imagem PostgreSQL Supabase foi baixada e container sintético `sso-diagnostico-isolado-20261030c` criado saudável com `--network none`, sem portas publicadas e `cron.launch_active_jobs=off`. Não contém banco de projeto, migrations ou dados reais; `cron.job` ainda não existe. Há cópia diagnóstica antiga até 0956 em `/private/tmp/sso-sequencia.OW9mFQ/supabase/migrations`, que deve ser inspecionada antes de reuso; não é histórico oficial nem prova de bootstrap Supabase.
- Próximo passo: estabelecer bootstrap sintético, aplicar cópias históricas somente ao banco isolado, verificar erros e gates antes de executar testes. Não ligar cron nem rede, não importar dados reais; homologação e deploy seguem bloqueados.
- Suíte web anterior passou 2.148 testes, com 20 ignorados; typecheck passou antes da última alteração de consolidação. Nova suíte/typecheck estão em execução.

## 2026-10-30 — Deduplicação de esforço por UUID (Codex)

- S172: consolidação de esforço contava duas vezes a mesma OS/ocorrência quando UUIDs variavam em caixa. Teste reproduziu 140 minutos em vez de 70; agora normaliza apenas o UUID final dos identificadores com namespace, preservando a distinção entre tipos. Treze testes de domínio passaram. Não comprova cobertura, cálculo de esforço restante ou capacidade efetiva.
- Próximo passo: integrar simulação a fontes autorizadas e completas, testar conflitos e comandos com justificativa; reconstruir banco de diagnóstico isolado. Suíte/typecheck em execução; gates e homologação fechados, sem deploy ou Auvo real.

## 2026-10-30 — Identidades no snapshot de capacidade (Codex)

- S172: o snapshot somava disponibilidade duplicada quando o mesmo UUID de técnico chegava em caixas distintas. Teste reproduziu a duplicação; validação reutiliza a comparação UUID já usada na capacidade por técnico também para disponibilidades e vínculos. Quinze testes focados passaram. Dados continuam parciais e declarativos, não saldo operacional; fontes, integração, ACL e concorrência seguem pendentes.
- Suíte web anterior passou 2.145 testes e ignorou 20, com typecheck aprovado; nova suíte/typecheck estão em execução. Homologação/gates bloqueados; sem deploy ou envio ao Auvo.

## 2026-10-30 — Isolamento da triagem (Codex)

- S171: triagem agora reinicializa estado ao mudar usuário ou Cliente, preservando a tentativa do contexto original. Teste reproduziu estado antigo e passou para troca e retorno de ambos os contextos; quatro testes focados passaram. Servidor continua responsável por autorização, idempotência e concorrência entre sessões.
- A suíte anterior à proteção de repetição passou 2.144 testes e ignorou 20; verificações posteriores estão em execução. Integração completa, gates, homologação e deploy permanecem pendentes; nenhum Auvo real.

## 2026-10-30 — Repetição da triagem (Codex)

- S171: triagem confere tentativa persistida antes de enviar ou repetir e usa trava local para evitar envios simultâneos na mesma instância; divergência preserva a tentativa. Três testes focados passaram com RPC simulada. Trava local não coordena abas/sessões e não substitui idempotência e autorização do servidor; essas condições ainda exigem prova integrada.
- Suíte web e typecheck da alteração estão em andamento. Próximo passo: terminar integração das Visitas e demais stories; gates e homologação fechados, sem deploy nem Auvo real.

## 2026-10-30 — Preservação da triagem concorrente (Codex)

- S171: resposta de triagem atrasada apagava outra tentativa que tivesse substituído a salva durante o envio; teste reproduziu a perda. O sucesso agora invalida consultas e só remove a tentativa se ela continuar idêntica à enviada, informando divergência sem apagar o novo registro. Dois testes focados passaram com RPC simulada; não prova coordenação cross-tab ou sessão real.
- Rodada anterior: 2.143 testes web passaram, 20 ignorados; typecheck passou. Após esta alteração, suíte e typecheck seguem em execução. Próximos passos: proteger repetição e concorrência da triagem e implementar demais fluxos; homologação e gates fechados, sem deploy/Auvo real.

## 2026-10-30 — Proteção de repetição de intenção (Codex)

- S171: repetição da intenção de OS enviada agora confere se a tentativa salva ainda é idêntica antes de enviar; mudança ou indisponibilidade do armazenamento impedem o envio e preservam o registro. Teste reproduziu envio anterior de uma tentativa desatualizada e passou após correção. Essa conferência local não é trava cross-tab e não substitui autorização e idempotência no servidor.
- Na rodada anterior, suíte web passou 2.142 testes, com 20 ignorados, e typecheck passou; após esta alteração, suíte e typecheck estão em execução. Homologação, gates e deploy permanecem bloqueados; sem Auvo real.

## 2026-10-30 — Isolamento das tentativas de OS enviada (Codex)

- S171: telas de intenção e transferência mantinham estado do usuário anterior ao trocar usuário ou Cliente sem desmontagem; teste reproduziu a exposição do botão de repetição. Componentes agora reinicializam o estado para cada par usuário/Cliente, sem apagar as tentativas salvas de outros contextos. Teste cobre troca de usuário, retorno e troca de Cliente nas duas telas. Isso não substitui autorização no servidor nem prova comportamento de mudança de sessão durante mutação em trânsito.
- Gates e homologação permanecem fechados. Próximo passo: proteger e validar concorrência de autenticação, tentativas e todos os escritores, completar reconciliação e outras stories; reconstruir banco isolado sem rede para SQL. Sem deploy ou envio real ao Auvo.

## 2026-10-30 — Identidade da tarefa e limpeza do diagnóstico (Codex)

- S171: ADR-0883 e migration 1068 acrescentam consulta da identidade local da tarefa, confirmação da identidade esperada e revogação do acesso direto à transferência anterior. Tela exibe a identidade como texto e exige a mesma identidade na execução; isso não consulta nem comprova o estado remoto no Auvo. Tentativas locais antigas sem identidade esperada não são repetidas automaticamente. Migration não implantada; gates continuam fechados.
- No clone diagnóstico sintético, duas transferências concorrentes da mesma OS resultaram em uma transferência e uma revisão obsoleta. Antes da correção, mudança concorrente da tarefa era aceita silenciosamente; após 1068, a transferência aguardou e recusou a identidade alterada, preservando vínculo e sem criar intenção. Com migrations 1055–1068 aplicadas antes dos testes em transação revertida, cinco scripts S171 passaram 74/74 verificações. Ambiente usava ACL/auth sintéticos e não comprova HTTP, ACL oficiais ou cobertura de todos os escritores; alteração seguida de retorno ao mesmo identificador não é detectada por comparação de valor.
- Suíte web com configuração sintética: 2.140 testes passaram e 20 foram ignorados; typecheck passou. Isso não substitui integração real nem homologação.
- Por autorização do usuário, Colima anterior foi apagado e recriado vazio. Banco diagnóstico e clone sintéticos, imagens e evidências persistidas neles foram removidos; não são recuperáveis. Colima ativo, sem containers, imagens ou volumes, aproximadamente 16 GiB livres. Para testes SQL adicionais, reconstruir ambiente isolado sem secrets, cron ou rede externa; não restaurar dados reais automaticamente.
- Próximo passo: completar implementação das stories e validar fontes/concorrência, identidade e reconciliação real em ambiente apropriado. Homologação, gates e deploy bloqueados; nenhum envio real ao Auvo.

## 2026-10-30 — Transferência local de OS enviada (Codex)

- S171: ADR-0882 e migration 1067 preparam comando transacional que encerra vínculo anterior, cria novo vínculo da mesma OS no destino, atualiza revisões, invalida confirmação de Visita confirmada, preserva tarefa Auvo e grava intenção pendente, auditoria e resultado idempotente juntos. Recusa destino de outro Cliente, revisão divergente, OS encerrada/sem tarefa identificada e destino com efeito remoto identificado. Reusa guarda da 1065 e trava os gates de intenção e transferência, ambos fechados por padrão. Tela separada sob `VITE_SSO_TRANSFERENCIA_OS_ENVIADA_ENABLED` explica que tarefa remota não foi alterada; armazena request para retry sem substituí-lo. Nenhuma migration aplicada persistentemente.
- 21 verificações SQL no diagnóstico cobrem gates, transferência, replay, revogação sequencial, vínculo único, tarefa preservada, intenção/auditoria únicas, ausência de enfileiramento HTTP e rollback após colisão. Na sequência 1055–1067, quatro scripts S171 passaram 66/66 em transação revertida. Sete testes focados e typecheck passaram; suíte web 2.140 passaram e 20 ignorados com configuração sintética; graphify atualizado. Testes de UI com RPC simulada não comprovam integração real.
- Faltam concorrência de todos os escritores de Visita, OS e vínculos, ordem de locks, snapshot e identidade Auvo, capacidade/alertas, reconciliação efetiva, HTTP/ACL oficiais, CI e revisão adversarial. A trava de composição é condicional ao gate respectivo e não comprova cobertura global. Não abrir gates ou homologar; sem deploy/Auvo real. Próximo passo: testes de concorrência e efeitos com fixtures sintéticas, conectar reconciliação segura e continuar demais stories.

## 2026-10-30 — Triagem mediada da intenção de OS (Codex)

- S171: ADR-0881/migration 1066 e tela preparam triagem, lista e histórico mediados sobre a guarda da 1065, com exigência das duas capacidades nos núcleos e gate fechado. Duas consultas privadas tinham `id` ambíguo no gate; 1066 qualifica a referência sem liberar os núcleos. Em rollback, 16 verificações passaram para gate, ambas capacidades, Cliente divergente com permissões próprias, replay, auditoria/histórico e vínculo preservado. Sequência 1055–1066 e três scripts S171 passou 45/45 em transação revertida. Seis testes focados e typecheck passaram; suíte web 2.139 passaram e 20 ignorados com configuração sintética; graphify atualizado. Anotação é declaração, não conciliação, e não altera tarefa nem move OS.
- SQL usa bootstrap diagnóstico, não prova ACL/HTTP oficiais, concorrência com revogação/gate ou todos os escritores. A UI continua experimental; integração efetiva e confirmação de identidade externa não existem. Próximo passo: corrigir proteção de tentativa local e invalidação da triagem, provar concorrência das duas capacidades e completar conciliação efetiva e demais stories. Gates fechados; sem deploy ou Auvo real.

## 2026-10-30 — Intenção mediada de OS enviada e concorrência de Visita (Codex)

- S171: ADR-0880/migration 1065 preparam criação e listagem mediadas da intenção de OS enviada, com gate fechado, READ COMMITTED, trava de autorização e releitura do gate. Núcleos permanecem privados; tela usa mediadoras. Corrigida ambiguidade de `id` na função privada de listagem. A intenção não move OS nem altera tarefa Auvo. SQL 12/12 em rollback, inclusive Cliente divergente, replay, revogação e vínculo preservado; junto com 1055–1064, os testes S171 passaram 29/29. Cinco testes web focados e typecheck passaram; suíte web 2.138 passaram e 20 ignorados com configuração sintética; graphify atualizado. Faltam mediação de triagem/histórico, conciliação real, concorrência, ACL/HTTP oficiais e revisão adversarial; não implantar/ativar.
- S171/1064: no banco descartável `sso_s171_transicao_prova` restaurado sem ACL e sem cron/net, com grant de fixture e gate aberto só nele, revogação iniciada primeiro fez transição retornar `autorizacao_em_alteracao`, e depois do commit negou acesso. Transição aberta primeiro bloqueou revogação e fechamento do gate com `lock_timeout=500ms`. Fechamento primeiro fez transição esperar e retornar `transicao_visita_bloqueada`. Ensaio de transição foi revertido: revisão 1, zero histórico, gate do clone fechado. Não prova ACL/HTTP reais, outros escritores ou ausência de efeitos externos por caminhos diferentes. Banco principal mantém gate fechado, cron desligado, jobs desativados e fila HTTP vazia.
- Próximo passo: mediar triagem e histórico com as duas capacidades exigidas, implementar conciliação efetiva sem duplicar efeitos e comprovar fontes/concorrência; continuar S172 e demais stories. Nenhum deploy ou tarefa real no Auvo.

## 2026-10-30 — Transição mediada de Visita (Codex)

- S171: tela chamava núcleo privado 0409 sem EXECUTE para authenticated. ADR-0879 e migration 1064 preparam entrada autenticada com READ COMMITTED, trava compartilhada de autorização, trava/releitura do gate e núcleo privado; tela usa a mediadora. Gate permanece fechado e migration não foi aplicada persistentemente. SQL em rollback passou 17/17 isolada e após 1055–1063: Cliente diferente, capacidade de cancelar ausente, efeito remoto, revisão, replay, histórico e revogação sequencial. Teste detectou falso conflito entre fusos; mediadora usa UTC somente durante a execução e preserva fuso da sessão. Pedidos históricos privilegiados criados em outro fuso exigem inventário antes de rollout. Testes web focados 45 passaram/3 ignorados; typecheck passou; suíte web 2.137 passaram/20 ignorados com configuração sintética; graphify atualizado.
- Faltam concorrência com gate/revogação e demais fontes/escritores, provas HTTP/ACL oficial, alertas de capacidade, reprogramação de OS já enviada e revisão adversarial. O comando local recusa efeito remoto; não significa reprogramação remota nem AC completo. Próximo passo: ensaiar ambas as ordens de disputa em banco descartável isolado, completar fontes/alertas e continuar demais stories; nenhuma homologação, deploy ou envio Auvo.

## 2026-10-30 — Contexto de capacidade ao reprogramar Visita (Codex)

- S171/S172: tela experimental de transição apresenta snapshots parciais de origem e destino no fuso da Visita, reutilizando a consulta existente; mesma semana usa apenas um snapshot e cancelar oculta o contexto. A UI informa que consultas são independentes, não simulam transferência e não comprovam saldo, equipe ou disponibilidade. Somente quando `VITE_SSO_SNAPSHOT_CAPACIDADE_ENABLED` e `VITE_SSO_COMPARACAO_CAPACIDADE_VISITA_ENABLED` forem verdadeiros e houver permissão. Teste de UI reproduziu ausência da comparação antes; 55 testes focados passaram e três foram ignorados; typecheck passou. Suíte web passou 2.137 testes e ignorou 20 com configuração sintética.
- Não é simulação integrada, não verifica baseline individual de ocorrência, não confirma alertas nem cobre autorização/concorrência reais. Snapshot tem cobertura desconhecida e não deve ser ativado em produção ou tratado como saldo operacional. Próximo passo: fontes completas e fotografia transacional de origem/destino, confirmação auditada e comando de reprogramação. Gates, deploy e homologação continuam fechados; sem Auvo real.

## 2026-10-30 — Retomada do Storage e proteção da transição de Visita (Codex)

- Storage no diagnóstico: o erro 0047 ocorria por `search_path`; scripts 0047–0062 da imagem foram aplicados com `storage,public,extensions` após as migrations do projeto. O ensaio adaptado para o container atual passou 55/55 para seis buckets e revogação sequencial em rollback; matriz experimental 5/5, 52 combinações. Não comprova instalação oficial, ordem real de migrations, Storage HTTP, concorrência ou correção da corrida de ACL já registrada. Cron e jobs desligados, fila HTTP/Vault vazios e zero objetos persistidos.
- S171: reprogramação/cancelamento de Visita atualiza cache após sucesso antes de limpar a tentativa, preserva outra tentativa que apareça durante o envio, recusa repetir tentativa diferente e serializa envio na mesma instância. Teste reproduziu a exclusão indevida antes da correção; dois testes novos e 41 do Workspace passaram, três ignorados. Typecheck passou após ajuste no teste; suíte web passou 2.135, 20 ignorados com configuração sintética. Graphify atualizado. `sessionStorage` não é coordenação transacional cross-tab; o comando do servidor mantém responsabilidade por autorização, revisão e idempotência. Sem deploy/Auvo; homologação fechada.
- Próximo passo: completar remanejamento com fontes S172 e comando auditado S171, investigar corrida de ACL e validar sequência oficial do Storage antes de liberação; continuar demais stories sem abrir gates.

## 2026-10-30 — Reconstrução diagnóstica e sequência de migrations (Codex)

- Após a limpeza autorizada do Colima, reconstruído `sso-diagnostico-isolado-20261030b` em rede interna sem portas publicadas e sem secrets. Aplicadas cópias diagnósticas locais até 0961, com correções históricas apenas nessas cópias, e migrations 0962–1054 sem histórico oficial. Storage parcialmente inicializado: scripts da imagem pararam em 0047 por `iceberg_namespaces` ausente; auth usa funções sintéticas. A 0002 precisou ser retomada após criação de `auth.jwt()` na fixture. Isso não é bootstrap Supabase oficial ou comprovação de Storage/ACL reais.
- Migrations 1055–1063 foram aplicadas juntas apenas dentro de uma transação revertida. Oito scripts S165/S167/S172/S179 executados em savepoints passaram 109/109 verificações pgTAP. Após rollback, mediadora 1058 ausente e índice legado de Chamado presente. `cron.launch_active_jobs=off`, 12 jobs desativados, fila HTTP e Vault vazios; nenhum deploy ou disparo Auvo real. Teste combinado não comprova execução isolada de migrations pelo runner, HTTP, revisão adversarial ou homologação.
- Um primeiro container de diagnóstico recém-criado foi removido após erro de configuração; container temporário usado para copiar scripts Storage também foi removido. Sem dados de usuário nesses containers. Imagens Postgres e Storage foram baixadas novamente; espaço livre após reconstrução aproximadamente 13 GiB. Próximo passo: validar bootstrap oficial/Storage e concorrência das fontes e prosseguir integração da capacidade S172 e demais stories; gates continuam fechados.

## 2026-10-30 — Cálculo de remanejamento (Codex)

- S172: iniciada regra pura de simulação por semana: preserva baseline de vencimento, usa programação quando informada, compara antes/depois sem mover demanda na mesma semana e sinaliza sobrecarga, incompatibilidade de equipe ou dados de equipe não verificados. Dados incompletos não geram saldo; fotografia divergente e retirada maior que demanda são recusadas. A regra usa cobertura fornecida pelo chamador: ela não prova cobertura nem autorização. Testes focados 22/22 e typecheck passaram; suíte web 2.133 passaram, 20 ignorados com configuração sintética.
- A regra ainda não está ligada a fontes completas, tela ou comando auditado; AC-4/5/6 e tasks T009–T013 permanecem abertos. Próximo passo: integrar snapshot autorizado e versionado de origem/destino quando cobertura/identidade/concorrência estiverem comprovadas, apresentar alertas e persistir confirmação com justificativa; não usar as fontes parciais como saldo operacional. Colima recriado vazio, reconstrução isolada necessária para testes SQL. Gates e homologação fechados, sem deploy ou Auvo.

## 2026-10-30 — Identidade na capacidade por técnico (Codex)

- S172: UUIDs de técnico em caixas diferentes geravam linhas separadas, e UUIDs de participação duplicados podiam ser contados duas vezes. A consolidação compara UUIDs sem distinção de caixa, preserva o identificador exibido e rejeita duplicidades equivalentes; identificadores não UUID mantêm comparação exata. Dois testes reproduziram as falhas; oito testes focados de domínio e interface e typecheck passaram. Suíte web: 2.127 passaram e 20 ignorados com URL e chave sintéticas; sem essas variáveis, 12 suítes falharam ao inicializar por configuração ausente. Graphify atualizado. Isso não comprova cobertura das fontes ou saldo operacional.
- O Colima foi recriado vazio após limpeza autorizada: bancos diagnósticos e imagens foram removidos. Para retomar testes SQL, reconstruir ambiente isolado com cron e rede externa desabilitados; não usar dados reais. Homologação e deploy continuam bloqueados; sem Auvo real. Próximo passo: integrar fontes confiáveis de capacidade e validar cenários completos de S172 e demais stories.

## 2026-10-30 — Identidade do pedido de pré-condições (Codex)

- S165: tela de fotografia de impacto impedia nem sobrescrita de tentativa divergente nem duplo envio; testes reproduziram ambos. Agora serializa envio na tela, preserva pedido guardado diferente antes e após confirmação, atualiza histórico confirmado antes da limpeza e oculta histórico durante revalidação/erro, com retry da página. Oito testes focados e typecheck passaram com gateway simulado. sessionStorage não garante coordenação cross-tab ou durabilidade entre sessões; servidor continua responsável por idempotência e autorização. Aprovação segue bloqueada; sem deploy/Auvo.

## 2026-10-30 — Revalidação da prévia de aprovação (Codex)

- S165: prévia de aprovação mantinha dados de versão e vigência em cache durante revalidação ou erro de acesso. Teste reproduziu exposição; agora a interface oculta a prévia enquanto consulta ou falha. Seis testes focados de prévia/impactos/OS e typecheck passaram com gateway simulado. Aprovação de revisão continua bloqueada até comprovar fontes, fuso e concorrência; sem deploy/Auvo.

## 2026-10-30 — Trava de impacto de Visita com linhas reais (Codex)

- S165: no clone `sso_s167_resumo_os`, com FKs/triggers ativos e gate de concorrência habilitado somente no clone, três INSERTs sintéticos de ciclo, vínculo de versão e decisão foram recusados sob trava global ocupada; com trava livre, os mesmos três INSERTs passaram em transação revertida. Um vínculo real inserido em transação aberta segurou a trava contra outra sessão. Roteiros em `supabase/manual-tests/E01-S165_fontes_visita_linhas_reais.sql` e `E01-S165_fontes_visita_linhas_livres.sql`; fixture usa linhas de `E01-S172_esforco_visita_fks_reais.sql` e ciclo sintético `16598200-0000-4000-8000-000000000001`. Gate do clone foi fechado.
- Teste de trigger com dados não comprova comando canônico ou decisão operacional válida, inventário completo, ACL oficial ou aprovação de revisão; essa permanece bloqueada por impacto/fuso não comprovados. Clone sem ACL real permanece isolado e contém outbox sintético anterior não despachado. Sem deploy ou Auvo.

## 2026-10-30 — Esforço zero na base de capacidade (Codex)

- S172: `consultarResumoCapacidade` tratava demanda com esforço interno zero como estimativa completa e podia devolver saldo. Conforme AC-3, zero agora conta como demanda sem estimativa e impede saldo; teste reproduziu falha antes. 27 testes focados de aplicação/domínio/snapshot e typecheck passaram com gateways simulados. Não há fonte completa integrada que comprove saldo operacional; gates fechados, sem deploy/Auvo.

## 2026-10-30 — Conflito de origens no esforço declarado (Codex)

- S172: consolidação agora compara o conjunto de origens secundárias ao deduplicar a mesma OS. Antes, duas linhas com mesma origem principal e aliases secundários divergentes eram somadas; teste reproduziu a falha. Agora a OS é excluída do subtotal e marcada conflitante; aliases equivalentes em ordem diferente são aceitos. 21 testes focados de domínio/Fontes/Snapshot e typecheck passaram. Não comprova cobertura ou saldo operacional; gates fechados, sem deploy/Auvo.

## 2026-10-30 — Semana e revalidação do snapshot de capacidade (Codex)

- S172: snapshot agora rejeita OS sem Visita cuja data de referência seja inválida ou fora da semana selecionada, evitando somar esforço de outra semana. Oculta também dados anteriores durante revalidação de acesso. Dois testes reproduziram as falhas antes das correções; 14 testes focados de snapshot/agenda e typecheck passaram. Gateway simulado; dados seguem declarativos e incompletos, não saldo operacional ou comprovação de execução. Gates fechados, sem deploy/Auvo.

## 2026-10-30 — Validação de página da agenda do técnico (Codex)

- S172: a interface rejeita alocações fora da semana civil, datas inválidas e cursor repetido/regressivo; aceita domingo na virada de ano. Dois testes reproduziram respostas incorretas antes da mudança; 12 testes focados de agenda/snapshot e typecheck passaram. Erro oculta páginas anteriores e permite retry; não substitui segurança do servidor nem comprova saldo/execução. Gates fechados; sem deploy ou Auvo.

## 2026-10-30 — Gate concorrente da agenda do técnico (Codex)

- S172: no clone diagnóstico sem ACL real, consulta aberta com 1063 segurou revogação e fechamento do gate; ambos atingiram `lock timeout` em ensaio de 1 segundo. Fechamento iniciado primeiro fez a consulta aguardar e retornar `agenda_capacidade_bloqueada`; gate permaneceu fechado ao final. Testes pgTAP ampliados para 14/14 em rollback, incluindo ACL da guarda e acesso direto negado ao gate.
- Não comprova HTTP, ACL oficial, todas as fontes de autorização, saldo ou revisão adversarial. Outbox sintético criado pela fixture anterior permanece apenas no clone isolado; sem deploy ou Auvo. 1063 permanece não implantada.

## 2026-10-30 — Autorização concorrente da agenda do técnico (Codex)

- S172: em clone diagnóstico sem ACL real, revogação de `capacidade.gerir` em andamento não impedia leitura da agenda pela 1054. ADR-0878 e migration 1063 preparam guarda serializada com gate, READ COMMITTED e trava de autorização, preservando SECURITY INVOKER e RLS nativa. Após 1063 no clone, leitura durante revogação retornou `autorizacao_em_alteracao` e, após commit, `sem_acesso`; gate do clone foi fechado. No diagnóstico principal, 12/12 pgTAP passaram em rollback; antes, dois testes de guarda/volatilidade falhavam.
- A fixture de funcionário gerou registro sintético no outbox do clone, sem segredo e sem rede externa; não foi disparado. Banco principal diagnóstico mantém cron desligado, jobs desativados e fila HTTP vazia. Não comprova concorrência do gate, demais fontes de autorização, HTTP/ACL oficiais, saldo real ou revisão adversarial. 1063 não aplicada fora do clone/rollback; sem deploy ou Auvo.

## 2026-10-30 — Revogação na agenda do técnico (Codex)

- S172: teste reproduziu que agenda já carregada continuava visível após erro de acesso na próxima página. A interface oculta dados durante revalidação/erro e repete a página que falhou, preservando cursor; teste de revogação simulada e retry passou. Dez testes focados de agenda/snapshot e typecheck passaram; RPC simulada, não prova autorização no servidor ou capacidade real. Saldo operacional, fontes completas e revisão adversarial seguem pendentes; gates fechados, sem deploy/Auvo.

## 2026-10-30 — Isolamento de materiais na criação de orçamento (Codex)

- S179/S181: criação de orçamento valida OS, tamanho e cursor ordenado de cada página de listas; falha fechada oculta opções anteriores e impede seleção quando a página é inconsistente ou a autorização é negada. Ajustada fixture de paginação para respeitar ordem UUID real. Dois testes reproduziram falhas antes da correção; oito testes focados de criação/dispensa e typecheck passaram. Gateway simulado; não prova autorização oficial nem integração completa. Sem deploy/Auvo; homologação bloqueada.

## 2026-10-30 — Isolamento visual na dispensa de orçamento (Codex)

- S179/S181: teste reproduziu que a tela de dispensa exibia opção de outra OS se a resposta fosse inconsistente. A página agora valida OS, limite e ordem do cursor e oculta opções em erro, inclusive páginas anteriores após negação na página seguinte; UUIDs equivalentes em caixa diferente são aceitos. Quatro testes focados de dispensa passaram; antes, cinco testes focados de dispensa/criação e typecheck passaram após o ajuste. São testes com gateway simulado, não prova de ACL real.
- A tela de criação de orçamento ainda filtra respostas divergentes em vez de rejeitar a página; revisar comportamento e paginação. Demais gates, integração e homologação permanecem bloqueados. Sem deploy ou Auvo.

## 2026-10-30 — Listagem mediada por OS no PCM e Comercial (Codex)

- S179/S181: ADR-0877 e migration 1062 preparam leitura mediada por Cliente/OS, gate fechado e trava de autorização; núcleo 0322 passa a privado. Adapter PCM e telas de criação/dispensa no Comercial chamam a mediadora. UUID de OS é comparado sem distinção de maiúsculas. Revogação do núcleo interromperia clientes antigos: não implantar sem inventário e rollout coordenado.
- Nove pgTAP passaram em transação revertida para gate, paginação, Cliente/OS divergente, limites, ACL e revogação sequencial; 12 testes web focados e typecheck passaram. Faltam concorrência, HTTP/ACL oficiais, revisão adversarial e demais comandos/leituras. Nenhum deploy ou Auvo; gates e homologação fechados.

## 2026-10-30 — Atualização de disponibilidade após confirmação (Codex)

- S179: `DisponibilidadeMateriais` agora invalida lista, histórico e Central após confirmação no servidor, antes de limpar pedido no sessionStorage. Teste reproduziu que falha na limpeza antes impedia toda atualização; depois passou e preservou o retry com o mesmo pedido. Sete testes web focados e typecheck passaram; gateway simulado não comprova integração oficial.
- Suspensão/reprogramação efetiva da mesma OS e reconciliação de tarefa Auvo seguem não implementadas/validadas; registrar exceção não suspende OS. Demais gates e homologação permanecem fechados; sem deploy ou Auvo.

## 2026-10-30 — Eventos mediados de materiais (Codex)

- S179: ADR-0876 e migration 1061 preparam entrada mediada para disponibilidade informativa e exceções, com gate fechado, READ COMMITTED e trava de autorização; núcleo 0328 passa a privado e mantém revisão, histórico, idempotência e auditoria. Adapter conectado sem fallback. Exceção não altera OS automaticamente nem confirma presença física. Não implantar sem inventário e rollout coordenado: clientes antigos chamam o núcleo.
- Dez verificações pgTAP passaram em transação revertida, incluindo gate, disponibilidade, exceção, histórico, revisão e OS inalterada; falha inicial demonstrou ausência da mediadora. Dezoito testes web focados e typecheck passaram. Pendentes concorrência de revogação/gate, HTTP/ACL oficiais, outros comandos, suspensão/reprogramação efetiva e revisão adversarial. Sem deploy ou Auvo.

## 2026-10-30 — Edição mediada de materiais (Codex)

- S179: ADR-0875 e migration 1060 preparam edição versionada com gate fechado, READ COMMITTED e trava de autorização; núcleo 0325 mantém validação de evidência, revisão, idempotência, texto original e auditoria, mas passa a ser privado. Adapter chama apenas mediadora. Não aplicar sem inventário e rollout coordenado: versões antigas que chamam o núcleo seriam interrompidas.
- Ensaio mostrou ausência da função antes e 9/9 pgTAP passaram em transação revertida após alteração. Doze testes web focados e typecheck passaram. Faltam concorrência de gate/revogação, ACL/HTTP oficiais, integração de outros comandos e revisão adversarial. Gates fechados; sem deploy ou Auvo.

## 2026-10-30 — Concorrência da criação de materiais (Codex)

- S179: em clone diagnóstico sem ACL real e com gate aberto apenas no clone, revogação real primeiro fez criação concorrente retornar `autorizacao_em_alteracao`; depois do commit, a criação foi negada, sem lista, comando ou auditoria. Na ordem inversa, criação aberta bloqueou revogação e fechamento do gate, que atingiram `lock timeout` em ensaio de 1 segundo. Fechamento do gate iniciado primeiro fez criação aguardar e retornar `criacao_materiais_bloqueada`; gate do clone ficou fechado.
- Teste transacional ampliado para 11/11 pgTAP, cobrindo evento único e retry após revogação sem revelar resultado. Ainda faltam integração HTTP/ACL oficial, fontes alternativas de autorização, outros comandos, rollout coordenado de clientes antigos e revisão adversarial. Migrations não implantadas; sem deploy ou Auvo.

## 2026-10-30 — Criação mediada de listas de materiais (Codex)

- S179: ADR-0874 e migration 1059 preparam entrada de criação autenticada, gate próprio fechado, READ COMMITTED e serialização com fontes de autorização; núcleo de 0322 conserva idempotência, vínculo e auditoria e passa a ser privado. Adapter usa apenas a mediadora. Migration não aplicada fora de transação diagnóstica: revogação do núcleo quebra versões/clientes antigos, exigindo inventário e rollout coordenado antes de implantação.
- 8/8 pgTAP em rollback passaram para gate, criação, replay, payload divergente, Cliente não autorizado e ACL; teste confirmou ausência da mediadora antes da mudança. Dez testes web focados e typecheck passaram. Falta concorrência com revogação/gate, integração HTTP/ACL oficial, mediação de outras RPCs e revisão adversarial. Gates fechados, sem deploy ou Auvo.

## 2026-10-30 — Concorrência da Central de Materiais (Codex)

- S179: em clone diagnóstico sem ACL real, com 1058 aplicada e gate ligado apenas no clone, uma revogação real de concessão em transação produziu `autorizacao_em_alteracao` na consulta concorrente; após commit, a consulta foi negada. Fechamento do gate iniciado primeiro fez a consulta aguardar e retornar `central_materiais_bloqueada`. Na ordem inversa, consulta aberta segurou a revogação e o fechamento do gate, ambos com `lock timeout` em ensaio de 1 segundo. O gate do clone foi fechado ao final.
- Cenários usam Cliente, usuário e lista sintéticos; não provam HTTP, ACL oficial, todas fontes de autorização nem caminhos antigos de materiais. A migration 1058 permanece ausente do banco diagnóstico principal; cron desligado, jobs desativados, fila HTTP vazia. Continuam pendentes revisão adversarial e homologação; sem deploy ou Auvo.

## 2026-10-30 — Consulta mediada da Central de Materiais (Codex)

- S179: ADR-0873 e migration 1058 preparam entrada autenticada para consulta da Central, com gate próprio fechado, READ COMMITTED, trava compartilhada de autorização, releitura do gate e núcleo 0355 privado. O adapter passou a usar a mediadora sem fallback. Migration ensaiada apenas em transação revertida; não foi implantada nem habilitada.
- 10/10 pgTAP passaram no diagnóstico para gate, filtros, Cliente permitido/negado, limite, ACL e revogação sequencial. Testes reproduziram ausência da função antes da mudança. Adapter e Central: 8 testes focados passaram, incluindo troca para a RPC mediada; typecheck passou. Falta prova de concorrência de gate/revogação, jornada HTTP/ACL oficial, demais caminhos de materiais e revisão adversarial. Nenhum deploy ou Auvo; homologação permanece bloqueada.

## 2026-10-30 — Filtro de OS na Central de Materiais (Codex)

- S179: filtro por UUID de OS em maiúsculas era aceito na entrada, mas a página válida retornada pelo banco em minúsculas era recusada. Teste reproduziu a falha; comparação do adapter agora normaliza ambos UUIDs, mantendo rejeição de OS diferente. Sete testes focados de adapter e Central passaram; typecheck web passou. Gateway foi simulado; não comprova ACL ou integração real, e story continua aberta. Sem deploy ou Auvo.

## 2026-10-30 — Concorrência entre escopo e criação de OS (Codex)

- S167: em clone diagnóstico sem ACL real, execução privada do comando canônico `adicionar_parcela` segurou o Chamado; conversão concorrente aguardou e rejeitou revisão 1 após a alteração de escopo confirmar revisão 3. Na ordem inversa, criação de OS confirmou revisão 4 e o comando de escopo aguardou e rejeitou sua revisão 3. Resultado final: duas OS, uma parcela e nenhum comando rejeitado persistido. Ensaio usa usuário/cliente sintéticos e grants de fixture, não demonstra ACL/HTTP oficiais.
- Incluídas três verificações de regressão sequencial no ensaio transacional: primeira OS, alteração canônica de escopo e rejeição da revisão anterior. 44/44 pgTAP passaram em rollback com 1056/1057. Outros escritores e ações de escopo ainda não foram cobertos; SPEC_DEVIATION, estabilidade de `xmin`, Storage/ACL oficiais, CI e revisão adversarial continuam pendentes. Gates fechados; sem deploy ou Auvo.

## 2026-10-30 — Concorrência com resumo da OS (Codex)

- Em clone diagnóstico `sso_s167_resumo_os`, sem ACL real e com barreiras/gates ajustados só nele, três sessões concorrentes com fusos UTC, America/Sao_Paulo e Asia/Tokyo partiram da revisão 1 e criaram três OS distintas, com revisões 2, 3 e 4. Retry idêntico devolveu a revisão original e não criou duplicata; três comandos guardaram SHA-256 sem cópia da linha. Edição concorrente de OS primeiro fez a próxima conversão aguardar e depois retornar `revisao_obsoleta`.
- `VACUUM (FREEZE, DISABLE_PAGE_SKIPPING)` no clone preservou o `xmin` de uma OS observada; é apenas um ensaio, não prova estabilidade após restauração, outras versões ou wraparound. Permanecem testes de concorrência de escopo, reconciliação formal da SPEC_DEVIATION, ACL/Storage oficiais, CI e revisão adversarial. Banco principal diagnóstico mantém cron desligado, jobs desativados e fila HTTP vazia. Sem deploy ou Auvo; homologação bloqueada.

## 2026-10-30 — Minimização da fotografia de OS (Codex)

- S167: ADR-0872 substitui retenção integral prevista na ADR-0870 por SHA-256 da linha serializada em UTC mais `xmin`, na migration 1057 ainda não aplicada. O teste demonstrou antes a duplicação de conteúdo e ausência de resumo; após a mudança, 41/41 verificações passaram em transação revertida no banco diagnóstico, incluindo edição da OS, fusos, fotografia ausente e formato anterior. O hash não é criptografia e não elimina risco de inferência.
- Continuam pendentes teste concorrente em sessões separadas com novo formato, ciclo de vida de `xmin`, concorrência das fontes de escopo, reconciliação da SPEC_DEVIATION, ACL/Storage reais, CI e revisão adversarial. Gates fechados; sem deploy ou Auvo.

## 2026-10-30 — Fuso na conciliação de OS (Codex)

- S167: reproduzido conflito falso na 1057 com criação em UTC e segunda solicitação no fuso America/Sao_Paulo: a fotografia JSON serializava timestamps conforme a sessão. ADR-0871 e migration 1057 ainda não aplicada fixam UTC apenas na função de conversão e no verificador privado, preservando o fuso do chamador. Teste falhou antes e passou depois; 37/37 verificações pgTAP em transação revertida no diagnóstico. Não comprova ACL/HTTP reais nem homologação.
- Inspeção do comando canônico de escopo em 1027 mostra lock e atualização da revisão do Chamado; no diagnóstico, authenticated e service_role não têm escrita direta nas três tabelas de escopo/continuação. Isso não prova ausência de outros escritores privilegiados nem concorrência de todas as fontes. Permanecem revisão da fotografia integral e de `xmin`, reconciliação da SPEC_DEVIATION, Storage oficial, testes completos e revisão adversarial. Gates fechados, sem deploy ou Auvo.

## 2026-10-30 — Reconstrução e concorrência da OS (Codex)

- Banco diagnóstico `sso_diagnostico_reconstrucao_5` recriado em rede interna, sem porta publicada e sem credenciais reais; `cron.launch_active_jobs=off`, jobs desativados e fila HTTP vazia. Copiadas migrations diagnósticas até 0961 e aplicadas 0962–1054, sem histórico oficial; fixture de `auth.jwt()`/`auth.uid()`. Inicialização dos scripts Storage parou em `iceberg_namespaces`; ambiente parcial não prova bootstrap oficial ou testes de Storage.
- S167: 1056/1057 em transação revertida passaram 34/34 verificações. Em clone isolado sem ACL real, edição de OS segurou sua trava enquanto conversão concorrente aguardava; após confirmação da edição, conversão retornou `revisao_obsoleta`. A inversa já havia mostrado que conversão aberta bloqueia edição. Nada foi aplicado fora do diagnóstico.
- Pendentes: revisar minimização da fotografia integral privada, estabilidade de `xmin` e concorrência das tabelas de escopo; conciliar `SPEC_DEVIATION`, reconstruir Storage oficial e validar ACL, CI e revisão adversarial. Não abrir gates ou homologar. Configuração Docker temporária foi usada para baixar imagens porque helper `docker-credential-desktop` não existe; espaço livre ficou em cerca de 13 GiB.

## 2026-10-30 — Fotografia de OS e limpeza do ambiente (Codex)

- S167: a migration 1057, ainda não aplicada em ambiente oficial, passou a guardar fotografia integral privada e `xmin` da OS no comando de criação; a conciliação compara ambos após travar as OS existentes. O teste de edição posterior da OS falhou antes da proteção e passou depois; 34/34 verificações pgTAP passaram em transação revertida. A solução ainda exige revisão de minimização de dados, estabilidade de `xmin`, ordem dos locks, concorrência de escopo e reconciliação da `SPEC_DEVIATION`; não é liberação de produção.
- Em clone diagnóstico sem ACL real, três pedidos concorrentes na revisão 1 criaram três OS distintas, revisões 2, 3 e 4. Com nova conversão aberta em transação, uma edição concorrente de OS encontrou `lock timeout`; a conversão foi interrompida pela limpeza do Colima. O sentido inverso, com edição confirmada antes da leitura, ainda precisa ser repetido. Esses testes não comprovam isolamento, bootstrap oficial ou CI.
- A pedido e com autorização do usuário, o perfil local do Colima e todos os dados Docker foram removidos, inclusive o banco e o clone diagnósticos. Não havia volumes Docker; depois, Colima foi recriado vazio, sem serviços do projeto, e imagens terão de ser baixadas para novos testes. Após limpeza, espaço livre passou de aproximadamente 13 GiB a 17 GiB. Arquivos do repositório preservados. Gates seguem fechados; sem deploy ou tarefas reais no Auvo.
- Próximo passo: reconstruir ambiente isolado de testes quando necessário, revisar fotografia integral e `xmin`, testar edição concorrente antes da conciliação e fontes de escopo sem revisão; prosseguir nas demais stories e manter homologação bloqueada.

## 2026-10-30 — Adições concorrentes de OS (Codex)

- S167: ADR-0870 e migration 1057 preparam exceção restrita para revisão anterior: sob lock do Chamado, cada revisão intermediária precisa corresponder a uma única criação integral comprovada com OS ainda vinculada; revisão futura, lacuna, trigger desabilitado e alterações substantivas seguem conflito. Limite de 100 revisões, helper privado, nenhuma alteração nos gates. `SPEC_DEVIATION` registrada em tasks e ADR: contrato genérico ainda prevê conflito para toda revisão obsoleta e precisa de reconciliação formal.
- Ensaio em clone isolado `--no-acl`, com 1056/1057 e gates/barreiras alterados somente nele: três sessões concorrentes com revisão 1 criaram três OS, com IDs/números/títulos distintos e revisões 2, 3 e 4; retry idêntico não duplicou. Alteração concorrente do título confirmada antes de novo pedido causou `revisao_obsoleta`. Na base diagnóstica, 32/32 verificações em rollback passaram, incluindo trigger desligado, lacuna e alteração substantiva. Clone/fixtures removidos; base principal sem 1057, gate fechado, índice presente, cron desligado e fila HTTP vazia.
- Não comprova todos os escritores, alteração de OS/escopo sem revisão do Chamado, ACL real, HTTP, bootstrap oficial, CI nem rollout; falta revisão adversarial antes de PASS. Correção global da leitura legada de Componentes, retry durável e composição de escopo permanecem pendentes. Sem deploy ou Auvo.
- Próximo passo: examinar alterações de OS/escopo não refletidas na revisão e testar concorrência com essas fontes; formalizar contrato da exceção e continuar demais stories sem abrir gates.

## 2026-10-30 — Concorrência real e revisão de OS (Codex)

- S167: ensaio em clone sem cron/net com 1056, gates ligados e barreiras legadas removidas apenas no clone: três comandos autenticados distintos, iniciados concorrentemente na revisão 1 e liberados por uma trava de linha, produziram uma OS e dois `40001 revisao_obsoleta`. Retry do mesmo pedido obsoleto falhou novamente; após revisão para 2, novo pedido criou outra OS e replay não duplicou (duas OS/números/comandos). Resultado contradiz explicitamente o teste independente de três criações concorrentes; não marcar AC concluído. Roteiro em `supabase/manual-tests/E01-S167_tripla_os_resultados.md`; clone `--no-acl` com grants de fixture não comprova ACL real. Clone/fixtures removidos; base principal com gate fechado, índice presente, cron desligado e fila HTTP vazia.
- UI experimental reconhece somente erro estruturado exato `40001/revisao_obsoleta` e permite reconsultar revisão e revisar o pedido sem envio automático. Preserva escopo/técnico e mantém pedido antigo em sessionStorage até substituição explícita por nova tentativa; erro incerto continua exigindo mesmo pedido. Checagem de divergência bloqueia sobrescrita de outro pedido. Isso é recuperação manual na mesma aba, não retry durável/cross-tab nem solução de criação concorrente automática.
- Testes focados web: 23/23 e typecheck passaram; suíte completa com configuração sintética: 2.101 passaram e 20 ignorados. Graphify atualizado; não é CI nem integração real.
- Próximo passo: desenhar criação concorrente que preserve revisão de alterações substantivas e idempotência, sem simplesmente ignorar conflitos; completar composição de escopo e proteção da leitura legada. Gates fechados; sem deploy ou Auvo.

## 2026-10-30 — Escopo próprio para OS de Chamado (Codex)

- S167: formulário experimental permite título e descrição próprios por OS, preserva-os no retry e bloqueia título vazio; caminho legado mantém comportamento. Testes UI falharam antes pela ausência dos campos e passaram depois. Backend 1047 rejeitava escopos diferentes; ADR-0869 e migration 1056, não aplicada, preparam remoção restrita das duas comparações com verificação da definição original. Teste em rollback falhou 2/22 antes e passou 24/24 com 1056, incluindo terceira OS sequencial, vínculo, replay idêntico e recusa de payload divergente. Segunda aplicação na mesma transação falhou explicitamente com `definicao_conversao_integral_incompativel`, revertendo alterações; não foi testada outra versão divergente real. Barreiras legadas foram retiradas somente dentro da transação revertida; não prova três comandos concorrentes nem composição/atendimento integral de escopo.
- Web: 20 testes focados e typecheck passaram; suíte completa com configuração sintética: 2.098 passaram e 20 ignorados. Graphify atualizado. Base principal preserva gate fechado, índice legado, cron desativado e fila HTTP vazia. Sem deploy/Auvo.
- Próximo passo: transição compatível das restrições legadas e prova concorrente de múltiplas OS; retry durável e composição de escopo; correção global da leitura legada de Componentes. Continuar demais stories; não homologar.

## 2026-10-30 — Concorrência da seleção de Componentes (Codex)

- S167: antes da mudança, consulta mediada 1055 retornou Componente durante trava exclusiva de autorização. ADR-0868 e migration 1055 ainda não aplicada passam a exigir READ COMMITTED, trava compartilhada de autorização e trava/releitura do gate. Em clone sintético, revogação real primeiro produziu `55P03`; leitura primeiro segurou revogação e fechamento do gate; revogação confirmada negou leitura; fechamento primeiro causou espera seguida de negação; REPEATABLE READ foi recusado. Regressão: 8/8 pgTAP na base diagnóstica em rollback. Roteiro em `supabase/manual-tests/E01-S167_componentes_concorrencia.md`.
- Clone foi criado sem cron/net; restauração de schema parou em ACL de extensão e recebeu grants explícitos para teste. Clone e fixtures sintéticas foram removidos; base principal permanece com gate fechado, cron desligado e fila HTTP vazia. Não comprova todas fontes de autorização, concorrência de Cliente/Chamado, HTTP, bootstrap oficial ou correção da RLS legada. Sem deploy/Auvo; homologação bloqueada.
- Próximo passo: proteger leitura legada sem quebrar consumidores, verificar concorrência de Cliente/Chamado e retry durável, prosseguir demais stories.

## 2026-10-30 — Proteção da seleção de Componentes S167 (Codex)

- Ensaio `E01-S167_componentes_leitura_escopo.sql` passou 5/5 em rollback e revelou que a RLS legada de `pcm.equipamentos` permite a usuário PCM ler o Cliente B mesmo com concessão `chamado.os.criar` somente para A. O filtro no navegador não é autorização. Essa exposição legada permanece e exige tratamento abrangente; não afirmar isolamento global.
- ADR-0868 e migration 1055 preparam RPC de seleção vinculada a Cliente/Chamado e `chamado.os.criar`, somente para authenticated, gate de conversão fechado. UI experimental agora usa a RPC, sem fallback para tabela direta. Em banco diagnóstico, 8/8 testes em transação revertida cobriram gate, anon, paginação, Cliente divergente, Cliente B sem concessão e revogação sequencial. O primeiro teste mostrou ausência da RPC; após implementação, uma ambiguidade SQL foi encontrada e corrigida. Não houve aplicação persistente da 1055.
- Testes web focados: 17/17; typecheck passou; suíte web com configuração sintética: 2.096 passaram e 20 ignorados. Graphify atualizado. RPC não prova revogação concorrente, segurança global da tabela, HTTP ou rollout; UI ainda carrega todas as páginas. Gate e homologação fechados, sem deploy/Auvo.
- Próximo passo: fechar exposição da leitura legada com desenho compatível e autorização efetiva; provar concorrência da RPC, retry durável S167 e demais stories. Base local usa bootstrap diagnóstico, não CI.

## 2026-10-30 — Banco diagnóstico reconstruído (Codex)

- Container `sso_diagnostico_reconstrucao_4`, rede Docker interna `sso-diagnostico-20261030-interno`, sem porta publicada. `cron.launch_active_jobs=off`, 12 jobs desativados, fila `net.http_request_queue` vazia; gate de mediação S167 fechado e índice legado presente. Nenhum segredo real ou tarefa externa. Imagens PostgreSQL 17.6.1.165, Storage v1.70.3 e GoTrue v2.196.0 baixadas; três contêineres experimentais anteriores e seus volumes anônimos descartáveis foram removidos.
- Aplicadas cópias diagnósticas em `/tmp/sso-ordem.kUg0HT/supabase/migrations` até 0961 (incluem seis correções históricas somente na cópia), e migrations locais 0962–1054 diretamente, sem registrar histórico oficial. Storage inicializado com scripts da imagem, sem processo de servidor; `auth.jwt()` e `auth.uid()` foram adaptadas somente nessa fixture para ler claims. Não equivale ao bootstrap Supabase oficial, CI ou prova de produção.
- S167: teste de gate passou 4/4. Primeiro ensaio de conversão falhou 11/20 porque imagem continha `auth.uid()` legado sem leitura de `request.jwt.claims`; após correção local da fixture passou 20/20. No ensaio barreiras legadas e gates foram alterados apenas dentro de transação revertida; valida vínculo de Componente de outro Cliente, replay, rollback e revogação sequencial, não concorrência nem integração HTTP/RLS real. Verificados novamente gate fechado, índice presente e fila HTTP vazia.
- Próximo passo: validar leitura de Componentes com Clientes e usuários sintéticos sob RLS e paginação, verificar proteção de concorrência/retry durável S167 e seguir demais stories. Manter rede interna e gates fechados; não homologar ou implantar.

## 2026-10-30 — Paginação de Componentes na abertura de OS (Codex)

- O adapter compartilhado de abertura consulta Componentes ativos por Cliente em páginas ordenadas por ID, até resposta vazia; erro ou ordem inválida recusa resultado parcial, e há limite explícito de segurança. Ordena por nome ao final e atende conversão experimental e formulário geral. Teste simulou limite de 100 linhas: antes retornava 100 de 205; após a mudança retornou 205 sem Cliente divergente. Outro teste verifica erro na página seguinte; 14 testes focados passaram. Consulta ainda carrega todas as páginas antes de mostrar opções: busca/paginação progressiva e validação de escala, concorrência e RLS real continuam pendentes; não é snapshot transacional.
- Typecheck passou; suíte web com configuração sintética teve 2.095 testes aprovados e 20 ignorados. Graphify atualizado. Banco local ainda não reconstruído; não prova CI ou homologação.
- Próximo passo: buscar/paginar progressivamente, comprovar leitura em banco com dois Clientes e avançar retry durável S167 e demais stories. Gates seguem fechados; sem deploy ou efeitos externos.

## 2026-10-30 — Componente na conversão experimental (Codex)

- S167: formulário experimental de conversão permite selecionar Componente do Cliente usando o adapter existente; pedido e retry na mesma aba preservam `equipamentoId`. Erro de leitura bloqueia confirmação e permite tentar novamente. O fluxo legado não mudou. Teste novo falhou pela ausência do seletor antes da implementação; 17 testes focados e typecheck passaram depois. O adapter existente não pagina e pode truncar listagens grandes; autorização/isolamento e integração real ainda exigem prova em banco. Gates fechados.
- Suíte web com configuração sintética: 2.093 testes passaram e 20 foram ignorados. Graphify atualizado; banco integrado/CI e homologação não foram executados.
- Próximo passo: paginação/busca para seleção completa de Componentes, retry durável entre abas e sessões e provas integradas S167; continuar demais stories sem deploy ou tarefas externas.

## 2026-10-30 — Conversão, jornada e navegação da Central (Codex)

- S167: UI experimental usa formulário legado do Chamado e preserva seus campos, pedido e IDs em sessionStorage. O formulário legado do Chamado não oferece equipamento; retry permanece restrito à aba e não coordena abas ou sessões. Persistência protegida no servidor, integração real, consumidores e provas concorrentes continuam pendentes; gates fechados.
- S169: teste de interface percorre matriz, staging, mapeamento, classificação, aprovação e rotina em rascunho com servidor simulado; não prova navegador com backend real nem concorrência.
- S172: interface associa disponibilidade declarada e participações por técnico após paginação completa; estimativas ausentes permanecem desconhecidas. Não apresenta saldo operacional nem comprova capacidade real.
- S179: Central global abre OS fora do feed por consulta filtrada por Cliente e ID, com conferência dos dados recebidos e atualização após alteração. Testes simulados cobrem filtro, recusa de Cliente divergente e callback da Central; não comprovam jornada real na página nem RLS em banco.
- Suíte web com configuração sintética: 2.088 testes passaram e 20 foram ignorados, durante alterações paralelas. Depois, 27 testes focados e typecheck passaram. Colima foi apagado e recriado com autorização: volume de diagnóstico e imagens foram removidos; o banco de testes precisa ser reconstruído. Sem deploy ou chamadas externas.
- Próximo passo: retry durável e equipamento S167; jornada integrada e concorrência S169; capacidade operacional S172; integração real e isolamento S179; seguir demais stories sem abrir gates ou homologar.

## 2026-10-30 — Conversão experimental e integração das telas (Codex)

- S167: UI experimental sob flag desligada conecta mediação 1049, preservando pedido/IDs em sessionStorage por usuário, Cliente e Chamado, sem fallback após erro; confirma/invalida antes de tentar limpar. Dezessete testes focados das frentes UI/adapter/cache passaram em conjunto; quatro cobrem conversão. Esta UI não substitui formulário completo: fixa GUT 3 e não inclui agendamento ou equipamento, nem comprova concorrência/cross-tab; gates fechados. Zé e duas rotas preventivas agora fornecem CH/PRE explícitos; dois testes do helper Deno e checks relatados passaram, sem HTTP integrado nem tarefas reais. Não retirar trigger/índice.
- S169: ADR-0866/1053 mediam tolerância e reprocessamento sob gates fechados; 13/13 pgTAP em rollback passaram. Tela agrupa etapas; mutações de classificação, mapeamento, revisão, tolerância e identidade invalidam conferência/diagnóstico antes da limpeza local e escondem dados durante refetch; sete testes focados passaram. Jornada navegada real, concorrência adversarial e homologação continuam pendentes.
- S172: ADR-0867/1054 e UI sob flag preparam leitura paginada da agenda manual por Cliente e semana, com RLS nativa e capacidade atual; 10/10 SQL relatados em clone removido e dois testes UI reproduzidos. É contexto, não saldo, disponibilidade ou prova de execução; faltam segurança concorrente, composição e revisão antes de aplicar.
- S179: Central existente conectada à página global de OS para Cliente selecionado; troca de Cliente fecha painel, permissão negada não oferece ação e reconsulta oculta conteúdo. Quatro testes focados passaram. Não há navegação direta da Central global para OS fora do feed; não afirmar AC completo.
- Suíte web com configuração sintética: 2.070 passaram, 20 ignorados; rodou durante edições paralelas. Após alterações, 17 testes focados e typecheck passaram. Sem deploy ou chamadas externas.
- Próximo passo: completar formulário integral S167 com campos legados e retry/cross-tab, consolidar saldo operacional S172 e acesso direto OS S179, validar jornada e concorrência S169 e demais stories; gates fechados.

## 2026-10-30 — Importação conferida, numeração e capacidade (Codex)

- S169: ADR-0865/1052 e adapter preparam mediação de identidade, revisão, conferência, aprovação do staging e incorporação em rascunho. Jornada sintética integrada passou 20/20 pgTAP em rollback, incluindo replay, revogação sequencial e nenhuma OS além da fixture; quatro testes de adapter passaram. Gates seguem fechados; faltam navegação integrada completa, tolerância/reprocessamento, concorrência de revogação/gates e revisão adversarial. Não aplicar nem homologar.
- S167: ADR-0864 e escritores Auvo/web passam número explícito do Chamado novo ou PRE por UUID, preservando a regra antiga; lote associa retorno pelo número, não pela ordem. Onze testes Deno, três testes web focados e 7/7 SQL em clone removido passaram; SQL usa rollback/anti-sync. Lote Auvo continua não atômico; Zé, preventivas e outros consumidores dependem do trigger; numeração 1:N e retry durável de UI continuam pendentes. Não remover índice/trigger nem abrir gates.
- S172: sete testes em clone removido com FKs e triggers ativos cobriram origem de Visita e snapshot parcial; duas sessões demonstraram conflito de revisão e rollback sem declaração/auditoria. Roteiros em `supabase/manual-tests/E01-S172_esforco_visita_fks_reais.sql` e `E01-S172_esforco_visita_concorrencia.md`. UI mostra diferença entre valores declarados explicitamente como não operacional; oito testes focados passaram. Saldo real, execução, concorrência de outras fontes e rollout 1051 seguem pendentes.
- S180: seletor de categorias usa paginação por ID estável, sem limite invisível de 100; duas provas de interface e cinco de adapter passaram. Não demonstra jornada completa nem substitui autorização de banco.
- Suíte web com configuração sintética: 2.062 testes passaram e 20 ignorados, em 347 arquivos aprovados e seis ignorados; rodou em paralelo às edições. Após elas, 21 testes focados e typecheck passaram. Sem deploy, CI ou serviços externos.
- Próximo passo: conciliar todos os escritores/consumidores de numeração e conectar conversão S167 com retry durável; validar jornada UI e concorrência S169; completar capacidade real S172 e demais stories, mantendo gates fechados.

## 2026-10-30 — Conversão mediada, mapeamento e esforço de Visita (Codex)

- S167: ADR-0861/1049 e adapter preparam mediação autenticada do núcleo integral, com IDs estáveis, comparação de resposta e nulls explícitos no payload. Vitest 4/4; em clone removido, 4/4 testes ACL/gate e 20/20 testes do wrapper, com barreiras legadas retiradas apenas em transação revertida e anti-sync. A tela continua sem integração/retry durável; montagem de OS Auvo omite `numero` e depende do trigger legado. Não retirar restrição, aplicar ou abrir gates antes de conciliar consumidores, efeitos e concorrência.
- S169: ADR-0862/1050 e adapter mediam classificação, mapeamento, lista e seleção de alvo sobre 1048, com gate fechado. Onze verificações pgTAP em rollback e três testes de adapter passaram; núcleo de seleção teve referência `id` ambígua corrigida. Conferência consolidada, identidade, revisão, aprovação, incorporação e concorrência ainda pendentes. Não aplicar ou habilitar antes de revisão.
- S172: ADR-0863/1051 estendem esforço declarado a ocorrência de Visita e conectam a tela sob flag, sem ativar gates. Dezenove pgTAP passaram em clone removido e testes focados da UI passaram; fixture montou origens com FKs desabilitadas e não prova integridade real ou concorrência. Troca de constraint, índice e projeção têm efeito imediato mesmo com gates fechados: locks, escritores antigos, clientes mistos e rollback com dados exigem prova antes de aplicar. Não declara execução ou saldo completo.
- S180: após previsão confirmada, lista/resumo da Visita e relatório do Cliente são invalidados antes de limpar tentativa local; teste reproduziu dados desatualizados e passou após ajuste. Não prova fluxo completo nem autorização.
- Verificação web com URL local e chave sintética: 2.054 passaram e 20 ignorados em 346 arquivos aprovados e seis ignorados; a suíte rodou durante edições paralelas. Depois, 17 testes focados passaram e typecheck passou após correção de teste concorrente. Não equivalem a CI/db-tests ou homologação. Sem deploy ou chamadas externas.
- Próximo passo: conciliar número e gatilhos de OS no Auvo antes de integrar 1049; mediar fechamento de S169; comprovar FKs, concorrência e rollout de 1051; concluir demais stories com gates fechados.

## 2026-10-30 — Conversão integral, cronogramas e capacidade (Codex)

- S167: ADR-0858/1047 preparam núcleo privado para converter Chamado em múltiplas OS, preservando campos e eventos locais, validando vínculos e comparando payload no retry. Em clone removido, 4/4 testes de ACL/gates/barreira e 18/18 de escrita, retry, Cliente, revogação sequencial e rollback passaram; gate aberto e índice/trigger retirados apenas em transação revertida no clone, com anti-sync. Falta mediação/interface, concorrência, ramos PMOC/inspeção e comprovação de efeitos sem supressão. Numeração nova `CH…-OS-UUID` exige conciliar consumidores que esperam igualdade CH/OS; não liberar nem aplicar antes de compatibilidade e revisão.
- S169: ADR-0860/1048 preparam mediação autenticada de recepção, listagem, detalhe e anotação no staging canônico S178; núcleo segue privado e gates fechados. Dez verificações pgTAP passaram em rollback, inclusive autorização, retry e revisão; dois testes de adapter passaram. A migration corrige referência ambígua na listagem privada; classificação, mapeamento, aprovação, incorporação e concorrência real de revogação não estão comprovados. Staging legado foi preservado; não aplicar nem liberar sem revisão.
- S172: UI e adapter existentes conectam declaração de esforço a ocorrência de calendário sem OS, com tentativa por tipo e invalidação de consultas. Não oferece edição para ocorrência por Visita, ainda incompatível com o schema. Onze testes focados e typecheck passaram; saldo, deduplicação e integração em banco permanecem pendentes.
- S180: leitura de despesas recusa páginas fora da ordem ou acima do limite; três testes focados passaram após reproduzir duas falhas. Não prova autorização ou jornada de despesa completa.
- Suíte web com configuração Supabase sintética: 2.050 testes passaram e 20 ignorados (344 arquivos passaram, seis ignorados); execução ocorreu durante desenvolvimento paralelo, por isso testes focados posteriores e typecheck também foram executados: 16/16 focados e typecheck passaram. Sem CI, deploy ou serviços externos.
- Próximo passo: integrar comando S167 após conciliar numeração/consumidores e provar concorrência; mediar demais passos S169; suportar ocorrência por Visita e consolidação S172; concluir demais stories com gates fechados.

## 2026-10-30 — Concorrência de Visitas, origem e Central de Materiais (Codex)

- S179: criação confirmada invalida consultas da OS e da Central antes de limpar tentativa local; se armazenamento falha, a lista confirmada aparece e o retry preserva o mesmo pedido. Teste reproduziu ausência da lista antes da correção; três testes focados e typecheck passaram. Ainda não comprova integração completa ou homologação.
- S165: ADR-0859/1046 preparam serialização opt-in de três fontes de Visita ausentes do protocolo de impacto. Em clone removido, três INSERTs vazios foram bloqueados com gate ligado e trava ocupada; com gate desligado ou trava livre passaram; ordem inversa da decisão segurou a trava. Mesmo desligado, o trigger executa consulta da flag: compatibilidade e carga não comprovadas. Não comprova inserções reais, inventário exaustivo, equivalência legado ou aprovação; não aplicar nem abrir gate.
- S167: sete verificações como owner em clone descartável demonstraram eventos diferentes entre INSERT seguido de UPDATE e INSERT final, rollback do evento e FKs que permitem equipamento/inspeção de outro Cliente. Não comprova que usuário comum consegue inserir vínculo divergente. Roteiro `supabase/manual-tests/E01-S167_inventario_conversao_efeitos.sql`; ADR-0858 registra limites. Clone removido; comando integral, validação dos vínculos e retry seguem pendentes.
- S168: sete verificações em rollback confirmaram proteção de alvo/Cliente do Plano legado com ocorrência, imutabilidade da versão aprovada e ausência de UPDATE direto na ponte pelos papéis operacionais. Classificação segurou vinculação por chamada privada, que terminou em conflito de unicidade; caminho público e ordem inversa não foram provados. Roteiro `supabase/manual-tests/E01-S168_inventario_fontes_origem.md`; clone removido.
- Suíte web inicial: 1.940 testes passaram, 20 ignorados e 11 arquivos falharam ao iniciar sem variáveis Supabase. Repetição com URL local e chave sintética: 2.045 passaram e 20 ignorados, em 343 arquivos aprovados e seis ignorados; não substitui db-tests/CI nem prova integrações. Graphify atualizado; sem deploy ou efeitos externos.
- Próximo passo: concluir e validar conversão transacional integral S167, fontes e impactos S165/S166 e concorrência pública S168; manter gates fechados e avançar demais stories.

## 2026-10-30 — Provas de cancelamento e fontes de origem (Codex)

- S167: 1028/1040/1043 testadas em clone isolado com gates ligados apenas nele: INSERT direto e troca de vínculo unilateral versus cancelamento, em ambas ordens, foram serializados e recusados quando incompatíveis. Clone/rede removidos. O teste exigiu renumerar somente fixture sintética por colisão com número legado; índice/trigger reais seguem impedindo transição 1:N. Não aplicar nem liberar.
- S168: 1041 não serializa todas as fontes: em clone com gate ligado, `service_role` alterou vencimento da ocorrência legada e confirmou enquanto classificação ainda estava aberta. Integridade concorrente não comprovada; proteção adicional em andamento.
- S165: 0769 permite aprovação posterior por token, mas 0785 mantém fontes incompletas e 0715 depende de gate; configuração divergente pode deixar caminho sem prova de impactos. Teste anterior de aprovação inicial não prova revisão posterior. Não habilitar; reforço de fronteira e inventário pendentes.
- S165: ADR-0857/1045 reforçam a fronteira de revisão, recusando token com impactos incompletos mesmo se guarda anterior estiver desligada; UI também bloqueia confirmação sem preflight completo. Dois testes SQL em clone e 47 UI passaram. Revisão subsequente continua bloqueada; compatibilidade, fontes e aprovação ponta a ponta pendentes.
- S168: ADR-0856/1044 serializam a ocorrência legada no recorte de classificação e Pendência sob gate fechado. Em clone removido, classificação primeiro bloqueou atualização e escritor primeiro causou recusa de origem incompatível; jornada válida 13/13 e guardião 4/4. Outras fontes, como Plano, versão e ponte, ainda não protegidas.
- S167: contrato de conversão legada não permite distinguir timeout de criação concorrente: falta requestId/OS ID estável e comparação de payload. Fluxo preparado 0324 não cobre todos os campos e efeitos legados; não substituí-lo nem retirar índice. Teste de caracterização 14/14 evidencia risco, não comprova idempotência.
- S167: ADR-0858 registra contrato integral e dependências; abertura reutiliza normalização existente via `prepararAberturaOrdemServico`, com testes de preservação de campos. Não implementa atomicidade, requestId estável, Hub/outbox ou retry seguro; sem migration 1046 e sem abrir gate.
- Próximo passo: continuar integração 1:N, provar fontes e proteção de aprovação subsequente; sem deploy ou serviços externos.

## 2026-10-30 — Origem coerente, cancelamento e feriado (Codex)

- S168/S173: fixture anterior misturava Grupo com Plano legado de Sistema; resultados positivos antigos não provam origem válida. ADR-0853/1041 preparam guardas sob gate fechado para exigir resolução canônica antes de classificar retorno e criar Pendência. Fixture coerente passou jornada integrada 13/13 em rollback; testes adicionais cobrem origem incompatível, Pendência histórica divergente e gate desligado. Não prova todos os escritores concorrentes.
- S167: ADR-0852/1040 corrigem cancelamento conservador para considerar vínculos legado/direto; nove testes em rollback passaram. ADR-0855/1043 preparam guarda desativada para vínculo após cancelamento; oito testes em rollback e ambas ordens concorrentes de alteração de status em OS legada passaram em clone removido. Concorrência de INSERT e outros escritores não provada; triggers afetam custos/compatibilidade mesmo com gate fechado. Não aplicar nem liberar.
- S166: ADR-0854/1042 preparam serialização da decisão de feriado com autorização e gates; oito verificações concorrentes em clone e nove testes de regra/replay passaram. Vencimento original preservado no recorte testado. Clone removido; fontes, contrato e revisão adversarial permanecem pendentes.
- Próximo passo: completar prova concorrente de cancelamento e transição 1:N, validar origens e integração sem efeitos externos.

## 2026-10-30 — Origem e triagem concorrentes (Codex)

- S168: 1036/ADR-0848 ampliados sob gate fechado para Sistema e Equipamento, além de Cliente, ocorrência e ID Auvo após retorno. Quatorze testes pgTAP em rollback passaram; classificação primeiro bloqueou alterações concorrentes em clone removido. Alterações anteriores à classificação foram aceitas e a RPC não compara esses campos ao alvo da Rotina: não presumir validade sem analisar contrato e consumidores. Sem rollout.
- S166: ADR-0850/1038 preparam serialização de autorização e gate da triagem; quatro cenários concorrentes e nove regressões passaram em clones removidos, isolamento antigo recusado. Faltam impactos de Plano/Cliente, demais escritores e revisão adversarial; gate fechado.
- S185: resolução na interface confere tentativa local antes de repetir/remover e invalida listas após sucesso mesmo se limpeza falhar. Dois testes falharam antes do ajuste e passaram depois; controle de navegador não substitui serialização do servidor.
- S167: ADR-0851/1039 preparam quadro gerencial paginado, integrado à tela de OS sob flag, separado do Kanban legado e com gate fechado. Treze testes SQL em rollback (cópia temporária para caminho habilitado) e dois testes UI passaram. Conta vínculos diretos e legado e recusa ambiguidades; não prova criação de várias OS diretas enquanto índice legado existe.
- Próximo passo: concluir painel gerencial de Chamados, conciliar 1:N e validar os demais fluxos e fontes, sem deploy nem efeitos externos.

## 2026-10-30 — Mediação de OS e concorrência de reconciliação (Codex)

- S167: ADR-0849/1037 preparam wrapper autenticado de criação, com gate fechado, autorização e locks; adapter conectado. Núcleo privado, índice e trigger legados permanecem; testes SQL 13/13 em rollback e seis UI/adapter passaram. Não cria múltiplas OS efetivamente.
- S185: resolução concorrente em clone interno demonstrou replay idempotente, recusa de segundo request, serialização com revogação e recusa de snapshot de OS alterado. Gate real fechado; clones temporários de funções usados, clone e rede removidos. Não prova HTTP ou rollout.
- S168: 1036/ADR-0848 ampliados, ainda não aplicados, para proteger Cliente e ID Auvo além de ocorrência após retorno. Dez pgTAP em rollback; classificação primeiro bloqueou alterações concorrentes autenticadas dos dois novos campos em clone removido. Ordem inversa desses campos e outros escritores ainda pendentes; gate fechado.
- S166: triagem de atraso exige reconferência após alteração, protege tentativa/sessão e valida resposta; 16 testes UI e nove SQL em rollback passaram, sem prova de concorrência completa.
- Próximo passo: concluir transição 1:N e consumidores; integrar e validar demais writers e rotas, sem deploy ou efeito externo.

## 2026-10-30 — Resolução de conflito e origem de retorno (Codex)

- S185: ADR-0847/1035 preparam resolução manual auditada com confirmação explícita, snapshot da OS e retry idempotente; UI opt-in conectada e gate fechado. Quarenta testes SQL em rollback e cinco UI passaram. Sem chamada ao Auvo; falta HTTP integrado, duas sessões, reabertura real e revisão adversarial. Captura permanece não atômica com UPDATE rejeitado; retry externo não comprovado.
- S168: ADR-0848/1036 preparam guarda por gate fechado da ocorrência da OS após retorno. Escrita authenticated anterior conseguiu alterar origem; com guarda, classificação e alteração em duas ordens concorrentes produziram recusa sem retorno inconsistente, em clone removido. Aprovações concorrentes com mesmo pedido criaram uma decisão e uma Pendência. Seis testes em rollback passaram; outros escritores/fontes ainda sem prova.
- S166: interface de feriados preserva tentativas divergentes, evita duplo envio e isola usuário/Cliente; testes focados e typecheck passaram. Extensão pgTAP foi instalada na base diagnóstica, sem alterar gates.
- S169: corrigida regressão introduzida na proteção anterior que bloqueava retry legítimo; pedido idêntico pode repetir, tentativa local diferente é recusada. Dez testes focados passaram; compare-and-set no navegador não é operação transacional entre abas.
- Próximo passo: validar integração e concorrência restantes, concluir múltiplas OS e demais stories; sem deploy ou serviços externos.

## 2026-10-30 — Retorno opcional e consultas de conflito (Codex)

- S168/S173: ADR-0845/1033 eliminam bloqueio indiscriminado de opcional não inspecionada, mantendo exigência para respostas obrigatórias e contratos ambíguos. Fluxo sintético classificação → conferência → aprovação → Pendência passou 11/11 em rollback; opcional não gera Pendência, OS não encerra e replay não duplica. Concorrência de aprovação e integração real pendentes.
- S166: geração de Visita reconfirma alterações de regra e dados, bloqueia durante atualização/erro, valida resposta e invalida lista; testes focados e typecheck passaram. Não prova concorrência no servidor ou homologação.
- S169: recepção não sobrescreve tentativa previamente guardada nem remove tentativa diferente que surgiu durante envio. Dois testes reproduziram falhas antes e passaram depois; proteção de navegador não é lock transacional nem prova concorrência no servidor.
- S185: ADR-0844/1032 preparam leitura paginada de conflitos e UI opt-in; ADR-0846/1034 preparam wrapper com autorização, trava e gate fechado, preservando núcleo privado. Vinte e cinco testes SQL em rollback com cópias temporárias, dois UI e typecheck passaram. Sem prova HTTP, revogação concorrente, resolução ou contrato de retry; não liberar.
- Próximo passo: integrar e provar concorrência em S168/S173 e reconciliação, concluir transição 1:N e seguir outras stories sem efeitos externos.

## 2026-10-30 — Classificação de retorno e conflitos de integração (Codex)

- S168: ADR-0843/1031 corrigem classificação de pergunta opcional conforme snapshot único e explícito, conservando obrigatório quando ausente/ambíguo. Dez testes SQL passaram em rollback; aprovação integrada e concorrência da origem pendentes.
- S166: ADR-0841/1029 preparam serialização de autorização, gates e calendário para geração contratual. Doze provas concorrentes em ambas ordens e 19 regressões passaram em clones sintéticos removidos. Trigger para feriados afeta escritores legados independentemente de gate; compatibilidade e contenção exigem revisão antes de aplicar.
- S169: lista de lotes invalida após resposta confirmada mesmo se limpeza de tentativa local falhar; teste observou falha antes da correção, oito testes focados e typecheck passaram. Não resolve staging duplicado ou importação XLSX.
- S167/S185: 1028 foi experimentada com formatos de escritores legados (14/14 em rollback), não API real; webhook pode falhar ao atualizar OS em Chamado encerrado. ADR-0842/1030 preparam captura deduplicada privada e classificação na reconciliação, mantendo resposta 500 e gate fechado. Treze testes SQL em rollback, três Deno e deno check passaram; captura não é atômica com atualização, contrato de retry, HTTP integrado, resolução e revisão adversarial pendentes. Não liberar 1028/1030.
- Próximo passo: finalizar conciliação de 1:N, persistência/importação e testes de integrações, preservando gates e sem efeitos externos.

## 2026-10-30 — Concorrência de Pendências e fechamento (Codex)

- S173: em clone schema-only interno e sintético, duas sessões com commit demonstraram preparação primeiro bloqueando revogação até commit, e revogação primeiro provocando 55P03 durante disputa e 42501 após commit; uma Pendência e um comando, sem segundo request. Clone removido. Vinte e um testes pgTAP também passaram em rollback, incluindo contenção para três consultas e comando. Roteiro em `supabase/manual-tests/E01-S173_revogacao_concorrente.md`; não prova demais fontes de autorização, origem ou revogação de token externo.
- S178: teste de incorporação agora passou 16/16 em rollback, incluindo request divergente e revisão obsoleta, sem provar concorrência de todos os ativos.
- S166: integração individual de ciclo legado preserva tentativa de outra instância, isola mudança de usuário/Cliente e exige nova conferência quando candidato, relação ou revisão mudam. Quinze testes focados e typecheck passaram; não comprova concorrência do servidor ou materialização completa.
- S167: ADR-0839/1027 preparam fechamento sobre união direta/legada, com gates e ACLs fechados. Em clone com commit reproduziu-se inserção de OS em execução após fechar Chamado. ADR-0840/1028 preparam triggers para impedir alteração relevante em escopo encerrado; 12 verificações e duas ordens de corrida passaram em clone com dados sintéticos, depois removido. Triggers são incondicionais e afetam escritores legados mesmo com gates fechados; compatibilidade integral, demais escritores e revisão adversarial não comprovados. Não aplicar nem habilitar 1:N/fechamento.
- S180: investigação em clone descartável não encontrou solução genérica segura para corrida com `REVOKE EXECUTE`/membership; lock de catálogo exige privilégio elevado, bloqueia DDL não relacionada e não cobre membership. Não ativar policies; detalhes no diagnóstico manual.
- Próximo passo: concluir prova de corrida de fechamento S167, avançar S165/S166 e demais stories, sem efeitos externos.

## 2026-10-30 — Consultas mediadas e autorização Storage (Codex)

- S173: ADR-0836/1024 preparam consultas de condições, decisões e Pendências, conectadas às telas sob gate fechado; ambiguidade `id` do núcleo de condições corrigida. Integração sintética 17/17 pgTAP em rollback, sete testes UI e typecheck passaram. Faltam prova de concorrência e integração S168 real.
- S167: ADR-0838/1026 alinham avaliação, diagnóstico e listagem de aptidão à união de vínculos diretos e legados e rejeitam ambiguidades. Treze testes passaram em rollback com cópias temporárias; gates reais fechados. Encerramento efetivo e criação 1:N ainda precisam de adaptação.
- S178: teste ampliado passou 14/14 em rollback, incluindo replay sem duplicação e negação de usuário sem concessão. Não prova concorrência para todos os ativos.
- S180: ADR-0837/1025 preparam apenas função privada desconectada para travar gates/entidades por bucket. Experimentos em clone sintético passaram 32 verificações concorrentes em ambas ordens para fontes exercitadas; `REVOKE EXECUTE` de helper foi confirmado durante INSERT aberto, portanto DDL de ACL não participa do protocolo e rollout segue bloqueado. Consultar diagnóstico manual para limites; nenhuma policy ativada.
- Próximo passo: adaptar fechamento S167, validar concorrência S173 e resolver compatibilidade de ACL para Storage; sem deploy ou serviços reais.

## 2026-10-30 — Escopo legado, mediação e ativos (Codex)

- S167: ADR-0834/1022 incluem OS de vínculo singular legado válido no escopo preparado e recusam conflitos, sem duplicação. Onze testes em rollback, com cópia temporária e gate operacional fechado, passaram. Criação 1:N e demais consumidores continuam pendentes.
- S173: ADR-0835/1023 preparam mediação de retorno aprovado com gate próprio desligado, autorização por Cliente e trava compartilhada, mantendo núcleo privado; UI chama wrapper. Fixture sintética Não OK anterior à decisão passou 12 testes em rollback e dois testes UI passaram. Consultas da tela ainda privadas; não prova origem S168 real ou concorrência de todos os escritores. Alteração posterior da resposta foi reproduzida apenas por owner privilegiado, não por authenticated.
- S178: teste independente com lote de seis linhas incorporou Sistema, Componente e Grupo autorizados e negou outras três novas linhas após revogação: 11/11 em rollback. Não prova concorrência dos três tipos.
- S180: ADR-0833/1021 preparam dispatcher privado desconectado com trava de autorização; nenhuma policy ou gate alterado. Em clone sintético, seis inserts numa transação seguraram desativação concorrente; ordem inversa foi exercitada somente em Grupo. Outras fontes mutáveis e concorrência individual/HTTP seguem pendentes; clone removido.
- Próximo passo: completar fluxos integrados e provas concorrentes; não abrir gates nem acionar serviços reais.

## 2026-10-30 — Revogação de ativos e teste HTTP de Storage (Codex)

- S178: teste sequencial expandido para Sistema, Componente e Grupo com categoria sintética; 8/8 em rollback após revogar `cadastro.aprovar`, sem cadastro ou vínculo. Não demonstra caminho positivo nem corrida para todos os tipos.
- S180: Storage HTTP em clone sintético isolado e JWT sintético permitiu seis uploads e negou seis após desativação; usuário inválido recebeu 400. Encontrada corrida SQL no candidato: upload de foto de Grupo iniciado antes da revogação confirmou depois dela. Wrapper experimental com lock compartilhado segurou revogação ou negou operação na ordem inversa, apenas nesse recorte. Outros helpers, fontes de autorização e concorrência HTTP seguem sem prova; não promover policies. Clone/Storage removidos, banco compartilhado intacto. Detalhes em `supabase/manual-tests/E01-S180_diagnostico_policies_upload.md`.
- S167: ADR-0832/1020 preparam serialização da autorização para comando de criação de OS, mantendo gate, índice, trigger e ACL fechados. Testes de bloqueio em cópia temporária e rollback passaram; não houve criação de OS, prova de retry/commit ou transição 1:N. Revisão adversarial e CI pendentes.
- S173: prévia rejeita resposta com itens omitidos, duplicados ou situação incompatível e oculta resultado após erro; sucesso da preparação invalida cache do Cliente mesmo se falhar limpeza local. Onze testes focados e typecheck passaram. Núcleo 0584 e listagens ainda sem EXECUTE; mediação exige comprovar origem e concorrência S168/S173, sem afirmar jornada completa.
- Próximo passo: concluir mediação e testes concorrentes das operações pendentes sem abrir gates, mantendo banco de diagnóstico isolado e integrações externas desligadas.

## 2026-10-30 — Prévia de OS, revogação e matriz Storage (Codex)

- S186/S167: ADR-0831 e 1019 corrigem prévia que classificava referência singular de OS compartilhada entre Clientes como coerente; não expõem identidade do outro Cliente nem alteram escrita. Sete testes em transação revertida passaram, usando cópia temporária da função com gate neutralizado; gate real fechado. Não implementa múltiplas OS.
- S173: interface oculta resultados anteriores durante atualização/erro e impede nova composição com seleção desatualizada em revisão, estado ou alvo; preserva retry. Seis testes UI e typecheck passaram. Sem prova de revogação simultânea no servidor ou homologação integral.
- S178: `supabase/tests/E01-S178_incorporacao_revogacao_sequencial.test.sql` passou 4/4 em rollback no banco isolado: após revogação, nova incorporação de Sistema é negada sem cadastro ou vínculo. Não prova corrida entre sessões nem Componentes ou Grupos.
- S180: candidato ADR-0800, sem ativação persistente, passou comparação de 52 combinações em `E01-S180_matriz_storage.sql` e 55 verificações de uploads positivos/negativos e revogação sequencial dos seis buckets em `E01-S180_storage_positivos.sh`, em rollback. Concorrência dos helpers legados, Storage HTTP real e revisão adversarial seguem pendentes; 0966 continua vermelho sem candidato, gates fechados.
- Próximo passo: conciliar consumidores e escrita 1:N; ampliar provas de Storage e implementar as demais stories sem deploy, com gates fechados.

## 2026-10-30 — Conferência CSV e restrição candidata de OS (Codex)

- S169: conferência local reconhece datas brasileiras completas e válidas sem alterar a matriz original; seleção permite reutilizar o mesmo arquivo CSV. O mapeamento bloqueia premissas incompatíveis antes do envio, permitindo correção. Testes focados e typecheck passaram. Teste opt-in com as duas planilhas originais passou usando `SSO_PYTHON_PLANILHAS=/usr/bin/python3`: leitura de 59 linhas Rimini e 53 I Home, com 25 tempos SPCI pendentes; não prova importação XLSX pela interface. Staging separado segue em SPEC_DEVIATION, sem homologação.
- S167: experimento em tabelas temporárias mostra que FK composta candidata impede troca de Cliente mesmo com OS logicamente excluída. Não foi criada migration nem aberto gate; compatibilidade dos escritores e correção do legado ainda não comprovadas. Dezoito testes focados de leitura e progresso passaram, sem provar criação 1:N ou card único. Interface de aptidão agora recusa contagens ausentes, inválidas ou contraditórias; três testes focados e typecheck passaram.
- Após recriação do Colima, base `sso_diagnostico_reconstrucao` foi reconstruída em `sso-diagnostico-reconstrucao-20261030` (rede interna, sem portas publicadas, cron global e 12 jobs desligados, fila HTTP vazia). Cópias diagnósticas até 0961 e migrations locais 0962–1018 aplicadas; não comprova bootstrap oficial. Fixtures antigas não existem. Usar `docker exec`; não usar dados reais nem despachar integrações.
- S180/0966 reproduziu 9/10 na base nova: teste de INSERT em Storage falha com 42501 em `sso_autorizar_upload_evidencia_material`. `psql` retornou zero apesar do TAP falhar. Candidato ADR-0800 em rollback passou 0966 10/10 e experimento 14/14; matriz completa de buckets/papéis, concorrência e Storage real ainda pendentes, sem promover policies. Detalhes em `supabase/manual-tests/E01-S180_diagnostico_policies_upload.md`. Outbox contém seis categorias pendentes com zero tentativas; não despachar.

## 2026-10-30 — Incorporação, histórico e recriação do Colima (Codex)

- S178: ADR-0828/1017 serializam autorização da incorporação até commit, sem alterar ACL ou gate. Quatro testes SQL em rollback e ensaio em cluster descartável interno comprovaram incorporação de Sistema com revogação aguardando commit; na ordem inversa, houve contenção e replay negado após revogação. Não comprova nova incorporação após revogação nem Componentes ou Grupos; faltam revisão adversarial e CI independente.
- S180: ADR-0829/1018 preparam leitura histórica verificada para comprovantes mediados e legados; 40 testes SQL em rollback e quatro Deno passaram. Ensaio HTTP com JWT sintético em serviços isolados cobriu leitura, token inválido, adulteração e revogação. O roteiro `manual-http-historico-e2e.mjs` foi escrito depois do ensaio e não foi executado como arquivo; navegador, concorrência e URLs antigas permanecem pendentes. Gates fechados.
- S167: ADR-0830 registra que uma ponte secundária experimental não é reconhecida pelos leitores, resumo, impacto, encerramento e interface legados. Nenhuma ponte ou migration foi aplicada; 1:N segue bloqueado até conciliar escritores e consumidores.
- Por autorização de Lucas, Colima e seus volumes/imagens foram apagados e recriados. O banco de diagnóstico anterior e suas fixtures sintéticas não existem mais; Colima está vazio. Recriar diagnóstico apenas em rede interna, sem portas públicas, cron ou efeitos externos; bootstrap histórico ainda precisa das correções diagnósticas e não equivale ao oficial. Sem deploy ou tarefas reais.
- Próximo passo: reconstruir diagnóstico isolado e continuar implementação das stories em paralelo; preservar gates e homologação bloqueados até testes completos e revisão adversarial.

## 2026-10-30 — Serialização da recepção e histórico de comprovante (Codex)

- S178: ADR-0824/1015 reutilizam protocolo global de autorização para segurar a permissão de `cadastro.gerir` até commit na 0320, recusando isolamento antigo. Duas ordens foram exercitadas com commit em cluster interno descartável: recepção primeiro bloqueou revogação até commit; revogação primeiro recusou recepção durante disputa e depois negou permissão. Dez triggers das fontes efetivas estavam ativos; 5 testes pgTAP passaram em rollback. Cluster e dados sintéticos removidos. Avaliar contenção, CI independente, revisão adversarial e revogação externa de JWT; migration não aplicada permanentemente.
- S167: ensaio em cluster descartável criou duas OS e repetiu request sem duplicar, mas exigiu retirar índice/trigger legados apenas dentro de transação revertida. Após rollback restrições e gate estavam intactos. Isso não demonstra transição compatível nem autoriza DROP ou liberação de 1:N. Cluster descartável foi posteriormente removido.
- S180: roteiro salvo `manual-http-e2e.mjs` executado em Auth/PostgREST/Storage/Deno internos comprovou recorte de ingestão, realização, leitura, bloqueio legado e adulteração; sem dados reais. ADR-0826/1016 negam leitura histórica legada de caminho reservado à ingestão mediada; 37 testes SQL em rollback passaram. URLs já emitidas, demais leitores, concorrência e revisão adversarial seguem pendentes; gates fechados.

## 2026-10-30 — Comprovante HTTP e revogação de levantamento (Codex)

- S180: em cluster/Auth/PostgREST/Storage/Deno internos, comandos HTTP reais com JWT sintético passaram ingestão → realização → leitura; rota legada negou comprovante mediado, adulteração retornou 409 e usuário revogado 404. Recursos sintéticos foram removidos. Roteiro `manual-http-e2e.mjs` foi escrito após a execução e ainda não foi executado como arquivo; não afirma jornada de navegador, concorrência ou segurança de outras rotas/URLs. Gates fechados.
- S167: detalhe não soma páginas mutáveis como se fossem fotografia integral; usa resumo do servidor sob flag ou oculta contagem. 9 testes UI passaram. Transição 1:N permanece bloqueada por índice/numeração e compatibilidade, sem DROP ou liberação.
- S178: recepção CSV preserva tentativa se sessão mudar. A RPC 0320 é executável por authenticated e cria somente staging com autorização atual, não tem gate servidor próprio; incorporação examinada exige conferência/aprovação, sem auditoria de todas rotas alternativas. Revogação durante espera foi reproduzida: 0320 anterior prosseguia após perda de permissão. ADR-0823/1014 revalidam após ambas as travas e recusam snapshot antigo; duas ordens de espera e 5 pgTAP passaram em rollback. Revogação após última rechecagem e fixture independente para CI permanecem pendentes.
- Passaram 19 testes web focados e typecheck. Migrations novas não aplicadas permanentemente; sem deploy/Auvo real. Próximo passo: serializar revogação S178 até commit e testar o roteiro HTTP completo como arquivo, preservando isolamento.

## 2026-10-30 — Visita concorrente e leitura de comprovante (Codex)

- S166: geração contratual 1009 testada em duas sessões em cluster descartável interno: replay e revogação durante espera passaram 7/7, com uma Visita/origem e sem OS/outbox; recursos descartáveis removidos. Revogação após última rechecagem e demais escritores continuam pendentes.
- S167: leitor legado de OS por Chamado recusa escolher entre múltiplas OS visíveis; leitura por RLS ainda pode ser parcial e ponte singular não foi integralmente conciliada. Recuperação por requestId já existente passou a comparar payload normalizado e preservar tentativa divergente; 18 testes focados passaram. Resumo gerencial é invalidado após confirmação. Fluxo 1:N continua bloqueado por restrições legadas e consumidores.
- S180: ADR-0816/1011 e ADR-0819/1012 preparam leitura unificada por origem, autorizada, com conferência de digest para comprovante mediado e falha fechada em origem ambígua; UI sob flag desligada. ADR-0820/1013 impedem resolvedor legado de entregar caminhos reservados à ingestão mediada mesmo com flag divergente. Testes SQL em rollback passaram 26/26, 32/32 e 35/35, respectivamente; 8 testes Deno e 2 web focados passaram. Outros leitores, URLs já emitidas, Storage direto, concorrência e HTTP integrado ainda não comprovados; sem deploy/gate aberto.
- Typecheck inicialmente encontrou índice opcional em teste do resumo; teste ajustado e typecheck passou. Próximo passo: conciliar todos os leitores legados antes de rollout e completar a prova de 1:N, sem remover restrições prematuramente.

## 2026-10-30 — Visita contratual, resumo gerencial e realização (Codex)

- S166: ADR-0812/1009 preparam mediação das duas RPCs de geração contratual, antes inacessíveis pela UI, com gate próprio fechado e dupla autorização; corrigem ambiguidade de `id` na listagem legada. UI conectada, com proteção de identidade e retry. 19 testes SQL em rollback cobriram geração sintética, replay, feriado e negações; 14 testes UI passaram. Duas verificações de identidade foram escritas após código, sem RED observado. Concorrência e reconciliação legada pendentes.
- S167: ADR-0815/1010 preparam resumo em lote (até 100 Chamados) e indicador do Kanban sob flag/gate fechados, omitindo dados inconsistentes e durante erro/reconsulta; sem N+1 por card. Teste SQL em rollback cobriu autorização de dois Clientes e vínculo divergente; testes focados passaram. Cache pode estar defasado até 30 s por mudança externa; não comprova encerramento. Faltam E2E, carga, revogação concorrente e revisão adversarial.
- S180: ADR-0811/1007 preparam realização idempotente a partir da reserva/confirmacão do mesmo ator, Cliente, despesa e objeto, sem relaxar o caminho legado. UI conecta ingestão e realização sob flag desligada e preserva pedido/arquivo no retry; 23 testes SQL em rollback, incluindo papel authenticated e negação anon, e 8 testes UI passaram. Teste HTTP com Auth/PostgREST/Storage locais validou JWT, upload, replay, token inválido e revogação; conflito de bytes foi corrigido de 503 para 409 em testes Deno, mas HTTP não repetido após patch. Faltam concorrência, leitura integrada e revisão adversarial; sem deploy.
- Web: 30 testes focados e typecheck passaram após as alterações; teste temporário disparado durante RED falhou porque o componente ainda não existia, depois passou. Banco compartilhado continua isolado, sem cron; sem Auvo real.

## 2026-10-30 — Replay concorrente e integridade de comprovante (Codex)

- S166: criação e repetição reais em duas sessões passaram 7/7 em cluster descartável interno com cron desligado. Primeira transação criou a ocorrência, concorrente recebeu 55P03 e replay após commit retornou mesmo resultado, sem duplicar e sem gerar OS/outbox. Apenas esse recorte é comprovado; PMOC, demais escritores e homologação permanecem pendentes. Container e rede descartáveis foram removidos; base comum preservada.
- S165: ADR-0810/1006 estendem trava existente a fontes de decisão de fuso/calendário; teste sintético em duas sessões comprovou recusa de inserção privilegiada concorrente em fuso, decisão de calendário coberta apenas por INSERT de zero linhas. Comandos canônicos já usam lock de Plano; cobertura integral e aprovação seguem pendentes.
- S180: replay de ingestão concluída agora valida caminho completo com requestId, relê bytes e confere digest/autorização sem novo upload. 11 testes Deno focados e 14 testes SQL em rollback passaram; 1003 ainda não aplicada permanentemente. Em cluster e Storage FILE descartáveis internos, handler+adapter+SQL reais passaram upload, replay, detecção de bytes adulterados e recusa de usuário revogado. `manual-storage-integracao.mjs` usa autenticação e rate-limit simulados, SQL direto e não exercita index HTTP; containers/rede/fixtures descartáveis removidos. Leitura/realização, autenticação HTTP real e revisão adversarial pendentes; gates fechados.

## 2026-10-30 — Travas, origem de revisão e comprovantes (Codex)

- S165: ADR-0804/1001 adicionam duas fontes legadas ao protocolo de trava de impacto; testes em duas sessões demonstraram exclusão real de Plano legado impedida sob contenção. ADR-0807/1004 mantêm evento de auditoria correlacionado obrigatório, mas contam comandos, evitando que evento duplicado privilegiado torne prévia indisponível; casos divergentes, corretos e dois comandos testados em rollback. Cobertura de todas as fontes, concorrência, revisão adversarial e aprovação permanecem pendentes; gate fechado.
- S166: ADR-0805/1002 coordenam as quatro fronteiras existentes de materialização com trava global antecipada sob gate. Testes em duas sessões passaram 9/9 para precedência/ACL/gate e 4/4 por isolamento antigo; teste de uma sessão criou uma ocorrência sintética e repetiu comando idempotente 6/6, sem OS/outbox. Não comprova replay entre sessões, todos escritores, PMOC ou revogação; gate fechado.
- S180: Storage FILE local isolado devolveu bytes substituídos ao solicitar `versionId` anterior; esse campo/rota não prova imutabilidade. ADR-0806/1003 preparam reserva, autorização prévia e confirmação auditadas (13 testes SQL em rollback); 1005 media por service_role (5 testes SQL em rollback). Endpoint e adapter de ingestão preparados com autenticação, limite, upload sem sobrescrita, hash e reautorização; 10 testes Deno simulados e `deno check` passaram. Faltam prova ponta a ponta com Storage/RPC, conexão à realização e à leitura e revisão adversarial; SQL não atesta bytes nem garante imutabilidade. Flag e gates fechados, políticas atuais inalteradas; sem deploy.
- Base diagnóstica: rede interna, cron desativado, fila HTTP vazia. Outbox tem seis categorias semeadas no bootstrap, pendentes com zero tentativas; não despachar. Uma consulta somente leitura de histórico remoto não respondeu e foi interrompida; migrations históricas não foram alteradas. Sem deploy ou tarefa real nesta rodada.

## 2026-10-30 — CSV, vínculos e mediação de código (Codex)

- S169: nova seleção CSV bloqueia envio da matriz anterior durante leitura, erro ou decisão pendente; descartar cancela leitura tardia sem apagar matriz. Quatro testes UI passaram. Isso não conclui XLSX, staging ou importação completa.
- S172: ADR-0802/0999 incluem vínculos declarados da revisão atual no snapshot V5 sob flag separada. 9 pgTAP em rollback, testes UI e typecheck passaram. Não transporta vínculos históricos nem calcula cobertura/saldo; faltam fontes e revisão adversarial.
- S177: ADR-0803/1000 preparam mediação por Cliente da consulta e edição de rascunho, com autorização atual e gates fechados; UI conectada. 13 pgTAP em rollback com fixture diagnóstica persistente, 4 testes de regressão UI e typecheck passaram. Fixture precisa tornar-se independente para CI; etiqueta real e concorrência de todos escritores pendentes.
- S180: protótipo de recuperação concluída exige versão imutável, releitura e digest, e reautoriza; 6 testes Deno simulados passaram. S178 também lê por nome e não fornece versão imutável; nenhum provedor real foi demonstrado. Upload segue bloqueado; políticas atuais não foram alteradas.
- 28 testes web focados e typecheck passaram. As migrations S172/S177 foram renumeradas para 0999/1000 sem lacuna; não foram aplicadas permanentemente. Rede diagnóstica interna, cron desligado; sem deploy ou tarefas reais nesta rodada.

## 2026-10-30 — Conciliação declarada e concorrência (Codex)

- S172: ADR-0798/0997 preparam eventos de inclusão/retirada de intervalos em totais semanais, por Cliente, disponibilidade e revisão, auditados e idempotentes; 15 pgTAP em rollback na rede interna, outbox inalterada. ADR-0799/0998 e UI sob flag fechada preparam mediação, consulta e histórico: 8 pgTAP e 6 testes UI, com revogação sequencial, passaram. É declaração humana, não cobertura provada nem saldo. Revogação concorrente e revisão adversarial pendentes; 0997 apresenta 6 avisos Squawk sobre transação explícita, atomicidade do executor ainda requer confirmação.
- S177: cenários de duas sessões em Sistemas e Componentes testaram disputa de edição com OS ou sincronização sintética, incluindo ambas ordens para sincronização de Componente. Resultados e limites em `supabase/manual-tests/E01-S177_concorrencia_codigos.md`. Fixtures sintéticas 17799500-* e marco/sync fictício permanecem apenas na base isolada; gates restaurados. Etiquetagem e outros escritores não estão provados; não liberar.
- S180: cluster independente em rede interna, cron inativo e sem porta testou dispatcher experimental/S184: 14 verificações e duas ordens de revogação no recorte testado. Container e rede descartáveis removidos; sem policies persistidas na base compartilhada. ADR-0800/0996 preparam funções privadas desconectadas, com 8 testes de catálogo em rollback. Não prova equivalência geral, integridade de bytes ou Storage real; teste 0966 segue vermelho e gate fechado, sem ativar policies.
- S165: 84 testes focados da interface de Plano passaram; não comprovam aprovação completa nem integração legada. Typecheck web passou. Base 55522 continua interna, crons desativados; nenhuma homologação ou deploy.

## 2026-10-30 — Rede diagnóstica, CSV e capacidade (Codex)

- **Segurança do ambiente:** a recriação anterior iniciou a 55522 numa rede Docker não interna e com 12 jobs locais ativos. Dois jobs de drain rodaram sete vezes antes de serem desativados; suas funções retornam sem chamar HTTP se faltarem secrets e não há esses quatro secrets no Vault local agora. Fila e respostas `net` estão vazias agora, mas isso não prova retrospectivamente todos os efeitos. Uma OS sintética S177 foi inserida antes da descoberta, sem GUC anti-Auvo; trigger direto de Auvo não constava na base, sem prova completa de efeitos transitivos. Não afirmar ausência comprovada de qualquer tentativa anterior.
- O container `supabase_db_SSO-ordem-diagnostica` agora está exclusivamente em `sso-diagnostico-isolado-20261030` (Docker internal=true); os 12 jobs cron estão desativados. Acesso via `docker exec`, não reativar cron nem religar rede externa. Fixture S177 17799500-* permanece na base descartável. Base foi construída com cópias diagnósticas das migrations históricas; não equivale ao bootstrap oficial.
- S169: conferência CSV reconhece duração inteira ou decimal simples de até duas casas, conserva texto original e sinaliza formatos ambíguos/negativos como inválidos; zero permanece Tempo a validar. Teste falhou antes e passou após correção. Datas e demais campos não são inferidos; XLSX continua pendente.
- S172: ADR-0796/0994 preparam snapshot conjunto de disponibilidade declarada e demanda parcial, com flag desligada e aviso de fontes incompletas/sobreposições. 10 pgTAP em rollback sob rede isolada, 6 testes UI e typecheck passaram. Não representa saldo validado; gates e homologação fechados.
- S177: teste em duas sessões reproduziu núcleo privado 0363 aceitando edição com snapshot REPEATABLE READ anterior à OS; edição revertida, sem comprovar acesso público. ADR-0797/0995 preparam recusa de isolamento antigo no wrapper privado, 3 pgTAP em rollback na rede isolada. Corrida READ COMMITTED e todos os escritores ainda precisam de prova; gate fechado.
- S180: experimento de policies em rollback passou 14 verificações, incluindo S184 e autorização de upload sintético; equivalência completa e revogação concorrente ainda não provadas. 0966 permanece vermelho e nenhuma policy experimental persistida. Não habilitar gates nem fazer deploy ou operação real.

## 2026-10-30 — Reconstrução do ambiente e proteção de tentativas (Codex)

- Colima foi recriado após autorização; três bancos locais descartáveis anteriores e imagens foram removidos. Base `supabase_db_SSO-ordem-diagnostica` recriada na porta 55522 a partir de cópias diagnósticas em `/tmp/sso-ordem.kUg0HT`; 0962–0993 aplicadas diretamente, sem registrar histórico oficial. Seis migrations históricas têm correções apenas nessas cópias; isso não prova bootstrap oficial nem histórico remoto. Nenhum banco remoto foi alterado.
- S172: ADR-0795/0993 expõem prova individual de finalização PCM no snapshot sob flag separada, sem afirmar conclusão da ocorrência ou capacidade completa; 9 pgTAP em rollback na base anterior e 13 testes web passaram. Interface de intervalos preserva tentativa divergente e alerta sobre sobreposição nos dados carregados, sem desconto automático; paginação e dados inválidos são sinalizados. Gate permanece fechado.
- S177: substituição excepcional verifica identidade da sessão antes e depois do envio, preserva tentativa se a sessão mudar e isola o componente por usuário/Cliente. Não substitui autorização do servidor nem elimina corrida entre checagem e envio; gate fechado.
- S182: invalidação de cache de correção/estorno abrange saldo, contexto, histórico e relatórios; teste de resposta incerta preserva request. Não comprova concorrência no servidor.
- Validação atual: typecheck e 22 testes web focados passaram. S180/0966 continua com 9/10 pgTAP: INSERT falha por ACL de helper de outro bucket. Experimento revertido confirmou alteração do comportamento de bucket legado; não liberar dispatcher nem gate sem prova de compatibilidade e segurança. Sem deploy, Auvo ou Financeiro real.

## 2026-10-30 — OS sem Visita e códigos excepcionais (Codex)

- S172: ADR-0794/0992 ampliam snapshot para OS abertas sem Visita quando semana é comprovada por agendamento/fuso de origem validada ou vencimento legado; não resolvidas contam pendentes, sem atribuição arbitrária. 13 pgTAP em rollback e testes UI passaram. Sem execução comprovada, fontes >100, Grupo/Visita e desempenho por OS ainda exigem prova; não afirmar saldo completo e manter gates fechados.
- S177: 10 testes pgTAP em rollback validaram correção excepcional já existente, aliases, auditoria, colisão, imutabilidade e replay. Concorrência entre sessões e integração Auvo não comprovadas; códigos existentes preservados.
- S176: proteção de inativação não é segura somente por contagem porque escritores de rotinas/ocorrências/OS não compartilham lock comprovado; 0991 permanece com gate fechado.
- S182: correção de duplo submit em estorno/complemento preserva tentativa. Typecheck e 15 testes web focados passaram. S180 INSERT Storage continua vermelho; sem deploy ou operação real.

## 2026-10-30 — Snapshot parcial e estado de Grupos (Codex)

- S172: ADR-0791/0990 preparam snapshot STABLE único de até 100 fontes de Visita e 100 ocorrências sem OS, com subtotal próprio/terceiros e indicador de limite. 13 pgTAP em rollback; UI sob flag separada, sem afirmar saldo completo. Faltam OS sem Visita, estados reais, prova do limite e concorrência; gates fechados.
- S176: ADR-0792/0991 e UI sob flag preparam ativação/desativação auditada e listagem de inativos com revisão, permissão atual, replay e verificação de vínculos. 13 pgTAP em rollback, 24 testes frontend; não altera códigos, quantidade ou programação. Impacto em rotinas, revisão adversarial e homologação pendentes.
- S182: conferência de estornos protege contra duplo submit e mantém request após incerteza; 2 testes simulados. Concorrência entre abas/servidor não comprovada.
- Typecheck e 37 testes web focados passaram. 0966 S180 ainda possui teste INSERT Storage vermelho; sem deploy ou operação externa.

## 2026-10-30 — Ocorrências sem OS e conferência de cancelamentos (Codex)

- S172: ADR-0788/0988 preparam consulta paginada de ocorrências por vencimento sem OS identificada e UI com subtotal separado; exclui vínculos conhecidos, mantém Visita sem HH explícito como desconhecida e não presume programação/execução. 10 pgTAP em rollback e testes de UI passaram. Sem snapshot combinado, não somar ao subtotal de OS nem afirmar saldo completo; faltam origem Visita/Grupo positiva e concorrência.
- S178: ADR-0789/0989 e UI preparam listagem e conferência auditada de reservas canceladas por Cliente/lote/linha, sem caminhos, digest ou remoção de objeto. 12 pgTAP em rollback e 18 testes frontend passaram; metadado é retrato temporal e não prova presença física ou autoriza descarte. Gate fechado.
- S181: dispensa de orçamento evita duplo submit e preserva retry; 2 testes focados passaram. Concorrência entre abas/servidor pendente.
- Typecheck e 24 testes web focados passaram. Teste INSERT Storage 0966 continua vermelho; sem deploy ou efeitos externos.

## 2026-10-30 — Isolamento de cancelamento e subtotal de esforço (Codex)

- S178: falha real sob REPEATABLE READ permitia cancelamento com snapshot antigo não enxergar reserva. ADR-0786/0987 recusam isolamentos diferentes de READ COMMITTED; 11 testes de autorização/replay, 4 de concorrência e 2 de isolamento passaram no clone descartável. Clone sintético removido; gate fechado, compatibilidade de clientes exige revisão.
- S172: subtotal declarado exclui OS distintas com mesma ocorrência ou declarações conflitantes, sem somar terceiros como interno; permanece incompleto e não prova execução nem saldo. 7 testes focados passaram; 0987 não foi usada por esta frente.
- S181: preço e ações ficam ocultos enquanto autorização é revalidada ou falha; 3 testes focados passaram. Revogação real no servidor não comprovada.
- Typecheck e 10 testes web focados passaram; teste INSERT Storage 0966 permanece vermelho. Nenhum deploy ou serviço real.

## 2026-10-30 — Escopo por origem e cancelamento de fotos (Codex)

- S172: ADR-0781/0983 e ADR-0783/0985 preparam declaração versionada de escopo executado/restante por OS e origem conferida por 0726, com UI mediada sob flag; texto é declaração, não execução comprovada. Testes 12/12, 4/4 e 15/15 pgTAP em rollback; faltam concorrência, origens Visita/Grupo, integração do saldo e revisão. Gates fechados.
- S178: ADR-0782/0984 permitem cancelamento auditado de reserva, bloqueando confirmação tardia sem apagar objeto; 9 pgTAP e 8 testes em duas sessões passaram. ADR-0784/0986 registram tombstone para pedido cancelado antes da reserva; 8 pgTAP novos, 9 de regressão e 8 testes concorrentes em clone passaram. Clones temporários sintéticos removidos após verificar zero conexões; sem Storage real. Ainda há possível objeto órfão privado e requer revisão/gate fechado.
- S181: transição de orçamento evita duplo submit e preserva retry; 2 testes focados. Typecheck e 21 testes web focados passaram nesta rodada. S180 INSERT Storage continua vermelho; sem deploy ou operações reais.

## 2026-10-30 — Subtotal parcial e conferência de foto (Codex)

- S172: ADR-0778/0981 preparam projeção paginada de declaração por OS/Cliente e UI de subtotal das OS carregadas; deduplica IDs, separa terceiros e marca dados ausentes/zero/conflitantes como pendentes. 9 pgTAP em rollback e testes focados passaram. Não cobre ocorrências desvinculadas, deduplicação OS/ocorrência ou semana completa; não é saldo consolidado. Gates/flag desligados.
- S178: ADR-0780/0982 e interface permitem PCM autorizado consultar histórico de conferência por request/Cliente/lote/linha sem sessão original, sem afirmar estado atual ou alterar objeto. 7 pgTAP em rollback e 12 testes frontend passaram; tratamento definitivo de objetos ausentes ainda exige procedimento seguro. Gate desligado.
- S180: teste experimental de dispatcher teve 49 verificações positivas/negativas, mas alteração pode restaurar uploads legados hoje bloqueados e falta prova de equivalência e revogação concorrente. Sem migration/policy permanente; teste INSERT 0966 segue vermelho.
- Typecheck e 19 testes focados de capacidade/fotos passaram; sem deploy, Storage real, Auvo ou Financeiro real.

## 2026-10-30 — Tentativas de esforço e observação de fotos (Codex)

- S172: tentativa de declaração é persistida em sessionStorage por usuário/Cliente/OS antes do envio; recarga repete mesmo request/revisão e divergência não limpa a tentativa. 7 testes UI focados e typecheck passaram. Encerramento definitivo da aba pode perder sessionStorage; reconciliação persistente e capacidade consolidada seguem pendentes.
- S178: ADR-0777/0980 preparam observação auditada e idempotente de reserva sem objeto catalogado; integrada ao retry sem reenviar, apagar ou confirmar. 9 pgTAP em rollback e 22 testes Deno simulados passaram. Não conclui conciliação de órfãos nem prova ausência de upload em andamento; gate fechado.
- S180: dispatcher experimental passou 49 testes transacionais, incluindo seis buckets e negações, mas não prova equivalência ou revogação concorrente e pode alterar comportamento efetivo legado. Nenhuma policy foi alterada permanentemente; INSERT de 0966 permanece vermelho. Sem deploy ou serviço externo.

## 2026-10-30 — Fonte declarada de capacidade e mediação (Codex)

- S172: ADR-0773/0977 criam fonte declarativa append-only de minutos próprios, terceiros e acompanhamento por OS/ocorrência, permitindo desconhecido; 16 pgTAP em rollback. 0978 media leitura/escrita e UI sob flag; 8 pgTAP em rollback. ADR-0775/0979 mediam fonte de Visitas 0356, sem grant direto; 12 pgTAP incluindo duas páginas não vazias e isolamento em rollback. Nenhuma migration aplicada permanentemente; gates fechados.
- Declaração ainda não consolida ou deduplica demanda, não calcula realizado/restante automaticamente e precisa de retry persistido após navegação/reload, prova concorrente e revisão adversarial. Squawk aponta avisos prefer-robust-stmts em 0977 e 0979; revisar. Typecheck e 12 testes focados de interface/domínio passaram.
- S178: limites de taxa para ingestão/leitura de fotos foram adicionados; 21 testes Deno simulados passaram. Reserva com objeto ausente permanece pendente sem reupload automático, por segurança; sem Storage real.
- S180: 30 testes de predicados dos seis helpers Storage passaram em transação como owner com claims simuladas. Não comprovam a política real; teste de INSERT 0966 continua vermelho e correção compartilhada não foi liberada. Sem deploy nem efeito externo.

## 2026-10-30 — Concorrência de recuperação e fontes de permissão (Codex)

- S178/0975: teste real com duas sessões em clone descartável passou 6/6, observou lock e confirmou um único registro/replay e revogação negada. Clone temporário `sso_foto_0975_tmp_20261030` removido após checar zero conexões; não havia dados reais nele. Sem Storage externo: alteração privilegiada de bytes continua sem prova.
- S168/0976: 10 fontes de autorização bloquearam UPDATE concorrente via lock compartilhado em duas sessões, 10/10 em rollback. Isso prova triggers, não todos fluxos reais. Versão aprovada é protegida e escritores inspecionados usam lock do retorno; ainda falta auditoria completa do snapshot e demais escritores.
- S180: teste isolado demonstrou que o conflito de policies Storage também impede INSERT no bucket legado `atendimento-midias`; alterar políticas pode impactar outros módulos. Tudo revertido, teste de 0966 continua vermelho e gate fechado. Sem deploy ou serviço externo.
- S172: filtro parcial da capacidade normaliza qualquer dia à semana segunda–domingo, inclusive virada de ano; 9 testes focados passaram. Calendário global, demanda, saldo e terceiros ainda não integrados; gate não aberto.

## 2026-10-30 — Recuperação de fotos e autorização de finalização (Codex)

- S178: ADR-0770/0975 preparam recuperação de reserva pendente pelo mesmo request/lote/linha/ator/digest, sem sobrescrever; relê bytes, compara hash e reautoriza antes de confirmar. 7 pgTAP em rollback e 19 Deno simulados passaram; gate desligado. Falta prova concorrente real, integração Storage e revisão; alteração privilegiada entre leitura e confirmação é detectada na leitura posterior, não impedida.
- S168: falha reproduzida de revogação após última checagem permitia finalização. ADR-0771/0976 coordenam fontes de autorização pelo lock existente e recusam isolamento antigo; duas ordens passaram em 55522, com 15 testes de regressão em rollback. Cobertura concorrente exercita concessão direta, não cada fonte de perfil/grupo/módulo; snapshots e homologação seguem pendentes. Gates restaurados, fixtures append-only 16898000/16899000 permanecem no banco descartável.
- S183: confirmação de Visita rejeita timestamp inválido e preserva tentativa pendente; 2 testes simulados passaram. Typecheck web passou. Sem operação externa, deploy ou liberação de gates.

## 2026-10-30 — Integração experimental e autorização de fotos (Codex)

- S178: ADR-0768/0973 preparam mediadores restritos a service_role, endpoints de ingestão/leitura por digest, adapter com nome reservado e `upsert:false`, e UI sob flag própria desligada. Testes isolados: 11 pgTAP, 15 Deno e 6 UI passaram; typecheck passou. Faltam rate limit, recuperação de reservas pendentes/órfãos, provas integradas e revisão adversarial; service_role segue fronteira privilegiada.
- Auditoria reproduziu autorização revogada aceita sob REPEATABLE READ em 0973. ADR-0769/0974 preparam recusa de isolamento antigo e coordenação de autorização/gates; teste red/green e 22 pgTAP passaram na 55322. Faltam provas determinísticas de gate, READ COMMITTED, confirmação/leitura e SERIALIZABLE; transação não cobre Storage ou revogação externa de JWT. Gates false.
- S168: ADR-0766/0972 seguram gates de finalização até commit; duas ordens concorrentes passaram e 14 testes pgTAP passaram na 55522. Revogação após última checagem e snapshot ainda não comprovados. Gates restaurados; fixtures append-only 16895000/16896000 permanecem nessa base.
- S180: mediação experimental de comprovante segue desconectada e falha fechada sem versão imutável; 5 testes simulados passaram. Teste INSERT Storage de 0966 permanece vermelho. Nenhum deploy ou operação real.

## 2026-10-30 — Mediação da finalização e proteção do Portal (Codex)

- S168: ADR-0764/0971 preparam três mediadores para prévia, finalização v2 e consulta de tentativa legada, conectados à UI sob gate novo desligado; funções internas continuam revogadas. 12 testes pgTAP passaram em rollback com FKs/triggers; 9 testes focados web e typecheck passaram. Revogação durante transação e concorrência entre mediadores não foram provadas; sem aplicar 0971 permanentemente, sem homologação.
- S183: exportação PDF interrompe download após desmontagem/troca de Conta; teste reproduziu vazamento de contexto e 4 testes focados passaram. Não comprova todas exportações nem revogação global.
- S178: handler experimental exige o caminho da reserva 0968 antes de upload, com 11 testes Deno simulados. Adaptador real, mediação de serviço e leitura por digest continuam pendentes; gate fechado.
- S180: teste INSERT Storage segue vermelho por conflito de ACL entre políticas compartilhadas; sem deploy ou operações externas reais.

## 2026-10-30 — Fechamento concorrente e isolamento de fotos (Codex)

- S168/0969: 4 testes com FKs e triggers normais passaram para fechamento, replay e negações. Teste de duas sessões observou segunda sessão aguardando lock advisory e recebendo resultado idêntico; uma finalização. Aprovação semeada não prova jornada humana ou todos escalonamentos. Gates e grants temporários restaurados; 0969 aplicada só na 55522 fora de ordem, fixtures append-only 16891000 permanecem.
- S178: ADR-0762/0970 preparam isolamento das fotos novas nos resolvedores/vínculos antigos. RENAME inicialmente permitia que views existentes mantivessem referência ao OID antigo; correção usa CREATE OR REPLACE preservando OIDs. 18 testes em transação revertida passaram, incluindo view anterior e quatro outros resolvedores (fotos novas bloqueadas, legadas acessíveis). Fixtures desses vínculos foram inseridas com triggers temporariamente desativados no preparo e restaurados antes dos testes; não comprovam integridade de criação real. Faltam concorrência, auditoria dos OIDs internos dos RENAME históricos 0551/0570 e mediação. Gate de ingestão fechado.
- S169: investigação de leitor XLSX em `docs/planejamento/plano-manutencao/avaliacao-leitura-xlsx-segura.md`; alternativas ainda sem prova dos limites necessários. CSV disponível; XLSX não liberado.
- 0966/S180 mantém teste vermelho por ACL de outras políticas Storage. Sem deploy ou efeito externo real.

## 2026-10-30 — CSV de cronograma e ingestão de fotos (Codex)

- S169: Workspace aceita CSV UTF-8 separado por `;`, preserva células como texto, limites e rejeita sintaxe inválida. Preencher matriz exige ação do usuário e não grava automaticamente; XLSX não implementado. 4 testes focados e typecheck passaram; sem serviço externo.
- S178: ADR-0761/0968 preparam ledger privado e auditado para reserva/confirmação de digest e caminho, sem EXECUTE para usuários ou service_role e gate fechado. 11 testes pgTAP passaram em transação revertida na 55522; objeto sintético não comprova bytes nem corrida Storage/banco. Handler experimental de ingestão e leitura passou 9 testes com mocks, continua desconectado; falta mediador confiável, nome reservado no adapter, leitura segura obrigatória e reconciliação.
- S168: ADR-0760/0969 preparam comando que valida OS esperada antes da transição e consulta somente leitura para tentativa legada; ausência não autoriza retry. 15 testes pgTAP em rollback e 5 testes de interface passaram; fixtures SQL inseridas com FKs desativadas localmente não provam integridade nem fechamento positivo. Falta concorrência, mediação/grants e revisão; gates fechados, migration não aplicada permanentemente.
- Documentação oficial de Storage indica que versionamento S3 não está disponível (https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/s3/compatibility.mdx) e recomenda novo caminho em vez de sobrescrita (https://supabase.com/docs/guides/storage/uploads/standard-uploads). Digest na leitura detecta alteração de bytes, não impede escrita privilegiada nem protege digest adulterado.
- 0966/S180 ainda tem teste vermelho de INSERT por outras políticas Storage. Nenhum deploy ou operação real; homologação bloqueada.

## 2026-10-30 — Fechamento de OS, aliases e concorrência financeira (Codex)

- S168: finalização exige nova confirmação se prévia da OS, atestação ou revisão muda; resposta de outro retorno não limpa tentativa. Testes UI passaram. `osId` de resposta ainda não é comparado para pedidos pendentes legados; contrato versionado permanece pendente.
- S177: busca existente retorna código atual e alias por Cliente; 7 testes pgTAP em rollback passaram, inclusive Cliente e revogação, e 6 testes UI passaram. Sem alteração de códigos ou dados externos.
- S182: três disputas de reserva/alocação/conversão em READ COMMITTED com RPC real e fixtures sintéticas demonstraram recusa da segunda operação; sincronização por tempo, sem captura de locks, não prova todos os escalonamentos. Ordem alocação antes de conversão não foi exercitada com sobreposição. Gates e grants temporários restaurados; fixtures append-only prefixo 18290000 permanecem na 55522 descartável. `supabase/tests/manual_s182_reserva_concorrencia.md` registra limites.
- Typecheck web passou. Teste S180 de INSERT Storage continua vermelho e gate permanece fechado; sem deploy ou cobrança/Auvo real.

## 2026-10-30 — Retorno PCM e saldo reservado (Codex)

- S168: tela de decisão e aprovação PCM valida identidade, requestId e revisão esperada da resposta, mantendo tentativa para repetição quando divergente. Jornadas simuladas passaram; sem Auvo real. Gate servidor permanece fechado.
- S182: teste integrado serial comprovou bloqueio de alocação com reserva ativa, conversão, replay e saldo antes/depois: 7/7 na 55522, tudo rollback e Auvo suprimido. Não prova concorrência, autorização completa ou homologação.
- S177: listagem de aliases ganhou reinício desde a primeira página; 4 testes simulados passaram. Paginação não representa snapshot transacional e revisão adversarial segue pendente.
- Regressão web passou 1.864 testes e ignorou 20, com Supabase fictício; typecheck passou. O teste de banco S180 citado abaixo continua vermelho e não foi incluído nessa suíte web.
- 0966/S180: teste pgTAP continua vermelho por permissões de políticas Storage de outros buckets. A fixture agora suprime enqueue sintético Auvo; não liberar gate. Sem deploy ou operações externas reais.

## 2026-10-30 — Respostas de Visita e aliases (Codex)

- S171: adapter valida `requestId` e agregado nas respostas de comandos, preserva tentativa pendente divergente e rejeita leitura de outro Cliente ou Visita. 31 testes focados e typecheck passaram; defesa client não substitui RLS. Biome aponta formatação preexistente nos arquivos tocados.
- S177: ADR-0754/0967 e UI sob flag preparam consulta paginada de códigos anteriores, com autorização por Cliente e gate desligado. 9 testes pgTAP em transação revertida e 3 testes UI simulados passaram. Não alterou códigos existentes; concorrência e revisão adversarial pendentes.
- S180: 0966 aplicada somente à base 55522; teste de upload segue vermelho por ACL de outra política Storage. Não habilitar o gate nem conceder helpers de outros buckets sem revisão completa. 0967 testada somente em rollback, não aplicada permanentemente.
- Sem deploy ou operação externa. Homologação bloqueada.

## 2026-10-30 — Mediação de comprovante e progresso (Codex)

- ADR-0751/0966 preparam mediação de upload de comprovante com gate fechado, aplicadas somente na 55522. Teste `E01-S180_mediacao_upload.test.sql` está vermelho: 9/10 passaram, INSERT Storage falha por EXECUTE revogado em helper de outra política. Reescrita experimental com CASE não corrigiu e foi revertida; não liberar acesso aos demais buckets nem conectar adapter até resolver e auditar políticas compartilhadas.
- S167: cálculo de progresso centralizado em domínio, usa status reais e recusa lista incompleta; detalhe integrado. 8 testes focados e typecheck passaram. Card gerencial segue pendente: quadro de OS usa filtros e paginação que não garantem agregado completo, e visibilidade do feed por Chamado precisa definição segura.
- S173: ordem inversa de associação Grupo e mudança de origem testada na 55422; associação esperou e recusou origem já existente. Gates usados voltaram a false; demais escritores/isolamentos ainda não comprovados. Fixtures sintéticas append-only permanecem na base descartável.
- Sem deploy ou efeito externo real; gates e homologação permanecem fechados.

## 2026-10-30 — Permissão na Central e guardas de origem (Codex)

- S179: páginas anteriores ficam visíveis apenas em falhas temporárias reconhecidas na paginação; acesso negado ou erro não classificado oculta dados anteriores. Testes reproduziram o vazamento e passaram após ajuste. Suíte web passou 1.854 testes, 20 ignorados; typecheck passou, Supabase fictício.
- S167: detalhe exibe `Em andamento` para mistura de OS finalizada e cancelada, preservando estados individuais; 6 testes focados e Biome passaram. Card gerencial e homologação não comprovados.
- S173: RPC 0402 real passou três testes negativos para Grupo e origem ausente. Com 0826/0965 ativos apenas na 55422, mudança de origem aguardou associação Grupo e foi recusada; ordem inversa e corrida na RPC completa ainda faltam. Gates restaurados a false; fixtures append-only prefixo 17360000 permanecem na base descartável.
- S180: 0412 já permite upload para despesa realizada ativa, mas funções usadas por política Storage e adapter permanecem sem EXECUTE; não conceder acesso sem mediação e prova de segurança/concorrência. Sem deploy nem integrações reais.

## 2026-10-30 — Central de Materiais e investigação de geradores (Codex)

- S179: Central preserva páginas já carregadas quando falha a próxima página e repete somente a página faltante. Teste reproduziu falha antes e passou após correção; erro geral ainda oculta dados anteriores. Typecheck web passou; suíte web passou 1.852 testes e ignorou 20, com Supabase fictício.
- S166: ADR-0747 inventaria gerador legado, cron, webhook e PMOC. Agenda PMOC não possui identidade comprovada com alvo SSO e criação ocorre em escritas separadas; lock isolado não prova coordenação. Sem migration nova; gate de tratamento de vencidos permanece fechado.
- S173: auditoria da RPC 0402 apontou pré-condições que impedem reproduzir ambas as ordens do teste privilegiado de Grupo na mesma OS; ainda faltam testes da RPC real e mudanças concorrentes de origem. Não concluir segurança global nem liberar gate.
- S178: ingestão imutável real continua sem contrato de Storage comprovado; protótipo permanece desconectado. Sem deploy ou serviços externos.

## 2026-10-30 — Coordenação experimental e fotos (Codex)

- ADR-0742/0964 revalidam e coordenam permissão/gates para mediação e recibo de foto, recusando REPEATABLE READ/SERIALIZABLE. Teste de duas sessões reproduziu recibo após revogação na 0963 e passou com 0964; 9 testes focados passaram. Faltam outras corridas, compatibilidade e revisão. Gate fechado.
- ADR-0744/0965 preparam coordenação experimental fail-closed por OS para Grupo/retorno, com gate novo desligado. Duas ordens de disputa e rejeição de isolamentos antigos passaram em teste manual na 55422; retorno foi INSERT owner, não RPC 0402, e não prova todos escritores. 0903 mantém bloqueio; fixtures append-only 17370000/17380000 permanecem nessa base descartável.
- Na 55522, 0964 e 0965 foram aplicadas em ordem por psql após sequência diagnóstica anterior; 1.706 testes passaram em 113 arquivos. Gates experimentais desligados; histórico de migrations não atualizado, seis correções de bootstrap só em cópia temporária, não equivale a CI.
- Protótipo isolado de ingestão server-side em `supabase/functions/pcm-foto-ingestao-segura/handler.ts` calcula digest e falha fechado sem versão imutável; cinco testes simulados passaram. Não possui endpoint/adapters/reserva reais e não comprova Storage; não liberar. ADR-0743 registra limites.
- Nova tentativa somente leitura de `supabase migration list --linked` não respondeu e foi encerrada; histórico externo continua sem comprovação. Nenhum deploy ou efeito real no Auvo/Financeiro.

## 2026-10-30 — Sequência ordenada e evidências concorrentes (Codex)

- Base diagnóstica nova `SSO-ordem-diagnostica` na porta 55522 aplicou migrations até 0961 em ordem e passou 1.697 testes em 112 arquivos. Seis correções de bootstrap continuam apenas nas cópias temporárias; não comprova sequência oficial ou CI. Rede interna, sem integração externa.
- S173: duas sessões demonstraram coexistência de retorno e vínculo Grupo apesar de 0960. Retorno foi inserido por owner para provar guarda de tabela, não RPC completa. Fixtures sintéticas com prefixo 17390000 foram confirmadas na base 55422 e permanecem por imutabilidade; limpeza segura é descartar a base, não desativar proteções. Gate 0903 segue fechado.
- 0961 apresentou falha de autorização sob REPEATABLE READ por snapshot antigo. ADR-0739/0962 recusam REPEATABLE READ e SERIALIZABLE antes dos efeitos, preservando READ COMMITTED; testes concorrentes e 57 verificações focadas passaram. Avaliar compatibilidade dos consumidores e revisão adversarial antes de homologar.
- Foto S178: chamada direta da RPC 0524 estava revogada para authenticated. ADR-0740/0963 preparam mediação com gates e recibo restrito; 9 testes pgTAP e 3 testes UI simulados passaram. Não comprova bytes ou recuperação de upload sem vínculo confirmado; nenhuma aplicação remota.
- Após a sequência diagnóstica até 0961, 0962 e 0963 foram aplicadas em ordem na 55522: suíte passou 1.706 testes em 113 arquivos. As seis correções anteriores continuam somente em cópias temporárias. 0962/0963 foram aplicadas via psql, sem registro em histórico de migrations.
- ADR-0741 e scripts `supabase/tests/manual_s173_concorrencia_*.sql` registram reprodução e protocolo candidato Grupo/retorno; fixture e operações fazem COMMIT, só usar base descartável. Scripts usam temporização e INSERT como owner, não provam RPC completa nem todas as ordens. Sem migration 0964; gate segue fechado.

## 2026-10-30 — Guardas de associação e autorização (Codex)

- ADR-0736/0960 bloqueiam associação Grupo a OS com retorno ou Pendência anteriores quando o gate correspondente está ativo; teste S174 reproduziu falha e passou 24/24 após correção. Aplicada nas duas bases descartáveis. Não resolve corrida entre associação e retorno; 0903 segue fechado.
- ADR-0737/0961 adicionam lock compartilhado de autorização à ativação, usando coordenação de escritores 0319 e falha fechada quando ocupado. Testes concorrentes para avulso/residente e 48 verificações focadas passaram na primeira base descartável; depende de triggers ativos e não prova caminhos privilegiados, identidade externa ou contenção. Sem homologação/deploy.
- Suíte web: 1.848 passaram, 20 ignorados, com Supabase fictício. Banco: 1.697 verificações em 112 arquivos passaram na segunda base após 0960; não contém 0961, 0958 foi aplicada antes de 0957 e bootstrap usou seis cópias temporariamente corrigidas. Não representa CI ou sequência oficial limpa.
- Fotos de levantamento: falha de upload deixa de chamar RPC e mantém contexto; dois testes simulados passaram. Resultado incerto de upload ainda requer recuperação segura; identidade dos bytes e Storage real não comprovados.

## 2026-10-30 — Concorrência e regressão ampliada (Codex)

- ADR-0735/0959 revalidam permissão após bloqueios de ativação. Roteiro de duas sessões passou cinco cenários, inclusive revogação durante espera para contratos avulso e residente, e exclusão confirmada; regressões pgTAP 19/19, 8/8, 10/10. Aplicada só na primeira base descartável. Revogação após a última checagem não está serializada; manter gate de homologação.
- S173: análise aponta que 0823 pode vincular Grupo a OS com retorno já existente; 0903 só impede inserções posteriores. 0530/0552 e 0823 usam locks compatíveis na OS. Auditar todos os escritores e provar exclusão mútua em ambas as ordens antes de mudar gate.
- Fotos privadas: identificação por caminho ou storage.objects.id não comprova imutabilidade dos bytes contra escrita privilegiada. Definir prova de hash/versão, política de legado e concorrência antes de liberar gates.
- 0957: teste de duas sessões agora também confirmou que exclusão confirmada antes da ativação impede ativação e plano; fixtures sintéticas removidas e verificadas. Revisão de revogação durante espera está em andamento.
- 0958: quatro disputas entre vinculação e mudança de Cliente passaram em duas sessões na segunda base; fixtures sintéticas removidas e verificadas. Teste usa temporização e não prova todos os escritores nem ausência de deadlock.
- Após aplicação diagnóstica de 0958 e depois 0957, suíte pgTAP passou 1.696 testes em 112 arquivos. Ordem das duas últimas foi invertida nessa base e bootstrap usou seis cópias corrigidas: não comprova sequência oficial limpa ou CI. Nenhuma operação real externa.
- S166: estado de abertura da simulação exposto a tecnologia assistiva, com jornada de Workspace em fixture; 33 testes focados passaram. Não conclui implementação de calendário; integração com geradores e locks globais continua pendente.

## 2026-10-30 — Sequência diagnóstica e concorrência (Codex)

- ADR-0733/0957 bloqueiam e revalidam proposta durante ativação do contrato. Teste com duas sessões reproduziu a corrida anterior e, após correção, comprovou espera nos dois sentidos; roteiro `supabase/manual-tests/E03-S07_ativacao_proposta_duas_sessoes.sh` passou na base descartável e removeu fixtures sintéticas. 0957 aplicada apenas à primeira base diagnóstica, sem registrar versão; cenário de exclusão com commit, revogação concorrente, deadlock e ACL/owner ainda pendentes.
- ADR-0734/0958 preparam proteção contra vínculo de inspeção e proposta de Clientes diferentes e mudança posterior de Cliente nos dois lados. Teste sintético ampliado passou 9/9 após correção (4/6 falhavam antes), em transação revertida na segunda base diagnóstica. Concorrência, deadlock, escritores e compatibilidade legada não estão comprovados; não homologar.
- Uma segunda base descartável em rede interna aplicou em ordem todas as migrations até 0956, mas com as mesmas seis correções **apenas nas cópias temporárias** de 0472, 0539, 0542, 0793, 0805 e 0859. Nessa sequência condicionada, passaram 1.687 testes pgTAP em 111 arquivos. Não comprova bootstrap original nem substitui CI e reconciliação do histórico remoto.
- Testes isolados de handlers de comprovantes/fotos passaram 16 casos; interface de fotos passou 11. Auth/Storage reais e concorrência seguem pendentes. ADR-0732 ampliada com inventário preliminar dos escritores e ordem de locks; ainda não prova coordenação global dos geradores.
- Bases diagnósticas usam redes internas e dados sintéticos, sem deploy ou acionamento real de Auvo/Financeiro. Homologação permanece bloqueada.

## 2026-10-30 — Validação de origem e fotos (Codex)

- ADR-0731/0956 impedem ativação quando a oportunidade está excluída, sem proibir edições posteriores. Base diagnóstica apenas; testes focados de origem/contratos passaram 47 verificações. Corrida com alteração da proposta e revogação concorrente continuam pendentes.
- S178: rota de foto de Equipamento tem 4 testes de handler e a interface 10 testes com mocks; não substituem Auth/Storage reais ou concorrência. 0954 aplicada apenas à base diagnóstica, gate desligado; revisão apontou necessidade de garantir imutabilidade/versão do objeto e proteção de revogação concorrente.
- Suíte SQL ampliada passou 1.687 verificações em 111 arquivos no banco diagnóstico. Base contém correções temporárias de seis migrations e 0954/0955 aplicadas fora de ordem: não substitui sequência original limpa, CI ou homologação. Typecheck web passou; suíte web completa passou 1.846 testes e ignorou 20. Sem deploy ou operação real Auvo/Financeiro.
- S166: ADR-0732 propõe tratamento individual de ciclo vencido sem OS/Auvo e sem alterar âncora, conforme decisão já aprovada. Preparação 0766 e materialização 0764 adquirem locks de Plano/ocorrência em ordens opostas; gerador legado 0224 e escritores PMOC não compartilham protocolo comprovado. A 0787 não cobre todos. Inventariar/adaptar escritores e testar duas sessões antes de criar 0957; não reabrir decisão sobre feriado.

## 2026-10-30 — Rascunhos e fotos versionadas (Codex)

- ADR-0730/0955 preparam validação de origem ao inserir contrato autenticado: proposta aceita, mesmo Cliente, identidade e permissão atual. Aplicada apenas na base diagnóstica; com 0952/0953, 83 testes focados em seis arquivos passaram, incluindo os ataques de rascunho e vínculo antes vermelhos. Não comprova concorrência/revogação durante espera, segurança de papéis privilegiados ou compatibilidade externa.
- S178: ADR-0728/0954 e Edge/UI sob flags preparam fotos privadas de Equipamento com contratos novos e gate fechado. Listagem filtra retirada antes de paginar e comando revalida permissão após lock; esta rechecagem não serializa revogações posteriores. 48 testes focados de foto passaram. Ainda faltam Storage real, replay, revogação concorrente, revisão adversarial e rollout; não ativar.
- Suíte SQL ampliada no banco diagnóstico passou 1.679 verificações em 110 arquivos após aplicar 0952–0955 localmente. As migrations diagnósticas foram aplicadas fora de ordem para permitir trabalho paralelo; repetir sequência completa em banco limpo depois de reconciliar bootstrap. CI não foi executada.
- Migrations originais de bootstrap seguem com seis correções apenas em cópia de diagnóstico. Nenhum deploy ou tarefa real foi disparado. Homologação permanece bloqueada.

## 2026-10-30 — Mediação financeira e fotos de Equipamento (Codex)

- ADRs 0727 e 0729 e migrations 0952/0953 preparam mediação do ciclo Comercial–Financeiro, impedem chamadas autenticadas genéricas sobre planos vinculados e restringem autoria de novos contratos. Aplicadas somente na base diagnóstica; `search_path` dos novos SECURITY DEFINER foi esvaziado. Suíte focada passou 74 testes em 5 arquivos, inclusive os ataques antes reproduzidos. Escopo global por módulo e operações financeiras sem vínculo foram preservados nos testes.
- Revisão estática encontrou riscos ainda abertos: INSERT direto de contrato Comercial pode usar proposta não aceita ou Cliente divergente; escritor privilegiado pode criar plano duplicado sem constraint única; proposta é lida sem lock na ativação; revogação concorrente e grants/owners externos precisam prova; restrição de edição financeira em planos vinculados exige revisão de compatibilidade. Não homologar/implantar.
- ADR-0728 define extensão privada e versionada para fotos de Equipamentos, com gate separado desligado. Teste proposto ainda vermelho e migração 0954 em preparação; vínculo, listagem, rota de conteúdo, UI, ACL, replay e concorrência precisam ser entregues em conjunto. Nenhuma integração real executada.

## 2026-10-29 — Proteção incremental de contratos (Codex)

- ADRs 0724–0726 e migrations aditivas 0949–0951 preparam permissão atual em contratos Comerciais e Financeiros, consultas de proposta sem custos e ativação atômica com oportunidade ganha. Aplicadas somente na base diagnóstica, não em ambiente remoto. Escopo legado global por módulo preservado; custo não foi liberado.
- Os testes focados de contratos, Financeiro direto e regressão Comercial passaram 51 verificações em 3 arquivos, após adaptar fixture legada para usuários e permissões efetivas. A suíte SQL ampliada passou 1.634 testes em 106 arquivos depois de adaptar fixture de recebíveis às permissões persistidas.
- Limites: `E03-S07_plano_financeiro_vinculo_adversarial.test.sql` demonstrou em fixtures sintéticas que usuário Comercial com escrita consegue pela RPC financeira criar plano de Cliente B vinculado a contrato do Cliente A, criar plano sem vínculo e encerrar plano legado sem vínculo; 6/7 verificações de proteção falharam. Suíte completa anterior ao novo teste passou, mas a suíte atual contém esse teste vermelho. ADR-0727 propõe mediação atômica e proteção das colunas de status/vínculo, preservando Financeiro legítimo; ainda não implementada. Revisão estática também apontou corrida potencial entre leitura e exclusão lógica de proposta durante ativação. Faltam provas de concorrência, revisão adversarial formal, compatibilidade de consumidores externos, autenticação/Storage reais, CI e reconciliação das migrations de bootstrap. Não homologar nem implantar. Sem efeitos reais Auvo ou Financeiro.

## 2026-10-29 — Revogação Comercial e cobertura adicional (Codex)

- Teste adversarial `E03-S07_contratos_permissao_atual.test.sql` reproduziu cinco falhas de sete: criação de contrato por Comercial autorizado bloqueada pela proteção de custos; downgrade ou desativação com JWT antigo ainda permitem operações diretas e RPC financeira. Teste permanece vermelho propositalmente; não declarar CI verde. ADR-0724 documenta solução em elaboração e escopo global legado por módulo, sem criar nova regra por Cliente.
- S166/S178: após acréscimo de testes de prévias, versões e vínculo de fotos, suíte de stories passou 920 verificações em 30 arquivos na base diagnóstica; não comprova execução tardia real, feriado operacional, concorrência ou Storage. A materialização legada de ciclo vencido segue bloqueada por guarda e sem grant autenticado identificado; não habilitar por inferência.
- Rota de comprovantes: 10 testes de handler passaram com dependências simuladas; sem autenticação/Storage reais. Composição por Local: botões agora têm nomes acessíveis específicos, 10 testes focados passaram. Nenhum deploy ou integração real.

## 2026-10-29 — Listagem de fotos e testes de banco (Codex)

- S176/S178: teste pgTAP reproduziu erro 42702 na 0945 por `id` ambíguo. ADR-0723 e migration aditiva 0948 qualificam ambos os gates, sem mudar filtro, contrato ou ACL; aplicada somente no banco diagnóstico. Teste novo cobre gates, paginação, foto inadequada/reavaliada, Componentes, Cliente divergente e revogação. Revisão identificou falso positivo de revogação, corrigido com prova de acesso antes da revogação; revisão adversarial formal e Storage real seguem pendentes.
- S166: acrescentados dois casos de cálculo trimestral ancorado envolvendo fevereiro. Suíte de stories no banco diagnóstico passou 896 testes em 27 arquivos. Suíte SQL ampliada executou 1.559 testes em 101 arquivos e falhou apenas em `comercial_contratos_rls`, que abortou antes das 20 asserções planejadas. Uma rodada concorrente de `supabase test db` interferiu na extensão pgTAP; repetição serial passou para as stories. Não executar CLI pgTAP simultaneamente na mesma base.
- Histórico remoto de migrations ainda não comprovado: `supabase migration list --linked` não retornou e foi interrompido. As seis correções provisórias de bootstrap continuam apenas na cópia temporária; CI, sequência original limpa, contratos Comercial com permissão atual e homologação permanecem bloqueados. Sem deploy ou operações reais.

## 2026-10-29 — Primeira rodada de banco e typecheck (Codex)

- A sequência até 0947 foi aplicada apenas em cópia diagnóstica descartável, com correções provisórias em 0472, 0539, 0542, 0793, 0805 e 0859. A 0859 recria o gate de quantidade já existente desde 0496; a cópia usa outro nome somente para investigar. Originais permanecem sem correção e seu histórico externo deve ser reconciliado antes de qualquer aplicação.
- Nessa base diagnóstica, `supabase test db ... supabase/tests/E01-S*.test.sql` passou 870 testes em 26 arquivos, após correções de fixtures S166, S177, S178 e S181. Na suíte de 100 arquivos `*.test.sql`, somente `comercial_contratos_rls` falhou: restrição de leitura de custos parece impedir criação de contrato por usuário Comercial autorizado. Os 1.533 testes executados incluem esse arquivo abortado antes das 20 asserções planejadas. Preservar segurança e avaliar mediação/ADR. O teste de identificadores foi ajustado para diferenciar dados legados anteriores à guarda de novas colisões e passou 19 testes.
- Typecheck web passou após correções de tipos em telas e testes; parser CSV recebeu narrowing seguro e dois testes. Suíte web repetida após correções de fixtures: 1.841 passaram e 19 foram ignorados (292 arquivos, 6 ignorados). Não substitui testes de Auth/Storage reais nem CI. Graphify atualizado.
- Banco e túnel locais seguem ativos para continuação, rede interna sem saída, sem serviços externos. Banco é diagnóstico e não comprova CI, Storage real, concorrência ou homologação. Espaço livre em torno de 9 GiB. Nenhum deploy ou operação real Auvo/Financeiro.

## 2026-10-29 — Validação local isolada de migrations (Codex)

- Colima recriado após autorização de Lucas; volumes anteriores removidos. PostgreSQL descartável iniciou em rede Docker interna, sem Edge Runtime, usando túnel SSH local. Não houve deploy nem operações reais no Auvo/Financeiro.
- Sequência original interrompe em **0472**, `REVOKE` aponta quatro argumentos para função criada com cinco. Em cópia temporária, ajustes diagnósticos contornaram erros de sintaxe em **0539**, **0542** e SQL truncado/duplicado em **0793**, chegando à **0805**, cuja verificação de definição falhou e contém `v_retororno` incorreto no trecho esperado. Apenas cópia temporária recebeu tentativa de correção de 0805, ainda não executada. Arquivos originais não foram alterados; verificar histórico de aplicação externo antes de escolher reconciliação segura. Testes pgTAP ainda não rodaram.
- Testes novos de ComposicaoLocal e FotosStagingAtivo: 6 passaram com `VITE_SSO_COMPOSICAO_LOCAL_ENABLED=true` e Supabase fictício; sem a flag, 4 passaram e 2 foram ignorados. Sem comprovação de RLS, Storage ou concorrência reais. Graphify atualizado.
- Próximo passo: executar tentativa diagnóstica da 0805 e continuar sequência em cópia descartável; reconciliar as migrations originais e repetir banco limpo antes de db-tests e homologação. Após download de imagens, espaço livre caiu a aproximadamente 9,6 GiB; monitorar. Cópia de diagnóstico em `/tmp/sso-validacao-migrations.QvNDmH` não é fonte oficial.

## 2026-10-29 — Versionamento da consulta de foto (Codex)

- **S178:** ADR-0722/0947 preparam restauração do JSON original e RPC v2 para indicadores de elegibilidade; tela usa v2 e falha fechada se ausente. Migrations não aplicadas: janela entre 0946 e 0947 pode quebrar cliente anterior, exigindo rollout coordenado; histórico de aplicação externa não comprovado.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; gates e homologação bloqueados.

## 2026-10-29 — Revalidação e rollout de fotos (Codex)

- **S178:** indicadores de adequação e destino também ficam ocultos durante reconsulta. 0946 muda JSON estrito: clientes antigos e novos exigem rollout coordenado com flag desligada; testes de compatibilidade/revogação pendentes.
- **S176/S178:** fotos de Equipamento exigem extensão coordenada de vínculo, listagem, acesso, projeção e consumidores, além de cobertura de atualização e prova de ACL. Nenhuma 0947 criada; necessidade de negócio não está em dúvida.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; gates e homologação seguem bloqueados.

## 2026-10-29 — Elegibilidade de destino de foto (Codex)

- **S178:** ADR-0721/0946 e tela preparam consulta de adequação da foto e atividade do destino, bloqueando novos vínculos se inadequada, rejeitada ou inativa; retry pendente mantém identidade. Indicadores são fotografia e não provam bytes ou concorrência; servidor revalida comando.
- **S178:** revisão estática de 0945 não detectou falha comprovada de ACL ou paginação; desempenho e alteração entre páginas permanecem pendentes de teste.
- Nenhum teste/typecheck, migration aplicada, deploy ou operação real; gates e homologação seguem bloqueados.

## 2026-10-29 — Adequação e histórico de vínculo de foto (Codex)

- **S178:** ADR-0720/0945 preparam filtro de fotos inadequadas antes da paginação na listagem interna; gates e autorização preservados. Não aplicada nem testada.
- Tela de vínculo oculta destino durante erro/reconsulta e apresenta sucesso como confirmação histórica do comando, sem afirmar vigência atual. Consulta ainda pode oferecer vínculo inviável quando ativo ou foto mudam; núcleo deve recusá-lo. Revisão estática de 0944 não comprovou bypass, mas exige testes de isolamento, revogação e replay.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; homologação bloqueada.

## 2026-10-29 — Vínculo de fotos e revalidação (Codex)

- **S178:** ADR-0719/0944 preparam mediação autenticada de vínculo e consulta de destino de fotos de Sistema/Componente; tela conectada, núcleos e gates preservados. Migration não aplicada; validar RLS, permissões, locks e replay. Equipamento continua sem suporte.
- **S176/S178:** tela de fotos temporárias desmonta imagens durante reconsulta ou erro e ignora resposta após desmontagem; não testado. Revisão estática indica que 0943/0546 ainda podem listar foto marcada inadequada, embora download a recuse; corrigir listagem antes de ativar.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; homologação bloqueada.

## 2026-10-29 — Mediação de fotos temporárias (Codex)

- **S176/S178:** ADR-0718/0943 e Edge Function preparam listagem autenticada e resolução de caminho por service_role para fotos vinculadas a Sistemas/Componentes, com identidade verificada e rechecagem. Funções internas continuam revogadas ao navegador; gates fechados. Sem suporte a Equipamentos; vínculo e destino ainda precisam mediação. Revisar impersonação de claims, ACL, RLS, retirada e concorrência antes de ativar.
- Nenhum teste/typecheck, migration aplicada, deploy ou operação real; homologação bloqueada.

## 2026-10-29 — Fotos privadas de Equipamento (Codex)

- **S176/S178:** 0541/0546 aceitam Sistema/Componente e conferem tipo Componente; listagem, vínculo, destino e caminho estão revogados de authenticated, inclusive para Edge Function com JWT. Extensão exige mediação autorizada e adaptação coordenada, preservando guardas 0551/0570 e revogação; não basta ampliar enum. Nenhuma migration criada.
- Nenhum teste/typecheck, migration aplicada, deploy ou operação real; gates e homologação bloqueados.

## 2026-10-29 — Agrupamento da composição (Codex)

- **S176:** composição por Local separa Componentes, Equipamentos e Grupos Quantitativos dentro das seções de Sistema. Projeção parcial, flag desligada; fotos de Equipamentos, consultas, segurança e concorrência ainda precisam validação.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; homologação bloqueada.

## 2026-10-29 — Caminho da composição por Local (Codex)

- **S176:** composição apresenta caminho com dados da árvore carregada, sem consulta nova; não comprova ancestrais ausentes ou inconsistentes. Flag segue desligada; fotos de Equipamento, consultas, segurança e concorrência ainda exigem validação.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; homologação bloqueada.

## 2026-10-29 — Detalhes de ativos por Local (Codex)

- **S176:** composição por Local conecta histórico existente de Componentes/Equipamentos e fotos de levantamento mediadas para Componentes, abertas sob demanda e flags próprias. Fotos de Equipamentos não estão disponíveis nessa rota. Fontes, ACL, RLS, paginação e joins precisam testes; flag de composição desligada.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; homologação bloqueada.

## 2026-10-29 — Detalhes de Grupo por Local (Codex)

- **S176:** composição por Local oferece abertura explícita de histórico e fotos mediadas de Grupo, reutilizando componentes e flags existentes, sem upload. Conferência estática das FKs e campos não comprova PostgREST, RLS ou dados legados. Breadcrumb e detalhes de Componentes continuam pendentes; flag desligada.
- Nenhum teste/typecheck, migration aplicada, deploy ou operação real; homologação segue bloqueada.

## 2026-10-29 — Nomes na composição por Local (Codex)

- **S176:** visão parcial consulta nomes de Sistemas e categorias paginados, indicando quando ainda não foram carregados; sem consultas por item. Catálogo compartilhado, RLS, joins e paginação precisam validação. Breadcrumb, fotos e histórico ainda faltam; flag desligada.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; homologação continua bloqueada.

## 2026-10-29 — Composição por Local (Codex)

- **S176:** visão parcial de Componentes, Equipamentos e Grupos por Local e Sistema preparada sob flag desligada, usando consultas paginadas e aviso de páginas incompletas. Faltam breadcrumb, fotos/histórico e nomes de alguns vínculos; joins/PostgREST, RLS, permissões e paginação concorrente não foram validados. Não representa snapshot transacional.
- Sem testes/typecheck, aplicação de migration, deploy ou operações reais; gates e homologação seguem bloqueados.

## 2026-10-29 — Etapas canceladas e quadro gerencial (Codex)

- **S167:** painel reconhece OS cancelada no agregado quando há também OS ativa de outra etapa; contagem considera somente finalizadas. Situação de apenas finalizadas e canceladas não recebe status inferido; esclarecer tratamento se necessário. Paginação sem snapshot e testes pendentes.
- Card único continua pendente: Kanban existente pagina por OS e permite movimentação; integrar Chamados agrupados exige definir quadro, filtros e ação de movimentação sem alterar fluxo legado indevidamente. Nenhuma migration nova criada.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; gates e homologação seguem bloqueados.

## 2026-10-29 — Decisão de status do Chamado (Codex)

- **S167:** Fabrício informou, por Lucas, que Chamado com OS em etapas diferentes deve aparecer como Em andamento; Lucas aprovou indicador “1 de 3 OS finalizadas”. Decisão registrada na spec sem ampliar outras regras de encerramento.
- Painel de OS vinculadas prepara contagem após carregar todas as páginas e rótulo para etapas conhecidas diferentes; cancelada ou status desconhecido não recebe agregado inferido. Paginação não garante snapshot; card gerencial único e transição 1:N continuam pendentes.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais. Gates e homologação seguem bloqueados.

## 2026-10-29 — Navegação da Central de Materiais (Codex)

- **S179:** lista da Central permite filtrar pela OS exibida e abrir histórico de exceções quando habilitado, sem digitação de UUID. É apenas integração de navegação; reprogramação remota e origem canônica de custos continuam pendentes.
- **S170/S173/S174/S180–S186:** sem avanço central seguro identificado nesta rodada; permanecem dependências de provas de execução, fontes canônicas, protocolo financeiro, autorização e ambiente de homologação.
- Nenhum teste/typecheck executado, migration aplicada ou deploy realizado; gates e homologação seguem bloqueados.

## 2026-10-29 — Revisão de conferência e quadro de Chamados (Codex)

- **S178:** conferência selecionada verifica sessão antes de cada chamada, preservando tentativas divergentes; interface informa retenção temporária dos retratos. Sem testes de replay, concorrência ou segurança de armazenamento.
- **S167:** painel já consulta várias OS por Chamado sob flag. AC-2 exige card único, mas spec não define coluna nem cálculo de progresso quando OS divergem; consulta atual pagina itens por OS. Quadro agrupado depende de regra operacional definida, fonte canônica e testes; não inventada migration.
- **S179/S185:** ações remotas dependem de identidade/idempotência do fluxo proprietário e prova autenticada do estado remoto; nenhum POST ou retentativa real.
- Nenhum teste/typecheck executado, migration aplicada ou deploy realizado; gates e homologação continuam bloqueados.

## 2026-10-29 — Conferência selecionada de levantamentos (Codex)

- **S178:** preparada conferência de até 50 linhas carregadas, com retratos, confirmação, request IDs estáveis e retomada. Cada linha é transação independente; falha não reverte anteriores. Não aprova lote nem incorpora cadastros. Gate existente fechado; testar replays, revisão concorrente e retomada antes de liberar.
- **S167:** índice único 0171, numeração 0209 e leitores/escritores singulares impedem ativar 0324 isoladamente; transição requer compatibilidade coordenada com legado e Auvo.
- **S182:** protocolo deve cobrir emissão integral e parcial, alocação, estorno, conversão/liberação, parcela adicional e gatilho; mudanças parciais arriscam saldo ou replay. Nenhuma migration financeira criada.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; gates e homologação seguem bloqueados.

## 2026-10-29 — Revalidação de exportação e histórico (Codex)

- **S169:** exportação de versão reconsulta metadados antes do download e bloqueia metadados em erro ou atualização. Conferência de identidade, vigência e quantidade não comprova conteúdo integral; cronograma, XLSX e integração de staging seguem pendentes.
- **S179/S183:** histórico de visibilidade de materiais fica oculto em reconsulta ou falha; autorização no servidor e revogação ainda exigem testes.
- **S176:** revisão estática de 0942 e consumidores não identificou incompatibilidade de assinatura; não comprova permissões, replay, isolamento ou concorrência. Pressuposto: migration não aplicada.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; gates e homologação seguem bloqueados.

## 2026-10-29 — Mediação de operações de Grupo (Codex)

- **S176:** ADR-0717/0942 preparam mediadores para movimentação, reclassificação e quantidade, com gate próprio desligado e autorização pelo Cliente real; telas conectadas. Núcleos conservam gates e validações. Migration não aplicada; revisar owner/RLS, autorização, replay e concorrência antes de ativar.
- **S180:** criação de previsão preserva tentativa pendente e bloqueia envios simultâneos na mesma tela; concorrência entre abas não comprovada.
- **S165:** 0785 mantém prova de impacto e aprovação falsas; 0787 protege seis tabelas, mas não cobre diretamente ocorrências/vínculos de Grupo nem comprova universo PMOC/legado. Aprovação depende de inventário e coordenação dos escritores, reavaliação transacional e testes de concorrência; guarda 0715 permanece fechada.
- Sem testes/typecheck, aplicação de migrations, deploy ou operações reais. Homologação e gates permanecem bloqueados.

## 2026-10-29 — Proteção de tentativas e integração de Grupos (Codex)

- **S165:** salvamento de Plano preserva tentativa divergente e impede envios simultâneos na mesma tela; concorrência entre abas segue pendente.
- **S180:** rateio protege tentativa pendente contra sobrescrita e envios simultâneos, e invalida consultas também quando a tentativa local diverge após sucesso. Não comprova concorrência no servidor.
- **S176:** telas de movimentação, reclassificação e alteração de quantidade chamam RPCs revogadas para authenticated. Falta mediação server-side autorizada e revisão; não contornar pela interface.
- **S182:** inspeção estática indica assinatura compatível entre 0941, 0401 e interface; permissões, RLS e concorrência ainda não comprovadas.
- **S186:** consulta de roteiro CT-001–030 adicionada ao diagnóstico sob flag desligada; catálogo estático precisa ser mantido sincronizado com a matriz. Registro de evidências, aceite e gates por onda não implementados.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais. Gates e homologação continuam bloqueados.

## 2026-10-29 — Mediação de leituras financeiras (Codex)

- **S182:** ADR-0716/0941 preparam leitura mediada de saldo e lançamentos, com autorização e Cliente real; gate próprio desligado e nenhuma concessão de escrita. Tela conectada, mas saldo continua informativo e protocolo transacional de reservas pendente. Revisar ownership/RLS, tipos e concorrência antes de ativar.
- **S165:** ações de revisão preservam tentativa divergente em sucesso ou rejeição definitiva e bloqueiam envios simultâneos na mesma tela. Não testado.
- Sem testes/typecheck, aplicação de migrations, deploy ou operações reais. Gates permanecem fechados.

## 2026-10-29 — Proteção da aptidão de Chamado (Codex)

- **S167:** tela de aptidão oculta parcelas, OS e contagens durante falha ou revalidação de qualquer fonte; seleção e paginação ficam bloqueadas, com retry. Não substitui autorização no servidor; sem teste executado.
- **S182:** inspeção de 0939 não encontrou dupla contagem após conversão 0737, que libera reserva e aloca na mesma transação. Consulta ainda é fotografia; escritores não protegem outras reservas e gate permanece fechado.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais. Próxima etapa: completar protocolos e validar em ambiente adequado.

## 2026-10-29 — Atualização de saldo e projeções (Codex)

- **S182:** confirmação de alocação invalida também caches de saldo, lançamentos e prévia por usuário/Cliente/item. Não substitui revalidação transacional nem valida 0939; testes pendentes.
- **S178:** lista de linhas editadas usa rótulo neutro quando sua fonte não distingue incorporação e vínculo; consumidores da projeção 0940 aceitam `vinculada`. Sem testes.
- **S172:** fontes de capacidade/demanda seguem sem comprovação de completude e deduplicação; não calcular saldo efetivo a partir delas.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais; gates continuam fechados.

## 2026-10-29 — Clareza de vínculo e segurança de retry (Codex)

- **S178:** superfícies de evidência sem prova da operação apresentam fato como incorporação ou vínculo, sem afirmar criação de cadastro. Projeção 0940 continua dependente de validação.
- **S171:** intenção de OS enviada evita envios simultâneos na mesma tela e só limpa tentativa persistida idêntica; continua intenção interna, não reprogramação no Auvo. Sem testes.
- **S182:** protocolo financeiro comum ainda depende de adaptação coordenada dos escritores e prova de locks/replay. Não criada 0941; gates fechados.
- Nenhum teste/typecheck ou migration aplicado, sem deploy ou operações reais. Próxima etapa: validação integrada e conclusão dos protocolos estruturais em ambiente adequado.

## 2026-10-29 — Distinção de vínculo e incorporação (Codex)

- **S178:** ADR-0173 permite vínculo explícito a cadastro existente sem exigir nomes iguais nem alterar o cadastro. ADR-0715/0940 preparam projeção `vinculada` apenas com prova de comando correspondente; interface informa que vínculo não alterou o oficial. Outras projeções ainda exigem revisão; migration não aplicada/testada.
- **S182:** 0737 libera própria reserva transacionalmente antes de alocar, mas emissão e alocação ainda ignoram outras reservas. Necessária adaptação coordenada de escritores, locks e replay antes de ativar; nenhuma migration financeira criada nesta rodada.
- Sem testes/typecheck, aplicação de migrations, deploy ou operações reais. Gates fechados; próxima ação é reconciliar projeções e validar integrações e concorrência.

## 2026-10-29 — Saldo com reservas e proteção de consultas (Codex)

- **S182:** ADR-0714/0939 preparam projeção de saldo que considera alocações e reservas e sinaliza ausência/divergência; tela usa revisão esperada. RPC permanece revogada e gates fechados: ainda indisponível. Consulta não reserva saldo; comandos precisam revalidar sob locks comuns. Segurança e concorrência não comprovadas.
- **S165:** formulários e históricos de contratos de pergunta/evidência ocultam cache e bloqueiam ações durante atualização ou erro; servidor permanece responsável pela autorização. Sem teste executado.
- **S178:** ADR-0295 e ADR-0254 esclarecem que nulo no staging não é alteração automática e texto vazio não apaga observação oficial. 0480/0938 são consistentes nessa semântica; não reabrir decisão. Validar implementação antes de ativar.
- **S182:** conversão de reserva precisa excluir a própria reserva do saldo sem permitir dupla contagem; alocação, emissão, conversão, liberação e estorno precisam protocolo comum e ordem de locks revisada. Não criada 0940; gates seguem fechados.
- Nenhum teste/typecheck ou migration aplicado; sem deploy ou operações reais. Próxima ação: revisar semântica e testar fontes, locks e permissões em ambiente adequado.

## 2026-10-29 — Refinamento de atributos e saldo financeiro (Codex)

- **S178:** ADR-0713/0938 preparam aceitação de observações em Equipamento/Componente somente quando o cadastro oficial do mesmo Cliente já contém texto exato, com lock; criação que não transporta texto continua bloqueada. Normalização diferente pode recusar atualização válida. Sem aplicação/testes; revisar locks.
- **S182:** 0751 calcula saldo sem descontar reservas internas, enquanto 0733 as considera. Não conceder ou apresentar 0751 como saldo disponível até unificar fonte e validar concorrência/autorização.
- **S166:** inspeção estática dos grants 0932/0935/0936 não encontrou bypass comprovado; não substitui testes de revogação, RLS, concorrência e imutabilidade da Rotina.
- Nenhum teste/typecheck ou migration aplicado; sem deploy ou operações reais. Gates fechados.

## 2026-10-29 — Proteção de atributos e acesso ao calendário (Codex)

- **S178:** ADR-0712/0937 preparam bloqueio de incorporação de Sistema, Equipamento e Componente quando validação estiver desligada ou houver atributos não suportados pelo caminho individual 0721. Preserva staging; guarda conservadora pode bloquear atualização que já transportaria observações, exigindo refinamento por operação e testes. Gate fechado.
- **S166:** ADR-0711/0936 preparam EXECUTE em oito funções externas de calendário consumidas pela interface; gates continuam desligados. Autorização, concorrência e revisão adversarial ainda necessárias.
- **S181/S182:** chamadas de interface permanecem revogadas até revisão de autorização e efeitos financeiros; não conceder acesso apenas para eliminar erro.
- Nenhum teste/typecheck ou migration aplicado; sem deploy ou operações reais. Próxima etapa: validar e revisar integração e concorrência em ambiente adequado.

## 2026-10-29 — Integração de Visitas e atributos de Grupo (Codex)

- **S166:** ADR-0710/0935 preparam EXECUTE em consultas e comandos individuais de Visita que alimentam as telas, complementando 0932; gates fechados. Segurança, revogação e concorrência de 0796 ainda precisam de prova.
- **S178:** ADR-0709/0934 preparam validação obrigatória da incorporação de Grupo, bloqueando novos fatos quando gate de validação estiver desligado ou existirem atributos não suportados. Não descarta staging; conferir replay/atualizações.
- Nenhum teste/typecheck ou migration aplicado; sem deploy ou operações reais. Próxima etapa: revisão integrada e testes antes de liberar gates.

## 2026-10-29 — Integração de lotes e proteção de localização (Codex)

- **S166:** ADR-0707/0932 preparam concessão de EXECUTE apenas para RPCs 0900/0902, chamadas pela interface. Gates próprios permanecem desligados; autorização, locks e concorrência exigem validação.
- **S178:** ADR-0708/0933 preparam validação obrigatória para incorporação/atualização de Área, Local ou Sublocal, evitando omitir atributos quando gate 0829 estiver desligado. Staging e histórico são preservados; replay e rollout exigem verificação.
- **S180:** rateio oculta dados de OS e rateios antigos em erro/reconsulta; sem prova de autorização de servidor.
- Nenhum teste/typecheck ou migration executado; sem deploy ou operações reais. Gates fechados; validar mudanças e dependências em ambiente adequado antes de ativação.

## 2026-10-29 — Risco de rollout de reserva de códigos (Codex)

- **S177/S178:** trigger de 0892 verifica reserva e tenta lock em escritas de código legadas mesmo com gate de novas reservas desligado; pode rejeitar escrita com `40001` ou reserva ativa com `23505`. Não desligar a guarda indiscriminadamente: reservas existentes precisam continuar protegidas. Bloquear rollout até distinguir suspensão de novas reservas da proteção das existentes e validar concorrência/compatibilidade.
- Investigação de 0892/0893: saltar lock ao observar gate falso sem coordenação permite corrida com transação que já leu gate verdadeiro. Correção precisa coordenar transacionalmente gate, ambos os caminhos de reserva e escritores legados, inclusive reservas ativas, ordem de locks e isolamento. 0932 não criada; requer prova de concorrência.
- **S175:** inbox 0357 e triagem 0358/0418/0428 permanecem desconectados; identidade/ordem/autenticação da fonte Auvo e questionário estruturado não foram comprovados. Sem 0932 nesta rodada.
- Nenhum código de produção alterado, teste executado ou migration aplicada; gates fechados, sem deploy ou operações reais. Próxima ação: reconciliar impacto de 0892 e validar contratos/ambiente antes de ativar.

## 2026-10-29 — Revisão de contratos e evidências de gate (Codex)

- **S165:** início da revisão de contratos evita envios simultâneos e preserva pedido divergente antes de limpar sessão. Sem teste executado; servidor continua responsável por idempotência.
- **S178:** 12 testes pgTAP preparados para ordem do gate 0931 e erros uniformes; não executados, não cobrem todos os perfis/documentos/concorrência.
- **S181:** ADR-0350 restringe decisão do Cliente após retirada; ADR-0685 distingue decisão PCM interna. Ausência de checagem de visibilidade pública em 0910 não prova defeito segundo essas decisões; não alterar regra sem evidência.
- Nenhum teste/typecheck ou migration executado; sem deploy ou operações reais. Gates fechados; validar segurança, concorrência e fixtures em ambiente adequado.

## 2026-10-29 — Ordem de autorização em levantamentos (Codex)

- **S178:** inspeção de 0925/0927 detectou diferença de erros para ID existente/inexistente com gate fechado. ADR-0706 e migration aditiva 0931 preparam checagem prévia de gate e identidade nos helpers de quarentena/evidência; ausência ou falta de autorização permanecem com erro uniforme. Migration não aplicada/testada; revisar isolamento e concorrência.
- **S181:** 0910 verifica existência de publicação sem verificar sua retirada; não foi estabelecido que retirada impeça decisão interna PCM. Manter RPC revogada e avaliar regra e locks antes de mudança.
- Nenhum teste/typecheck ou migration executado; sem deploy ou operações reais. Próximo passo: validar segurança integrada e regras antes de abrir gates.

## 2026-10-29 — Proteção de consulta na alocação (Codex)

- **S182:** tela de alocação oculta saldo/opções em reconsulta ou falha e bloqueia envio nesse estado. Não substitui autorização no servidor; alteração não testada.
- **S165/S166/S177:** inspeção estática sem nova correção comprovada; concorrência, fontes, permissões e testes integrados continuam pendentes.
- Sem testes/typecheck, aplicação de migration, deploy ou operações reais; gates fechados. Próxima ação: validar alterações acumuladas em ambiente adequado e concluir fontes/protocolos pendentes.

## 2026-10-29 — Investigação de XLSX e transições (Codex)

- **S169/S178:** leitor legado carrega `xlsx@0.18.5` por CDN e não limita descompressão. `@zip.js/zip.js` é candidato para leitura por entrada/stream, mas não interpreta XLSX: ainda requer parser OOXML revisado, limites de bytes efetivamente descomprimidos, fórmulas/datas e testes adversariais. Nenhuma dependência instalada; CSV e matriz JSON continuam parciais.
- **S167:** criador legado contém campos operacionais e transição que pode acionar Auvo; comando 0324 não os preserva. Não substituir sem separar efeitos externos e validar vínculos/concorrência.
- **S180/S181:** custo de aquisição é valor declarado, sem fato canônico; classificação exclusiva e integração transacional de consumidores permanecem necessárias para evitar dupla apropriação de retirada.
- Nenhum código de produção alterado, teste executado ou migration aplicada nesta rodada; gates permanecem fechados. Próxima ação: definir implementação segura de XLSX e transições, e validar conjunto acumulado em ambiente adequado.

## 2026-10-29 — Cobertura preparada, sem execução (Codex)

- **S167:** pgTAP preparado para reconciliação por payload completo, autorização e ausência indeterminada; usa comando sintético, não comprova criação nem concorrência.
- **S180:** testes de interface preparados para upload incerto e retry de realização/correção; mocks não comprovam Storage, RLS ou concorrência.
- **S169:** testes de exportação CSV preparados para conteúdo, feriado hipotético, fórmula e revogação; leitores reais e PDF não cobertos.
- Nenhum teste/typecheck executado ou migration aplicada; fixtures ainda exigem revisão. Sem deploy ou operações reais. Próxima ação: executar e corrigir em ambiente adequado, mantendo gates fechados até revisão.

## 2026-10-29 — Integridade da reconciliação de OS (Codex)

- **S167:** inspeção estática identificou que 0929 comparava somente identificadores. Agora prepara comparação integral do payload normalizado com 0324; assinatura de 0930 e adapter ajustados. Alteração pressupõe que 0929/0930 não foram aplicadas em nenhum ambiente: confirmar histórico antes de aplicar e usar correção aditiva se necessário. Gate fechado; sem testes.
- **S172:** fontes atuais de disponibilidade e demanda continuam incompletas e não comprovam ausência de sobreposição; não apresentar saldo calculado como efetivo.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais. Próxima etapa: validar contrato integral, autorização e concorrência em ambiente adequado.

## 2026-10-29 — Prévia CSV e transição do criador legado (Codex)

- **S169:** exportação CSV da prévia de ciclos por calendário preparada sob `VITE_SSO_EXPORTAR_PREVIA_CICLOS_CSV_ENABLED`, desligada. Inclui período, tolerâncias e feriados hipotéticos; não é cronograma operacional completo ou XLSX. Não testada.
- **S167:** criador legado não guarda request/OS ID previamente e inclui campos, fotos e possíveis efeitos de status/Auvo ausentes no comando 0324. Reconciliação 0929 não prova identidade de chamada antiga; não redirecionar ou substituir sem contrato completo, separação de efeitos externos e transição concorrente. 0931 não criada.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais. Gates fechados; próxima ação: completar transição compatível e validar alterações acumuladas em ambiente adequado.

## 2026-10-29 — Integração de reconciliação de OS (Codex)

- **S167:** ADR-0705/0930 preparam concessão da consulta 0929 a authenticated; gate do servidor permanece fechado. Adapter e tela de criação oferecem consulta sob flag própria; pedido indeterminado ou erro preservam tentativa, e confirmação limpa apenas tentativa idêntica. Não libera criação 1:N nem prova concorrência/revogação.
- **S178/S183:** jornadas existentes inspecionadas; XLSX/Auvo/reversão e estado remoto/autorização seguem dependentes de contratos e validação no servidor.
- Nenhum teste/typecheck ou migration aplicado, sem deploy ou operações reais. Próximo passo: revisão de autorização e concorrência, reconciliação de consumidores legados e validação em ambiente adequado antes de ativar gates.

## 2026-10-29 — Reconciliação de criação de OS (Codex)

- **S167:** ADR-0704 e 0929 preparam consulta privada de resultado por request, Cliente, Chamado, OS e ator original, usando histórico do comando 0324 e autorização atual. Ausência é indeterminada e não permite nova criação; gate desligado, sem grants automáticos. Consumidores ainda não integrados; consulta não comprova transação ainda em andamento.
- **S169:** exportações existentes apresentam dados aprovados e prévia parcial, não cronograma operacional completo. Fontes de Visitas, feriados e capacidade ainda exigem comprovação.
- Não executados testes/typecheck nem aplicada migration. Nenhuma restrição legada removida; sem deploy ou operações reais. Próxima ação: integrar reconciliação aos consumidores e verificar concorrência/revogação em ambiente adequado antes de qualquer liberação.

## 2026-10-29 — Dependências de transição 1:N e custos (Codex)

- **S167:** índice único 0171 e trigger de numeração redefinido em 0209 impedem transição isolada; 0324 bloqueia criação enquanto existem. Escritores singulares incluem adapters de Chamado/OS, `_shared/auvo/os-from-task` e `portal_decidir_orcamento`; `obterPorChamado` usa `maybeSingle` no fluxo de recuperação. Não escolher OS arbitrariamente em 1:N. Criar protocolo de reconciliação com identidade de pedido e adaptar consumidores antes de retirar restrições; inventário e concorrência ainda precisam de prova.
- **S180/S181:** 0339/0393 recebem custos de aquisição e operacional como valores declarados, sem identidade de fato; 0323/0372 identificam despesas e rateios de Visita, não aquisição. Evitar dupla apropriação de retirada exige modelo canônico e adaptação transacional de escritores/leitores.
- Nenhum código de produção alterado, teste executado ou migration aplicada nesta rodada. Sem deploy ou operações reais; gates fechados. Próxima ação: implementar transições coordenadas quando contratos e fontes estiverem comprovados; validar trabalho acumulado em ambiente adequado.

## 2026-10-29 — Busca de alias e integridade de comprovante (Codex)

- **S177:** após localizar ativo por alias, a tela consulta código atual no cadastro do mesmo Cliente antes de oferecer substituição administrativa. Servidor revalida código e autoridade; RLS, concorrência e interface ainda precisam de testes.
- **S180:** mediação atual consulta metadados ou comprovantes já vinculados, mas não garante imutabilidade do objeto entre hash e associação. Recuperação de upload incerto permanece bloqueada até contrato verificável de versão/associação e revisão adversarial.
- **S173:** integração de Grupo/Visita depende de protocolo de locks dos escritores e fonte estruturada de evidências; não remover guarda 0903.
- Sem testes/typecheck, migrations aplicadas, deploy ou operações reais. Próxima etapa: integrar fontes e protocolos completos e validar alterações em ambiente adequado; homologação segue bloqueada.

## 2026-10-29 — Segurança da recuperação de comprovantes (Codex)

- **S180:** a recuperação automática de upload incerto foi bloqueada: Storage não permite verificar os bytes pelo contrato atual. Realização e correção preservam objeto e marcador para suporte; somente upload confirmado na mesma execução segue para novo comando. Repetição de pedido já persistido permanece disponível. Faltam mediação de integridade no servidor, tratamento de órfãos, concorrência entre abas e testes; flags fechadas.
- **S171:** reprogramação após envio continua como intenção de conciliação, não como alteração remota comprovada. Filtro de agenda usa fuso do navegador; conferir regra de fuso antes de alterar.
- Nenhum teste/typecheck ou migration executado, sem deploy ou operações reais. Próxima ação: implementar e verificar mediação autorizada com integridade dos bytes e reconciliar as demais integrações em ambiente adequado.

## 2026-10-29 — Recuperação de upload de despesa (Codex)

- **S180 (histórico, substituído acima):** intenção antes do upload foi preparada com caminho e request estáveis, valor, revisão e SHA-256; recuperação automática foi posteriormente bloqueada porque o hash armazenado não pode ser comprovado pelo contrato existente. Código não testado; gate fechado.
- **S174:** devolução efetiva depende de prova da interrupção e de vínculo ativo/locks compatíveis; não liberar pela declaração administrativa isolada.
- **S170:** cadastro legado ainda usa permissão antiga na interface; proteção por capacidade em 0387 permanece fechada e não aplicada. Validar servidor e rollout antes de ativar.
- Sem testes/typecheck, aplicação de migrations, deploy ou operações reais. Próxima etapa: completar protocolos estruturais e validar alterações acumuladas em ambiente adequado.

## 2026-10-29 — Recuperação de realização com comprovante (Codex)

- **S180:** tentativa persistida de realização permanece acessível mesmo se o estado atual já mostra a despesa realizada ou cancelada; o comando 0362 verifica acesso e replay antes de estado/revisão. Falha de upload antes do pedido persistido pode deixar objeto incerto ou órfão; reconciliação ainda necessária. Alteração sem testes, gate fechado.
- **S165:** aprovação de revisão segue bloqueada até integração e comprovação dos impactos legados e concorrência; modelo canônico de Rotina não foi identificado.
- **S169:** matriz JSON existente exige tipos explícitos; converter CSV sem contrato de mapeamento poderia alterar datas/tempos. XLSX seguro continua pendente.
- Nenhum teste/typecheck ou migration executado; sem deploy ou operações reais. Próxima etapa: completar fontes/protocolos e validar alterações acumuladas em ambiente adequado; preservar volumes com erro de I/O.

## 2026-10-29 — Continuação da conferência de CSV (Codex)

- **S178:** análise CSV preserva número ordinal do registro original quando há registros vazios, para conferência e quarentena; não representa linha física em campos multilinha. Não testado; XLSX e recepção Auvo tipada continuam pendentes.
- **S168/S173:** retorno legado tem caminho transacional preparado; Grupo continua bloqueado pela falta de protocolo comum de concorrência para vínculo, OS e retorno. Não remover guarda 0903 sem integrar consumidores e validar concorrência.
- **S182:** serviço extra e retirada dependem de origem verificável e regra de conferência no servidor; decisão PCM não comprova aceite do Cliente. Não habilitar cobrança a partir dessas presunções.
- Sem testes/typecheck, aplicação de migrations, deploy ou operações reais nesta rodada; homologação continua bloqueada. Próxima ação: resolver integrações estruturais e validar alterações acumuladas em ambiente adequado.

## 2026-10-29 — Continuação do acesso a orçamento e criação de OS (Codex)

- **S179/S181:** detalhe de OS aberto pelo board a partir da Central/Visão 360 recebe painel de orçamento para o par OS/Cliente do link, sob flag existente. Navegação e autorização precisam de validação integrada.
- **S167:** criação de OS protege contra envios simultâneos na mesma tela e preserva tentativa divergente antes de limpar sessão. Não comprova concorrência entre abas nem compatibilidade dos escritores legados.
- **S176:** integração de Grupos existente foi inspecionada; permissões, gates e dados ainda precisam de validação. Nenhuma migration foi criada ou aplicada nesta rodada. Testes e typecheck não executados, sem deploy nem operações reais; homologação permanece bloqueada.

## 2026-10-29 — Continuação de triagem e quarentena (Codex)

- **S185:** triagem de OS Auvo permite abrir o contexto da OS listada na Visão 360. Retry seguro, prova remota e varredura continuam pendentes.
- **S178:** recepção da quarentena invalida listagem de lotes por usuário e Cliente; atualização depende de validação posterior. Auvo tipado, XLSX seguro e reversão permanecem incompletos.
- **S166:** ocorrências de Grupo e gerador PMOC legado ainda não compartilham protocolo de concorrência comprovado; integração e fechamento continuam bloqueados para evitar duplicidade. Não foi criada 0929.
- Nenhum teste/typecheck executado ou migration aplicada; gates e homologação permanecem fechados. Sem deploy ou operação real. Próxima ação: completar integração quando fontes e concorrência forem comprovadas, além de revisar e validar mudanças acumuladas em ambiente adequado.

## 2026-10-29 — Continuação de decisões e proteção de tentativas (Codex)

- **S177:** tela de substituição administrativa protege contra clique duplo e preserva tentativa divergente; permissão é novamente consultada antes do envio. Sem testes; marcos legados, namespace de Grupo e integração Auvo ainda exigem comprovação.
- **S172:** 0334/0356/0443/0447/0451/0454/0878/0879 não comprovam demanda completa nem disponibilidade efetiva: declarações por Cliente podem sobrepor reservas ou conflitos entre Clientes, e 0879 mantém saldo nulo. Faltam fonte efetiva por pessoa/período, deduplicação, esforço restante, terceiros e integração transacional concorrente; não produzir saldo fictício. Nenhuma migration nova nesta investigação.
- **S180:** rateio passa a percorrer a lista paginada de OS, sem bloquear permanentemente ao chegar a 100; registro fica indisponível enquanto a listagem não estiver completa ou atualizada. Validação e concorrência no servidor continuam sem prova.
- **S168:** classificação manual protege contra envios simultâneos na mesma tela e preserva tentativa local divergente; retorno Grupo/Visita e integração operacional continuam incompletos.
- **Lacunas estruturais:** recepção tipada Auvo depende de contrato/origem verificável, reversão de incorporações exige definir dependências e efeitos, e XLSX nativo depende de solução segura para SEC-008. Não simular implementação concluída. Apenas 1,7 GiB livre observado; graphify update e validações locais não foram executados para preservar espaço.
- **S178:** ADR-0703/0928 preparam mediação de adequação e pertinência de evidências, com interfaces conectadas e gate fechado; isolamento e conteúdo privado exigem validação integrada.
- **S165:** comparação de questionário também oculta resultados armazenados enquanto a consulta atualiza ou falha; teste preparado, não executado.
- **S182:** alocação de documento evita envio simultâneo na mesma tela e preserva tentativa local divergente; isso não resolve concorrência entre abas nem comprova idempotência no servidor.
- **S178:** ADR-0702 e migration local 0927 preparam mediação das decisões de fotos e documentos, com vínculo ao Cliente do anexo; gate permanece fechado. Adequação e pertinência foram mediadas em 0928, ainda sem revisão ou testes integrados.
- **S169:** mensagem da entrada em matriz esclarece que a recepção guarda somente staging e que incorporação é operação separada; importação XLSX continua indisponível.
- **S165:** diagnóstico de OS na revisão deixa de exibir dados em cache enquanto consulta atualiza ou falha; teste de revogação preparado, não executado.
- **S181/S182:** reforçada a preservação das tentativas locais e evitado clique duplo simultâneo na criação de orçamento na mesma tela. Concorrência entre abas e idempotência transacional continuam sem prova.
- **Gates:** nenhum teste ou typecheck executado, nenhuma migration aplicada. Sem deploy ou operações reais. Próximo passo: avançar nas lacunas funcionais independentes e posteriormente validar as migrations acumuladas, testes, segurança e revisão adversarial em ambiente adequado; preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de anexos e segurança de consulta (Codex)

- **S178:** 0926/ADR-0701 prepara mediação de listagens de fotos/documentos e resumo, sem caminhos ou URLs; acesso a conteúdo depende das rotas privadas. Gates fechados, outras decisões seguem revogadas.
- **S165:** avaliação de impactos oculta contagens durante atualização ou falha de qualquer fonte habilitada, evitando exibir cache após possível perda de acesso. Testes preparados, não executados.
- **S183:** testes de Portal escritos com mocks para disponibilidade, decisão, retry e troca de Conta. Itens estruturados ativos e autorização real ainda precisam de cobertura.
- Sem testes/typecheck ou migrations aplicadas; sem deploy ou operação real. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação da quarentena CSV (Codex)

- **S178:** 0925/ADR-0700 prepara mediação de sete funções de quarentena por Cliente e capacidade cadastro.gerir, incluindo recepção, edição, validação e reconciliação; interfaces conectadas, gate 0912 fechado. Revisar dados sensíveis, isolamento, retry e concorrência.
- **S166:** testes de interface dos lotes preparados com mocks, abrangendo feriado/vigência, exclusão de Grupo no legado, retry e troca de Cliente; não executados.
- **S182:** testes de rastreio de material escritos com mocks, distinguindo declaração de entrega comprovada; não executados.
- Nenhuma migration aplicada, teste ou typecheck executado. Sem deploy ou operações reais Auvo/Financeiro. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de quarentena e testes (Codex)

- **S178:** 0924/ADR-0699 prepara mediação da edição estruturada, correção após parcial e recuperação de lote, sob gate fechado. Quarentena CSV ainda exige mediação específica com vínculo ao Cliente.
- **S166:** fixture futura e testes para materialização 0902, retry e ausência de OS/outbox preparados, não executados; revisar inserções diretas e triggers antes da execução.
- **S182:** testes de fila escritos com doubles para revisão, falha, retry e isolamento de Conta; autorização real não comprovada.
- Nenhum teste/typecheck executado ou migration aplicada; sem deploy nem operações reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de listagens e cobertura (Codex)

- **S178:** 0923/ADR-0698 prepara mediação de listagens de classificação, códigos e linhas editadas, com consumidores conectados e gate fechado. Contratos com grant existente foram preservados; segurança e paginação sem prova.
- **S166:** teste escrito para sucesso/retry do lote 0900 e ausência de OS/outbox, com fixtures sintéticas; não executado. Sucesso do lote 0902 ainda exige fixture futura com fuso e vínculo legado.
- **S182:** testes escritos ampliados para replay, conflito e revisão obsoleta; não demonstram concorrência simultânea.
- Nenhum teste/typecheck ou migration executado. Sem deploy ou operações reais; preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de Grupo e cobertura (Codex)

- **S178:** 0922/ADR-0697 prepara mediação das duas variantes de atualização de Grupo, com UI e gate fechado; revisão de concorrência/replay motivado ainda necessária.
- **S166:** testes parciais escritos para gates dos lotes e recusas sem OS/outbox; sucesso e retry ainda precisam de fixtures de Plano/Rotina/vínculos completos.
- **S182:** testes de interface escritos para saldo, revisão, retry e isolamento de Conta; mocks não provam RLS/concorrência no servidor.
- Nenhum teste/typecheck executado ou migration aplicada nesta rodada; sem deploy ou operações Auvo/Financeiro reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de localização e cobertura (Codex)

- **S178:** 0921/ADR-0696 prepara mediação de incorporação individual e retratos de Localização/Grupo; listagens com grant existente foram preservadas. Atualização de Grupo ainda depende de comandos revogados; revisão de segurança e concorrência pendente.
- **S166/S173/S174:** testes preparados para guarda de retorno Grupo e preservação de ocorrência legada, usando fixtures diretas que não provam integração operacional.
- **S182:** testes escritos para origem única, isolamento, alocação, retry e limite de saldo; concorrência e execução externa não cobertos. Nenhum teste foi executado; fixtures/triggers exigem revisão em banco descartável.
- Sem aplicação de migrations, deploy ou operações reais Auvo/Financeiro. Gates fechados; preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de decisões e cobertura (Codex)

- **S178:** 0920/ADR-0695 prepara mediação de sete contratos de decisão, reabertura e códigos de staging, com UI, permissões de gestão/aprovação distintas e gate fechado. Outras RPCs permanecem revogadas; revisar isolamento e replays.
- **S165:** teste pgTAP de reconferência em revisão foi escrito com snapshots, Cliente e revogação; não executado.
- **S180/S184:** testes com doubles para comprovante histórico e revogação foram escritos; não provam RLS/Storage reais. Nenhum teste/typecheck ou migration executado nesta rodada.
- Sem deploy ou operações reais Auvo/Financeiro. Preservar volumes com erro de I/O; homologação segue bloqueada.

## 2026-10-29 — Continuação de incorporação e retry (Codex)

- **S178:** 0919/ADR-0694 prepara mediação de vínculo, incorporação e atualizações selecionadas. 0397, considerada não aplicada nesta sessão, foi alterada para replay antes da leitura do staging, após autorização atual e checagem de ator/payload. Confirmar estado remoto e histórico real antes de aplicar; caso já aplicada, não reaplicar nem sobrescrever, planejar migration aditiva. Locks e concorrência exigem revisão.
- **S174/S180:** testes de interface preparados para divisão/promoção e rateio, incluindo retry e mudança de Cliente; mocks não comprovam autorização no servidor. Não executados.
- Gates fechados; sem testes/typecheck ou aplicação de migrations. Sem deploy ou operações Auvo/Financeiro reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de histórico e testes (Codex)

- **S178:** 0918/ADR-0693 prepara mediadores somente leitura para cinco históricos de campos, edições e rejeição, com UI conectada e gate fechado. Outras RPCs continuam revogadas; assinaturas, grants, isolamento e paginação exigem revisão.
- **S174:** testes de promoção com snapshot e vínculo histórico sintéticos preparados, incluindo retry e ausência de nova OS; não executados. Fixtures e triggers precisam ser validados em banco descartável.
- **S180:** testes preparados de rateio, isolamento por Cliente, soma, revisão e retry; sem execução. Relatórios, concorrência real e segurança de fixtures ainda não comprovados.
- Sem testes/typecheck ou migrations aplicadas; sem deploy ou ações Auvo/Financeiro reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de edição estruturada e testes (Codex)

- **S178:** 0917/ADR-0692 prepara mediadores de edição/conferência estruturada para Sistema, Componente e Localização, com UI e gate fechado. Históricos e demais funções revogadas continuam pendentes; revisar segurança, concorrência e gatilhos.
- **S174:** teste pgTAP preparado com cadeia sintética e cenários de divisão, retry, GUTD, histórico e contagem de OS; sem execução. Promoção bem-sucedida ainda requer fixture de snapshot/vínculo comprovado. Revisar fixtures e triggers antes de rodar em banco descartável.
- **S181:** testes preparados ampliados para revogação, papel divergente e Cliente no comando PCM. Nenhum teste foi executado e fixtures exigem revisão.
- Nenhuma migration aplicada, sem deploy ou operações reais Auvo/Financeiro; gates fechados. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de campos e cobertura preparada (Codex)

- **S178:** 0916/ADR-0691 prepara seis consultas mediadas de campos e retratos para incorporação, com consumidores conectados e gate fechado. Edição estruturada e outras decisões ainda requerem mediação; segurança, ownership e concorrência não validados.
- **S179/S181:** testes de interface preparados para paginação da seleção de materiais, revisão e troca de Conta; usam mocks e não provam isolamento do servidor.
- **S174:** testes pgTAP parciais ampliados com fixtures de Clientes/concessões e negação entre Clientes/revisão obsoleta. Cenários de sucesso ainda dependem de cadeia completa; testes não executados.
- Sem testes/typecheck ou aplicação nesta rodada; sem deploy ou operações Auvo/Financeiro reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de incorporação e testes preparados (Codex)

- **S178:** 0915/ADR-0690 prepara seis mediadores autenticados de aplicação de campos e incorporação por seleção, com telas conectadas e gates fechados. Outras consultas/comandos permanecem revogados; revisar ownership, isolamento, locks e supressão Auvo antes de ativação.
- **S181:** testes de interface preparados para decisão PCM, confirmação, retry e isolamento de sessão com RPC simulada; não provam autorização ou efeitos do servidor.
- **S174:** testes pgTAP parciais preparados para gates e privilégios. Sucesso, idempotência, histórico, GUTD, Cliente e ausência de OS ainda exigem fixtures completas e execução segura.
- Nenhum teste/typecheck executado ou migration aplicada. Sem deploy nem Auvo/Financeiro real; preservar volumes com erro de I/O.

## 2026-10-29 — Preparação de testes, sem execução (Codex)

- Preparados testes para mediação de conferência S178, interface de reconferência S165 e separação de decisões PCM/Cliente S181. São código de teste não executado e podem precisar de correção; não equivalem a PASS ou cobertura comprovada.
- Suite S178 ainda não cobre concorrência real ou todos caminhos felizes. S181 precisa revisão das fixtures/triggers em ambiente descartável antes de executar, mais concorrência e revogação. S165 requer execução e typecheck.
- Por solicitação de Lucas, testes e migrations não foram executados nesta rodada. Gates permanecem fechados; sem deploy, tarefas Auvo ou operações financeiras reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação da conferência (Codex)

- **S178:** 0914/ADR-0689 prepara mediação autenticada por Cliente de edição e rejeição de linhas e conecta UI, com gate 0912 fechado. Recepção manual 0320 já concede EXECUTE a authenticated e foi preservada; conferir outras RPCs revogadas da jornada, ownership, concorrência e isolamento antes de habilitar.
- **S165/S166/S179–S181:** funcionalidades restantes identificadas dependem de contratos de modelo, integração de Grupo e concorrência, suspensão efetiva ou vínculo canônico de custo. Não presumir aceite do Cliente a partir de decisão PCM.
- Sem testes/typecheck ou aplicação de migrations. Sem deploy, Auvo ou Financeiro real. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de mediação (Codex)

- **S178:** 0913/ADR-0688 prepara mediadores autenticados para conclusão, reabertura e aprovação parcial, sob gate 0912 fechado. Recepção, edição, rejeição, campos e incorporação têm outras RPCs revogadas ainda sem mediação revisada. Segurança, ownership, concorrência e rollout exigem testes.
- **S165:** alteração que mantinha conteúdo visível durante falha foi revertida: como não distingue erro de revogação, lista/detalhe devem ficar ocultos durante falha/carregamento ou autorização incerta. Sem teste.
- **S181/S182:** contratos não comprovam que decisão interna PCM seja aceite autenticado do Cliente; não flexibilizar exigência de origem autenticada e valor oficial para faturamento.
- Gates fechados, sem testes/typecheck ou migrations aplicadas. Sem deploy e operações reais Auvo/Financeiro; preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de revisão e conferência (Codex)

- **S165:** UI de reconferência de perguntas/evidências conectada à versão rascunho em revisão sob flag separada; autorização e gate 0911 permanecem no servidor. Sem testes.
- **S178:** 0912/ADR-0687 e clientes preparam wrappers autenticados para conferência de linha e resumo, mantendo núcleo revogado, autorização por Cliente e gate fechado. Revisar ownership/EXECUTE, schema exposto, isolamento e concorrência; outras RPCs revogadas ainda podem bloquear fluxo.
- **S181:** painel Comercial exibe decisão interna PCM separada de aceite do Cliente por consulta 0910; integração financeira segue incompleta e gate fechado.
- Migrations não aplicadas; testes/typecheck adiados; sem deploy nem operações Auvo/Financeiro reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de decisões e revisão de Plano (Codex)

- **S181:** 0910/ADR-0685 prepara decisão PCM separada por proposta/versão/origem, sem ocupar decisão única legada ou alterar status público. UI consulta decisão interna; consumidores financeiros ainda não a usam, portanto AC-6 permanece parcial. Base insegura 0908 segue revogada e bloqueada por 0909. Gates fechados; revisar autorização, concorrência e RLS.
- **S165:** 0911/ADR-0686 prepara reconferência de obrigatoriedade e evidências em versão rascunho quando Plano está em revisão, sem alterar snapshots aprovados. Aprovação continua bloqueada; substituição textual requer revisão antes de aplicação.
- **S178:** conferência individual chama RPC sem EXECUTE para authenticated/service_role desde 0469; não conceder sem mediação, validação de autorização e rollout coordenado.
- Sem testes/typecheck ou aplicação de migrations. Sem deploy, tarefas Auvo ou operações financeiras reais; preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de decisão e conferência (Codex)

- **S181:** inspeção encontrou UNIQUE(proposta_id) em proposta_decisoes e consumidores de status aceito que não distinguem PCM de Cliente. 0909/ADR-0684 bloqueia comando 0908 mesmo com gate habilitado; não altera aceite legítimo do Portal. Solução requer decisões por origem e adaptação coordenada dos consumidores financeiros/Portal. Não remover bloqueio sem revisão e testes.
- **S178:** lista de linhas editadas permite abrir linha na revisão, carregando páginas existentes quando necessário; não altera guardas nem incorpora cadastro.
- **S166:** prévia permite preencher janela padrão de 30 dias a partir da data fornecida, sem inferir fuso nem gerar ocorrências.
- Sem testes/typecheck ou aplicação nesta rodada; gates fechados, sem deploy ou operação real. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de quarentena e decisão PCM (Codex)

- **S178:** editor de quarentena conectado ao comando existente para corrigir células individualmente e adicionar/remover colunas; mantém edição JSON avançada. Não cria cadastro nem substitui validação.
- **S181:** 0908/ADR-0683 e UI preparam decisão PCM versionada e idempotente com referência declarada, preservando OS. Evidência não é aceite autenticado do Cliente. **Não habilitar:** status aceito pode ser interpretado por consumidores legados como aceite direto do Cliente; auditar faturamento, triggers, permissões e locks antes de aplicar/ativar.
- **S166/S168:** retorno de Grupo continua bloqueado; associação OS–Grupo e escritores de retorno/snapshot precisam protocolo comum e prova de concorrência. Não presumir que lock parcial é suficiente.
- Sem testes/typecheck ou aplicação de migrations por pedido de Lucas; gates fechados, sem deploy ou operações reais. Preservar volumes locais com erro de I/O.

## 2026-10-29 — Continuação de Pendências e recepção (Codex)

- **S166/S168/S173:** 0906/ADR-0681 prepara origem exclusiva Grupo ou ocorrência legada para Pendência; 0907/ADR-0682 adapta consulta de rastreabilidade e resolvedor de descrição histórica. Coluna legada passa a aceitar nulo, portanto consumidores remanescentes e compatibilidade exigem inventário e prova; guarda 0903 mantém inserção Grupo bloqueada. Não aplicar isoladamente.
- **S178:** recepção CSV encaminha o lote confirmado à conferência quando carregado na listagem autorizada; caso contrário orienta carregar mais. Não incorpora cadastro.
- **S179/S181:** seleção da lista mostra texto e revisão para conferência antes de criar orçamento; custo de retirada ainda sem vínculo canônico que evite dupla apropriação.
- Incrementos não testados nem aplicados; gates fechados, sem deploy, tarefas Auvo ou operações financeiras reais. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de origens e importação (Codex)

- **S166/S168:** 0904–0905/ADR-0679–0680 preparam cobertura e prévia de perguntas para OS associada a Grupo, usando versão/Rotina/alvo congelados. Retorno, decisão, Pendência e finalização ainda bloqueados; consumidores e concorrência exigem integração e revisão. Não comprova execução nem criação de OS.
- **S178:** interface CSV oferece prévia dos campos antes da recepção, sem alegar validação de códigos ou vínculos. XLSX seguro e recepção autenticada Auvo seguem pendentes.
- **S179/S181:** seleção para orçamento agora pagina oportunidades e listas de materiais existentes; autorização e revisão continuam no servidor.
- Gates e flags fechados; incrementos sem testes/typecheck ou migrations aplicadas. Sem deploy ou operações reais. Preservar volumes locais com erro de I/O.

## 2026-10-29 — Continuação de origens e estrutura (Codex)

- **S166:** 0903/ADR-0678 prepara classificação da origem declarada OS–Grupo e mantém bloqueados retorno, decisão, Pendência e finalização até adaptação dos consumidores. Não cria OS e declaração não comprova execução. Revisar substituição textual, locks e cadeia completa antes de aplicar.
- **S176:** visão de Sistemas distribuídos conectada à aba Sistemas do Cliente 360 sob flag existente; paginação não é snapshot transacional e exige testes.
- **S178:** importador Auvo reconhece respostas, mas falta mapeamento versionado de questionário para levantamento e proveniência autenticada de fotos; não tratar entrada declarada como evento autenticado.
- **S180:** retirada exclusiva ainda não tem fato de custo identificado e comum a aquisição, despesa e relatórios. Vínculo isolado não impediria dupla apropriação; requer mudança coordenada dos consumidores.
- Sem testes/typecheck ou aplicação de migrations, conforme orientação de Lucas; gates fechados, sem deploy ou operação real Auvo/Financeiro. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de Visitas e estrutura (Codex)

- **S166:** 0902/ADR-0677 e tela preparam materialização atômica de até 25 Visitas preparadas em Plano Preventivo legado real, sem criar OS ou tarefa Auvo. Grupo não é suportado; fila, retornos, prova de feriados e ordem de locks continuam pendentes. Gate, grants e flag fechados.
- **S176:** visão distribuída passou a paginar também Sistemas e Locais; falha em fonte oculta projeção e permite retry. Paginação por offset não garante snapshot concorrente; revisar autorização e cobertura.
- Sem testes/typecheck ou aplicação das migrations nesta rodada. Nenhum deploy, Auvo ou operação financeira real. Stories não homologadas; preservar volumes com erros de I/O.

## 2026-10-29 — Continuação Visitas e consultas (Codex)

- **S166:** 0900/ADR-0675 e tela preparam geração transacional de lote de até 25 Visitas reais para Rotina, com fonte declarada, revisão e retry. Não criam OS/Auvo e não comprovam calendário de feriados. Gates/grants fechados; revisar concorrência e integração antes de habilitar.
- **S181:** 0901/ADR-0676 e interface preparam histórico pré-OS por Cliente com requisição do mesmo Cliente, sem preços, custos ou textos livres. Vínculos inconsistentes são excluídos e exigem tratamento futuro.
- **S176:** projeção de Sistemas distribuídos pagina Equipamentos/Componentes, vínculos e Grupos e sinaliza cobertura parcial. Fontes de Sistemas/Locais ainda podem ter limite legado; paginação por offset não prova snapshot concorrente.
- Incrementos sem testes/typecheck ou aplicação de migrations, por pedido de Lucas; flags/gates fechados, sem deploy, operação real Auvo ou Financeiro. Preservar volumes com erros de I/O.

## 2026-10-29 — Continuação de composição (Codex)

- **S174:** 0897/ADR-0672 prepara consulta direta da composição dividida; tela permite avaliá-la e depois iniciar promoção separadamente. 0895 foi ajustada para exigir nova avaliação GUTD nas duas composições, preservando valores anteriores na auditoria. 0895–0897 permanecem sem execução, testes, revisão de locks e validação de segurança; gates e grants fechados.
- **S174, devolução:** 0898/ADR-0673 registra apenas histórico declarativo do vínculo, sem devolver escopo. Reentrada exige modelo de vínculo ativo compatível, adaptação dos consumidores e prova confiável do trabalho remanescente e da interrupção; declaração administrativa não comprova parada no Auvo.
- **S181:** tela de composição apresenta sugestão calculada em centavos por aritmética inteira, com escolha editável e autorização de piso mantida no servidor. Conferência estática da fórmula contra 0393; ainda sem typecheck ou testes.
- **S181, histórico:** 0899/ADR-0674 prepara consulta interna paginada e tela para orçamento legado da mesma OS/Cliente, sem custos, preços ou texto livre. Orçamentos pré-OS/sem vínculo não são cobertos; gate e RPC fechados, sem teste/aplicação.
- **S178/S177:** textos de interface atualizados para distinguir reserva, aprovação e incorporação. Spec geral exige namespace único de códigos/aliases; não foi encontrada decisão que determine código público próprio para Grupo Quantitativo. Não presumir esse cadastro.
- **S176:** visão de Sistemas distribuídos por Local preparada usando vínculos existentes de Componentes/Equipamentos e Grupos Quantitativos, sob flag desligada; paginação dos Grupos sinalizada. Paginação das demais fontes, completude e autorização exigem revisão e testes.
- Nenhuma migration aplicada nem operação real no Auvo/Financeiro; testes adiados, homologação e deploy bloqueados. Preservar volumes com erro de I/O.

## 2026-10-29 — Continuação de Backlog e levantamentos (Codex)

- **S174:** 0890/ADR-0665 prepara promoção transacional integral de composição em Chamado com parcelas e vínculos, sem criar OS; tela conectada sob flag desligada. 0891/ADR-0666 prepara leitura histórica da descrição por Visita, mas criação/validação desses retornos ainda está bloqueada; texto ausente ou ambíguo impede promoção. 0895/ADR-0670 e tela preparam divisão auditada para selecionar parte da composição, sem promover automaticamente; nova composição exige avaliação GUTD. Devolução efetiva segue não implementada; auditar locks e escritores legados, permissões, numeração e gatilhos antes de habilitar. Falha após reservar número pode gerar lacuna.
- **S178:** 0889/ADR-0664 prepara reaprovação após correção parcial sem exigir nova conferência de localizações já efetivadas; pendentes continuam sujeitos à conferência. Interface distingue linhas parcialmente aprovadas de linhas incorporadas. 0892–0893/ADR-0667–0668 preparam reserva de códigos novos em aprovação parcial/integral e liberação auditada, excluindo Grupo. 0896/ADR-0671 prepara consulta autorizada de reserva e interface. Revisar compatibilidade dos escritores, reaberturas, concorrência e rollback.
- **S179:** exceção de material está vinculada à lista e à OS, mas suspensão atual pertence ao Chamado e não prova suspensão ou parada da OS. Casos sem Chamado e OS já enviada exigem tratamento próprio; nenhuma operação Auvo foi executada.
- Gates e flags fechados, migrations não aplicadas. Testes e typecheck adiados; preservar volumes locais com erro de I/O. Não declarar stories prontas nem executar deploy.

## 2026-10-29 — Continuação de aprovação parcial e interfaces (Codex)

- Objetivo ativo: completar stories E01-S165–S186. Nenhuma story concluída nesta rodada; testes e typecheck adiados por Lucas. Não ativar gates nem aplicar migrations antes de validação e revisão.
- **S178:** 0884/ADR-0659 prepara fotografia conferida dos campos estruturados da aprovação parcial; 0885 conecta consulta à interface e 0886/ADR-0661 adapta guardas e telas de aplicação oficial. 0887/ADR-0662 prepara correção de linha não incorporada após incorporação parcial; reaprovação com campos estruturados já incorporados requer revisão. Migrations anteriores não aplicadas foram alteradas e dependem de função de 0886; manter gates fechados até reconciliar ordem e revisar a cadeia completa. Tudo sem testes.
- **S181:** composição de orçamento guarda tentativa incerta na sessão por usuário/Cliente/proposta e reutiliza request, inclusive após proposta deixar rascunho. Se origem mudou ou autorização foi revogada, pedido continua pendente. Dados internos residem na sessão do navegador e requerem revisão de segurança; integração não testada.
- **S174:** Cliente 360 e Kanban por Cliente abrem painel de backlog de escopo sob flags desligadas. 0888/ADR-0663 prepara filtro por alvo antes da paginação e interface correspondente; segurança, desempenho e concorrência ainda não foram testados. Modelo de Rotina S165 continua sem fonte versionada compatível identificada; não confundir checklist de inspeção com modelo de Rotina.
- **Operação:** nenhuma migration desta rodada aplicada, nenhuma tarefa Auvo ou cobrança real, sem deploy. Preservar volumes com erro de I/O e reconciliar migrations antes de qualquer aplicação.

## 2026-10-29 — Continuação até 0883 (Codex)

- Desenvolvimento continua a pedido de Lucas, com testes e typecheck adiados. Migrations e ADRs posteriores ao checkpoint 0794 foram preparados localmente, sem aplicação ou validação; gates e flags permanecem fechados. Não houve deploy, disparo Auvo ou operação financeira real. Não declarar stories completas.
- **Plano e capacidade:** snapshots de quantidade de Grupo na aprovação e na ocorrência, apresentação de esforço e fonte parcial por Visita preparados. Capacidade consolidada, criação operacional de OS para Grupo, integração de ocorrência por Visita, revisão de impactos, concorrência e equivalência PMOC seguem incompletos.
- **Cadastro:** conferência e alterações de localização, quantidade e códigos no staging; edição de código em rascunho com supressão de sincronização preparada. Revisar concorrência, gatilhos legados e unicidade entre códigos atuais e aliases antes de ativar. Incorporação integral e XLSX seguro continuam pendentes.
- **Incrementos 0879–0883:** subtotal parcial de capacidade por Visita, histórico financeiro e proteção contra seleção obsoleta no lote preparados; 0883 prepara aprovação parcial por linha, mas não cobre ainda campos estruturados, reserva de códigos e correção após incorporação. Central de Materiais ganhou navegação para contexto da OS; interfaces e migrations sem teste nesta rodada.
- **Financeiro:** snapshots de classificação e fluxo de solicitação/revisão de retificação preparados; não efetivam mudança nem cobrança. Origem, deduplicação, saldos, permissões e decisão contratual sobre aceite de adicionais exigem resolução e revisão.
- **Próximos passos:** implementar lacunas independentes previstas nas stories; reconciliar toda sequência de migrations e integrações antes de aplicação. Depois executar testes, typecheck, CI/db-tests e revisão adversarial. Preservar volumes com erro de I/O; espaço baixo e graphify desatualizado.

## 2026-10-29 — Checkpoint contínuo até 0794 (Codex)

- Continuação a pedido de Lucas: sem executar testes/typecheck nesta rodada. Migrations preparadas e ADRs, flags e gates fechados; nada aplicado ou implantado, sem Auvo/Financeiro real. Trabalho ainda em andamento, não declarar conclusão.
- **S165/S166:** gerador contratual por semana prepara supressão em feriado declarado; identidades separadas de ciclo por calendário e por Visita, materialização legada individual/lote e versões em revisão preparadas. Fontes de feriados, integração da ponte Visita aos consumidores, fechamento de ocorrência, fuso e concorrência seguem bloqueios. Avaliação de impactos de revisão é parcial e não autoriza aprovação.
- **S167/S168/S173/S174:** decisão PCM de retorno, não OK, encerramentos separados, suspensão, reabertura, atribuição e reconciliação por parcela preparados; reclassificação permanece não efetivada. Devolução parcial não autorizada por falta de prova operacional. 0607 pode produzir notificação legada se um dia acionada; revisar efeitos.
- **S176/S177/S178:** atualização de cadastro pelo staging, anexos privados, conferências e quarentena CSV preparados. 0792 prepara conversão de lote integral corrigido para staging tipado, não cadastro oficial. Compatibilidade de códigos, efeitos legados de sync Auvo, origem e segurança de arquivos e concurrency continuam pendentes.
- **S180/S181/S182/S183:** parciais, reserva e documentos internos não fiscais, saldo comum, snapshots públicos e acessos mediados preparados. 0745 é deliberadamente sem efeito; 0757 propõe mudança de unicidade sensível ainda sem provas. Revalidar origens, saldos, locks, competência, URLs e conteúdo antes de qualquer ativação.
- **S185 e S171:** diagnósticos e protocolos parciais de concorrência preparados. 0632 continua bloqueando intenção; 0633/0787 envolvem risco de lock e fontes legadas incompletas. Não iniciar dispatch Auvo.
- **Próxima ação:** continuar implementação das lacunas das specs, reconciliar sequência/migrations e efeitos de triggers; testes/CI/db-tests e revisão adversarial são etapa posterior obrigatória. Preservar volumes com erro I/O e espaço baixo; graphify desatualizado.

## 2026-10-29 — Checkpoint contínuo até 0690 (Codex)

- Lucas solicitou prosseguir sem parar e deixar testes para depois. Migrations/ADRs de 0511 até 0690 foram preparados localmente em paralelo, com flags/gates fechados e RPCs críticas revogadas; não foram aplicados nem testados. Não houve deploy, Auvo ou ações Financeiro reais.
- **Plano e calendário:** staging de cronograma com incorporação e reprocessamento revisionados, regras explícitas de perguntas/evidências/normas no snapshot, histórico de versões, feriados declarados e diagnóstico de vínculos/PMOC preparados. Fontes oficiais e equivalência legada não são comprovadas; fuso civil de vigência do Plano segue indefinido. XLSX seguro e homologação faltam.
- **Execução e Chamado:** retorno com classificação e evidência, atestação PCM, pendências Não OK, encerramento individual de OS e de Chamado, reabertura, revisão por parcela e suspensão preparados; preservam distinção entre declaração e prova. Devolução parcial e fechamento de ocorrência continuam bloqueados por falta de prova de execução/parada e concorrência com escritores legados.
- **Cadastro e evidências:** edição em staging, vínculos parciais, fotos/documentos privados e decisões humanas preparados, sem publicação automática. Conteúdo, antimalware, origem, órfãos e integração do modelo oficial continuam pendentes. Alterações de quantidade de Grupos e pesos GUTD têm comandos auditados e guardas opt-in.
- **Financeiro, Comercial e Portal:** candidatos e rateio, documentos e comprovantes mediados, snapshots públicos e decisões versionadas preparados. Não presumir conciliação ou cobrança. Vários caminhos dependem de segurança, consistência, revisão de permissões e de consumidores legados.
- **Concorrência e legado:** protocolo S171 ainda incompleto, guarda 0632 fechada; 0633 pode apresentar deadlock se habilitada. Ordem de diversas migrations anteriores foi corrigida por inspeção estática, mas sequência completa e referências ainda exigem validação. 0607 pode gerar notificação legada; não aplicar/ativar isoladamente.
- **Próximo passo:** continuar stories incompletas sem criar regras inventadas; depois validar migrations em ambiente descartável, typecheck, testes, CI/db-tests e revisão adversarial. Preservar volumes locais com erro de I/O; espaço baixo e graphify desatualizado. Ver registro de impedimentos para demais detalhes.

## 2026-10-29 — Checkpoint de implementação contínua (Codex)

- Código local preparado até migrations 0510; sem testes/typecheck nem aplicação nesta rodada, por pedido de Lucas. Gates e flags novas permanecem desligados; RPCs críticas revogadas. Não declarar stories prontas nem ativar ou implantar.
- **S169:** staging compartilhado, classificação e aprovação da revisão, tolerância com padrão zero, identidade declarada, incorporação por linha/lote ao Plano rascunho e proposta/aplicação de reprocessamento foram preparados com interfaces. Ainda não comprovam importação XLSX segura, reprocessamento integral, concorrência e integração de ocorrências.
- **S166/S171:** feriados declarados, vínculos Rotina–série com vigência e prévias por Visita/calendário preparados. Reprogramação de Visita enviada registra intenção e triagem, mas não move tarefa Auvo. Fontes de feriado, PMOC/legado e execução remota seguem pendentes.
- **S173/S174/S175:** composições e vínculos a Chamado/parcela/OS, suspensão administrativa e declaração de interrupção preparados; não provam parada e não permitem devolução parcial automaticamente. Triagem de origem preserva eventos; ingestão Auvo real não está integrada por contrato de evento não comprovado.
- **S176/S178:** reclassificação, movimento e quantidade motivada de Grupo; conferência de lote, incorporação de ativos, vínculo a cadastros e algumas atualizações preparadas sob flags. Triggers legados podem enfileirar Auvo e a cobertura de atributos não é completa. Rejeições/reabertura e edições preservam histórico.
- **S180/S181/S182/S183:** comprovantes privados e históricos, rateios e consultas, propostas operacionais sem oportunidade fictícia, publicações controladas e Portal preparados parcialmente; pagamentos/estorno contábil não foram executados. Guardas de Storage, acessos legados, URLs já emitidas, financiamento e exposição de dados requerem reconciliação/revisão antes de qualquer ativação.
- **Próximo passo:** continuar implementação de fontes e integrações em falta; reconciliar sequência e compatibilidade de migrations, divergências de spec e gates. Posteriormente rodar testes, CI/db-tests e revisão adversarial. Preservar volumes locais com erro de I/O e baixo espaço; sem deploy ou efeitos reais em Auvo/Financeiro.

## 2026-10-29 — Checkpoint adicional: desenvolvimento contínuo (Codex)

- Trabalho em andamento, conforme pedido de Lucas, sem testes/typecheck nesta rodada. Migrations e ADRs até 0433 preparados localmente, sem aplicação; flags e gates fechados, RPCs críticas revogadas. Sem deploy, Auvo real ou operação financeira real.
- **S175/S168:** triagem auditada de Cliente, resolução manual para OS existente e recuperação de request preparados; classificação explícita e evidência manual sem interpretar prosa. Ingestão Auvo real continua bloqueada: identidade e formato de evento não comprovados. Evidência declarada não prova origem.
- **S177/S178:** código candidato no staging, incorporação/vínculo e atualização limitada de nome preparados. CSV com prévia e diagnóstico conservador de linhas; XLSX seguro e atualização integral pendentes. Triggers Auvo e colisões ainda impedem ativação.
- **S169/S165/S166:** mapeamento explícito de cronograma, aprovação de revisão, suspensão/retomada e histórico preliminar de decisões sobre vencidos preparados. Feriados declarados não comprovam calendário completo. Geradores legados, identidade entre versões e reconciliação de obrigações seguem pendentes; SPEC_DEVIATION de staging concorrente continua aberta.
- **S171/S173/S174:** transferência local, reprogramação/cancelamento conservadores e permissões configuráveis preparados; pendências atômicas, seleção para composição e GUTD com dados ausentes explícitos preparados. Integração com execução real, fila legada e Visitas enviadas permanece incompleta.
- **S179/S180/S182/S183:** histórico e evidências privadas de materiais; despesas realizadas, comprovantes, correção, rateios e relatórios internos; faturáveis com alocação, complemento, estorno lógico e conferência financeira; Portal com projeções publicadas manualmente preparados. Não equivalem a compra, faturamento ou estorno contábil. Proteção contra mudanças financeiras legadas, Storage/RLS, concorrência e privacidade precisam de revisão.
- **S181/S185/S186:** rascunho Comercial sem oportunidade artificial e publicação/decisão pública versionada preparados com consumidores parciais; reconciliação de integrações e diagnósticos de legado são apenas leitura/triagem. Migração efetiva, contratos e consumidores remanescentes não foram concluídos.
- **Próximo passo:** continuar as frentes independentes, reconciliar dependências e sequências de migrations e depois executar testes/CI e revisão adversarial. Atenção: 0429 pode impedir exclusão por FK mesmo com gate desligado após aplicação; nenhuma aplicação autorizada. Preservar volumes com erro de I/O e espaço baixo; graphify desatualizado.

## 2026-10-29 — Checkpoint de desenvolvimento contínuo (Codex)

- Lucas pediu seguir sem parar enquanto houver código pendente; adiou testes. Migrations 0365–0384 e respectivos ADRs foram preparados em paralelo; flags/gates fechados, RPCs revogadas. Nenhuma migration desta rodada aplicada, teste ou typecheck executado; não declarar PASS nem homologação.
- **S168/S173/S174:** retorno preparado aceita Não aplicável com justificativa. 0371/0380 e UI preparam Pendências derivadas de retorno validado e histórico; fotos/executor dependem da fonte. 0375/0377 preparam seleção parcial e priorização GUTD, sem criar Chamado/OS. Integração com fila legada e transições continuam pendentes.
- **S169:** 0367/0370 e UI preparam mapeamento explícito de cronograma no staging compartilhado; pressuposto quatro semanas exige escolha humana. Exportação PDF parcial declara ausência de datas operacionais e capacidade. XLSX bloqueado por SEC-008; SPEC_DEVIATION de staging concorrente continua aberto até reconciliação.
- **S165/S166/S167:** aprovação de revisão e alteração de dia contratual conectadas sob flags desligadas. 0376/0379/0382 preparam painel de parcelas, revisão de continuidade e vínculo do esforço restante. Ocorrências/PMOC, Visitas futuras e escritores legados ainda precisam reconciliação.
- **S176/S177/S178:** incorporação de ativos conectada com seletores sob flag; marcos parciais de uso de código em 0365, histórico de levantamento 0368 e vínculo de foto 0383 preparados. Integração de marcos, duplicidade de ativos e efeitos de triggers Auvo impedem ativação.
- **S180/S182/S183:** 0366/0369/0372 preparam comprovantes privados e rateio; UI de realização/repasse/rateio sob flags. 0374/0378/0381 preparam publicação revisada de materiais, decisão versionada de orçamento e consulta de cobrança existente no Portal; sem criar cobrança. Checar permissões, texto livre, concorrência, Storage e recuperação de pedidos antes de ativar.
- **Em curso:** 0384 consulta/reconciliação interna de outbox sem retry externo; agentes avançam fotos de Grupos, proposta operacional e integrações. Próximo passo: completar código restante, reconciliar dependências e só depois executar testes, CI com db-tests e revisão adversarial; preservar volumes com erro de I/O. Sem deploy ou operações reais Auvo/Financeiro.

## 2026-10-29 — Continuação de staging, campo e despesas (Codex)

- **S175:** ADR-0133/0358 preparam resolução de envelopes por Cliente e OS existente, com histórico; sem integração webhook/polling ou criação automática de Chamado/OS.
- **S178:** ADR-0134/0359 preparam incorporação de Sistema, Equipamento, Componente e Grupo com referência de pai, gate fechado e comando revogado. Faltam tratamento de duplicidades e atualização/vínculo com cadastros existentes; triggers legados podem produzir intenções Auvo, impedindo ativação.
- **S169:** 0347 criou staging separado em conflito com T003; SPEC_DEVIATION registrado no SQL e tasks. ADR-0136/0361 e ADR-0139/0364 preparam recepção, consulta e revisão no staging S178, e adapter da interface foi alterado. Divergência ainda aberta: conferir isolamento, migração auditada de lotes anteriores e integração antes de remover base concorrente; aprovação/incorporação não implementadas.
- **S182:** ADR-0135/0360 preparam declaração de repasse para despesa realizada, sem cobrança; validade de regra contratual, segregação e integração com Financeiro não comprovadas.
- **S180:** ADR-0137/0362 e interface preparam realização com comprovante; registro continua indisponível até seleção/upload seguro e demais vínculos serem implementados. **S177:** ADR-0138/0363 preparam edição de código de rascunho comprovado, mas falta integração dos marcos de uso e escritores legados.
- **Condições:** migrations novas não aplicadas; nenhum teste ou typecheck nesta rodada por pedido de Lucas. Flags/gates permanecem fechados, sem deploy ou efeitos reais Auvo/Financeiro. Próximo passo: completar interfaces/fontes canônicas e reconciliar S169, mantendo stories abertas até validação e revisão. Preservar volumes locais com erro de I/O; graphify continua desatualizado por limitação de espaço.

## 2026-10-29 — Continuação de integrações sem testes (Codex)

- **S166/S168:** ADR-0126/0351 preparam leitura paginada de candidatas vinculadas, não a fila oficial. ADR-0129/0354 preparam guarda OS–ocorrência–Rotina–versão e cobertura do snapshot, mas formatos de perguntas Auvo não foram comprovados e formatos desconhecidos permanecem bloqueados. Ingestão, PMOC, identidade entre versões e encerramento continuam pendentes.
- **S178:** ADR-0127/0352 preparam incorporação transacional de Área/Local/Sublocal; interface conectada sob `VITE_SSO_INCORPORACAO_LOCALIZACAO_ENABLED` desligada. Ativos, associação/atualização de cadastros existentes e histórico completo na tela seguem pendentes.
- **S181:** ADR-0128/0353 e painel no detalhe da OS preparam edição de orçamento vinculado; composição entre PCM e Comercial foi movida para a camada app. A criação inicial, decisões e política de custos ainda não estão completas; flag desligada e comandos revogados.
- **S171:** transferência de OS entre Visitas não confirmadas conectada à tela sob `VITE_SSO_TRANSFERENCIA_VISITA_ENABLED` desligada, com retry em sessão. Não contempla Visitas enviadas; revalidar concorrência, revogação e recuperação.
- **Gates:** nenhuma migration desta rodada aplicada; nenhum teste nem typecheck executado por pedido de Lucas. Sem deploy, tarefas Auvo ou ações financeiras reais. Stories seguem abertas e exigem CI com db-tests, revisão e homologação. Próximo passo: integrar fontes canônicas e completar os fluxos acima antes de ativar qualquer flag; preservar ambiente local e volumes com erro de I/O.
- **Incrementos finais:** ADR-0130/0355 preparam central de materiais por Cliente, OS e responsável com tela sob flag desligada; falta visão global e navegação direta. ADR-0131/0356 preparam leitura das fontes Visita–OS sem duplicar ocorrência; esforço restante e completude permanecem desconhecidos. ADR-0132/0357 preparam inbox privada de campo, sem ligação ao webhook; autenticação da origem, retenção, processamento e triagem continuam pendentes. Não aplicados nem testados.

## 2026-10-29 — Desenvolvimento em lote sem testes (Codex)

- Lucas pediu avançar no código antes da próxima rodada de testes. Nesta rodada, migrations e interface foram preparadas sem execução de testes, typecheck ou aplicação das novas migrations; nenhum PASS, homologação ou deploy está autorizado por isso. Os gates e flags novos permanecem fechados/desligados.
- **S167:** 0321/0324/0326 e 0330/0333 preparam diagnóstico, criação de OS, parcelas e continuidade. Compatibilidade com índice e trigger legados, autorização efetiva, fechamento, locks e isolamento por Cliente ainda impedem ativação.
- **S179/S180:** 0322/0325/0328/0331 preparam listas, versões e exceções de materiais; 0323 prepara despesas previstas. Interfaces conectadas sob flags desligadas. Restam integração, autorização, concorrência e outros fluxos das specs.
- **S177/S178:** 0329/0332 preparam aliases e substituição administrativa, e 0327 prepara revisão de levantamentos; não comprovam compatibilidade do legado, edição de rascunhos não utilizados ou aprovação/incorporação de staging.
- **S172/S166/S181:** 0334/0338 preparam disponibilidade e vínculos de equipe, não capacidade consolidada; 0335/0337/0340 preparam mudança contratual e ponte de ocorrências, sem identidade estável entre versões ou integração completa da fila/PMOC; 0336/0339 preparam orçamento Comercial com comando revogado e formulário ainda desconectado. Não ativar sem concluir os fluxos e revisar segurança e concorrência.
- **Ambiente:** preservar volumes do banco/Colima com erros de I/O; histórico de migrations locais requer reconciliação. CI remota não executada, e falha anterior de lint de migrations continua aberta. Nenhuma ação real no Auvo ou Financeiro.
- **Incrementos posteriores da mesma rodada:** 0341 consulta referências para S173, sem criar Pendências oficiais; 0342/0345 preparam segunda aprovação S165 com proteção de vigência; 0346 prepara rejeição em staging S178; 0347 prepara staging de cronogramas S169; 0348 prepara retorno/decisão PCM S168; 0349 prepara edição/cancelamento de despesas S180; 0350 prepara transferência de OS entre Visitas não confirmadas S171. Interfaces S169/S178/S180 sob flags desligadas; S171 ainda sem integração de tela. Nada disso foi aplicado ou testado.
- **Trabalho de código ainda aberto:** S168 precisa de ingestão, vínculo OS–versão e cobertura comprovada antes de alimentar S173; S169 não lê XLSX nem incorpora plano aprovado; S171 não reprograma visitas enviadas; S178 não aprova/incorpora cadastros; S180 não resolve vínculos financeiros/rateios/anexos; S181/S182 seguem sem integração operacional completa. Conferir o registro de impedimentos e specs antes de continuar; não declarar as stories completas.

## 2026-10-29 — Continuação paralela: Plano, Visitas e Portal (Codex)

- **S165:** edição de Rotina bloqueia salvamento quando revisão do contexto muda; troca de usuário/Cliente bloqueia visualmente a tela antiga e preserva o rascunho ao retornar. Limitação importante: subtree anterior permanece oculto no DOM e memória, sem isolamento de confidencialidade; consultas/mutações em curso podem continuar no contexto original. Não homologar sem revisar logout, troca de Conta, cache e autorização no servidor.
- **S169/S172:** conferência rejeita alvo vazio ou categoria desconhecida; caso de uso de capacidade combina contrato de cobertura e cálculo. Não há fontes canônicas, adapter, UI nem prova de ausência de sobreposição/deduplicação real.
- **S171/S176/S178:** Visitas ocultam OS/equipe antigas em reconsulta/erro; consulta de Grupo exibe Sistema/categoria/características e guarda síncrona evita envio duplo na mesma tela; linhas de levantamento são reconsultadas ao mudar revisão. Não provam RLS, concorrência, snapshot transacional ou revogação sem reconsulta.
- **S167/S184/S185:** leitor OS rejeita página duplicada/regressiva; Portal descarta campos extras dos itens e oculta snapshot durante reconsulta ou falha, com chave por usuário; falha de view de saúde Auvo não vira lista vazia. A projeção no cliente não evita exposição HTTP/view; autorização, troca de Conta no mesmo usuário e SEC-007 continuam pendentes.
- **Testes focados:** 71 passaram; rodada de 81 passou com 3 ignorados após corrigir falha inicial de envio duplo; outra rodada passou 65. Não substituem db-tests, CI nem homologação. Sem deploy ou operação real Auvo/Financeiro. Graphify pendente por baixo espaço.

## 2026-10-29 — Rodadas paralelas de desenvolvimento (Codex)

- **S169:** leitura preserva linhas com dados em qualquer coluna, inclusive situação, para conferência; fontes originais continuaram com 59/53 linhas em teste opt-in. Importação e aprovação continuam pendentes.
- **S172:** cálculo local subtrai reservas/ausências de tempo destinado; falta de dados permanece desconhecida. Depende de totais sem sobreposição, ainda não comprovados pelas fontes; não equivale a capacidade real.
- **S179:** editor local permite dividir/juntar linhas e preserva texto e trechos originais; ainda sem rota e persistência.
- **S168:** classificação informativa de candidatos não prova ausência remota nem autoriza criação/retry. **S174:** prévia de parcelas verifica seleção/contexto, sem persistir. **S180:** consolidação separa valores previstos e realizados e informa ausências, sem escrita financeira. Todas as stories seguem abertas, com autorização, transações e integração pendentes.
- **Rodada adicional:** S165 bloqueia abrir novo Plano durante edição de Rotina; S166 exibe âncora, fuso e deslocamento da regra; S182 prepara conferência local de ajustes com motivo, sem faturamento. Sessões concorrentes, feriados oficiais, persistência, permissões e integrações continuam pendentes. Testes combinados da rodada passaram 66/66 e typecheck web passou.
- **Verificação:** primeira combinação passou 35 testes; segunda combinação passou 43 testes; typecheck web passou. Não substituem integração de banco ou CI. `pnpm run lint:migrations` falhou no Squawk: parser não reconheceu opclass de exclusão em 0276 em reprodução mínima e outros alertas de lock exigem avaliação; detalhes em impedimentos. Nenhuma migration foi aplicada nem integração real acionada. Graphify segue pendente por espaço oscilante.

## 2026-10-29 — Exceção temporária para teste de banco local (Codex)

- Lucas autorizou prosseguir sem exigir banco local enquanto recupera a máquina. O workflow existente `.github/workflows/ci.yml` tem job `db-tests` com Supabase descartável e pgTAP em runner GitHub; não alterar ou pular esse gate. Testes locais de código que não usem o banco continuam possíveis.
- O workflow só dispara em PR para `main`/`develop` ou push nessas branches. Nesta verificação não havia PR nem execução da CI para `codex/handoff-plano-manutencao`; as alterações atuais não foram validadas no GitHub. Publicação e abertura de PR pertencem a humano/@devops conforme AGENTS.md. Preservar restrições de não deploy e não acionar Auvo real.
- Anotar resultado da CI no commit correspondente e continuar bloqueando PASS/homologação até `db-tests` não pulado, revisão adversarial e demais provas aplicáveis; concorrência, Auth/Storage e integrações reais não são necessariamente cobertos pelo job existente. Retomar testes locais após recuperação segura sem resetar volumes. Detalhes no guia Terra.

## 2026-10-29 — Recepção manual de levantamento (Codex)

- **E01-S178:** o adapter preparado para recepção chama exclusivamente `sso_receber_levantamento_manual` da 0320, passando a origem como declaração, sem fallback para a RPC 0315. O formulário desconectado aceita origem não informada e esclarece que declaração não é prova. Testes reproduziram divergência de contrato e bloqueio indevido antes dos ajustes; 11 testes focados e typecheck passaram.
- **Regressão:** suíte web passou 1.741 testes e ignorou 16; isso não substitui db-tests nem homologação.
- **Limites:** o formulário segue desconectado; migrações 0315/0320 não foram implantadas nem testadas em Supabase nesta retomada. Validar autorização/revogação, concorrência, retenção em sessionStorage/LGPD, múltiplas abas e rollout sem janela insegura; não tratar recepção manual como integração Auvo. Homologação e deploy bloqueados. Espaço oscilou entre 6,2 e 5,2 GiB; banco/Colima com erro de I/O segue preservado. Graphify pendente após alterações.

## 2026-10-27 — Conferência de recorrência da importação (Codex)

- **E01-S169:** a prévia exige mapeamento concreto de modo, intervalo, unidade e data-base quando aplicável; confirmação booleana legada isolada não remove a pendência. A regra escolhida aparece na conferência, sem converter mês em quatro semanas e sem modificar a planilha original. Teste de aplicação reproduziu a falha anterior; 13 testes focados e a leitura opt-in dos dois arquivos originais passaram. Não existe ainda staging de Plano, persistência, aprovação, exportação ou validação server-side; tarefas permanecem abertas.
- **Verificação:** typecheck e Biome dos quatro arquivos passaram; suíte web com um trabalhador passou 1.740 testes e ignorou 16 (o teste opt-in das fontes passou separadamente). Não substitui CI nem db-tests. Graphify continua desatualizado, não reexecutado por falta de espaço; banco/Colima seguem com I/O comprometido e volume preservado. Próximo passo: após recuperação segura do ambiente, integrar mapeamento ao staging e validar recorrência no servidor com autorização, histórico e concorrência.

## 2026-10-27 — Diagnóstico do banco isolado (Codex)

- Docker apresenta estado contraditório: `docker ps` lista o banco como saudável, mas `docker inspect` informa `exited`, `Running=false` e erro de I/O no arquivo `hosts`; `docker exec` confirma que não está executando. Não confiar na listagem nem reiniciar/resetar o contêiner.
- Diagnóstico somente leitura: Colima relata 79 GiB livres dentro da VM, mas o kernel registrou erros de escrita nos dispositivos vdb/vda, journal EXT4 abortado em vdb1 e alerta de possível perda de dados. Espaço no Mac permanece em 2,5 GiB. Não há evidência suficiente para atribuir com certeza a causa ao espaço nem avaliar a integridade dos volumes. Preservar volumes e outros contêineres; não executar fsck, limpeza, reinício ou recriação automática. Após liberar espaço, definir recuperação e backup seguros antes de voltar a executar testes no banco.

## 2026-10-27 — Capacidade e regressão web (Codex)

- **E01-S172:** cálculo local de esforço agora rejeita tipo de tempo desconhecido, em vez de tratá-lo como total. O teste reproduziu a falha antes da correção; 10 testes focados de domínio e aplicação passaram. Não implementa capacidade consolidada, disponibilidade ou integração com Visitas; tarefas e homologação seguem abertas.
- **Verificação:** typecheck web passou; suíte web com um trabalhador passou 1.739 testes e ignorou 16, inclusive o novo teste. Não substitui CI, db-tests, testes integrados com Auth/RLS ou revisão adversarial. A adaptação dos 25 testes pgTAP de recepção S178 à 0320 continua sem execução no Supabase.
- **Ambiente:** espaço caiu de 3,5 para 2,5 GiB durante verificações. Atualização do graphify interrompida para evitar ENOSPC; grafo pode estar desatualizado e deve ser conferido e atualizado após recuperar espaço. Banco isolado segue parado com erro de I/O; preservar volume, diagnosticar antes de reiniciar ou alterar. Próximo passo: estabilizar espaço e banco, executar testes S178/concorrência e avançar nas dependências sem ativar integrações reais.

## 2026-10-27 — Retomada após falta de espaço (Codex)

- Espaço subiu para cerca de 5 GiB, mas ainda não há margem para execução volumosa sem monitoramento. `supabase_db_sso-comprovantes-isolado` permanece parado com erro de I/O em `hosts`; não reiniciar ou resetar sem diagnosticar e preservar o volume. A suíte encerrada por ENOSPC teve 39 suítes impedidas, não representa regressão funcional verde; graphify também não concluiu.
- **S178:** `0318`, adapter e consulta no Cliente360 foram preparados com flag `VITE_SSO_LEVANTAMENTOS_ENABLED=true` desativada por padrão, checagem de capacidade, erro/retry e sem aprovação. Testes usam doubles; 16 verificações SQL foram reportadas antes da parada do banco, mas conferência posterior ao rollback não ocorreu. Faltam jornada Auth/RLS reais, recepção em tela, evidências/fotos e aprovação. Sequência de rollout permanece bloqueada.
- **S170:** `0319` é protótipo não aplicado; revisão identificou possível deadlock entre escritores de permissões e contenção global. ADR-0098 registra alternativas não aprovadas. Roteiro com dblink foi movido a `supabase/manual-tests`; validação concorrente e CI pendentes.
- **S177/S179:** corrigida tipagem de conferência de códigos. Editor puro de materiais preserva texto original; não é persistência nem está integrado. ADR-0099 e testes SQL futuros preparados, não executados. Inventário de transição 1:N S167 registrado em `docs/planejamento/plano-manutencao/inventario-transicao-chamado-os.md`.
- **S178 recepção:** formulário de lote de uma linha foi desconectado após revisão detectar que podia declarar Auvo/Campo/Planilha sem provar origem. ADR-0101 propõe separar origem declarada da verificada. A `0315` também aceita origem fornecida por authenticated: não implantar ou executar operacionalmente antes da correção. Código de retry preserva dados cadastrais por usuário/Cliente em sessionStorage e exige revisão de retenção/LGPD e múltiplas abas. Consulta segue sob flag desativada por padrão.
- **S178 proveniência:** `0320` prepara separação da entrada manual e revoga RPC anterior; núcleo foi exercitado com fixtures sintéticas em PostgreSQL local temporário, sem rede, não em Supabase real. Instância temporária foi parada; diretório `/tmp/sso-s178-pg-Dv85TU` foi preservado. Não implantar: falta adaptar teste/adapter à origem manual, avaliar alteração de constraint e janela entre migrations, concorrência, Auth/RLS reais e rollout coordenado.
- **S172/S173:** contrato de cobertura distingue fontes ausentes sem declarar capacidade real; seis testes passaram. ADR-0100 e prévia de candidatos Não OK preservam vínculo e excluem Corrigido; não criam Pendência nem substituem retorno S168 validado. Oito testes focados passaram. Nenhum AC dessas stories foi concluído.
- **S179/S180:** editor de materiais separado foi testado com gateway simulado, sem rota ou persistência; ADR-0099 e testes SQL futuros não executados. ADR-0102 e contratos de despesas tratam previsto, realizado zero e cancelamento, sem persistência ou integração financeira; migration 0321 não criada.
- **Verificação desta retomada:** 18 testes focados passaram e typecheck web passou. Não substituem suíte completa, db-tests ou revisão adversarial. Nenhuma migration foi aplicada permanentemente; sem deploy ou operação real Auvo.
- **Regressão adicional:** suíte web com um trabalhador passou 1.700 testes e ignorou 16 antes da última revisão que desconectou a recepção S178; depois dessa revisão, 14 testes focados e typecheck passaram. Reexecutar suíte completa após estabilizar as demais alterações. Graphify concluiu atualização de código, mas alterações posteriores exigem nova atualização.
- **S168/S182:** pré-condição local de T−24 e contratos locais para origem faturável, estorno/complemento foram testados; não executam envio, persistência ou cobrança. Autorização, idempotência, reconciliação e integrações no servidor permanecem pendentes.
- **S181:** fluxo Comercial existente passou a rejeitar centavos inválidos ou fora da precisão segura no cálculo e no comando de composição; 39 testes focados passaram. Validação no servidor, proteção de custos, orçamento operacional e integração ainda pendentes.
- **S167:** leitura de OS por Chamado conectada ao detalhe sob `VITE_SSO_ORDENS_CHAMADO_ENABLED=true`, desligada por padrão; RPC exige capacidade atual `chamado.encerrar`, sem fallback, e bloqueia contexto divergente. Falta Auth/RLS real, migração, leitores adicionais e escrita 1:N.
- **S185:** painel Auvo deixou de consultar erro bruto da view e apresenta mensagem genérica; mudança no cliente não protege acesso direto à view. SEC-007 e revisão de detalhes sanitizados continuam pendentes.

## 2026-10-27 — Desenvolvimento continuado do programa SSO (Codex)

- **E01-S165:** ADR-0092 e `0314` preparam RPC de comparação revisionada, com origem conferida contra evento de auditoria e questionário não versionado explicitamente indeterminado. 180 pgTAP passaram em banco isolado com rollback de DDL e fixtures. Interface conectada sem fallback; exige servidor atualizado antes do cliente, caso contrário mostra erro/retry. Não prova concorrência real nem impactos em Ocorrências/OS; segunda aprovação continua bloqueada.
- **E01-S166:** `0313` prepara vínculo aditivo de origem contratual; 20 pgTAP passaram com rollback. Roteiro concorrente foi preparado, mas não executado. Prévia de mudança de dia aceita feriados hipotéticos e informa ausência de feriados oficiais, Visitas e exceções; não altera regras nem gera registros. Faltam fontes oficiais, cardinalidade de ciclo, comando auditado e concorrência.
- **Banco isolado:** histórico do CLI termina em `0310`, embora política de `0311` exista e função `0312` esteja ausente. `0313`/`0314` só foram exercitadas em transação revertida. Não aplicar automaticamente nem resetar; reconciliar histórico e objetos antes de sequência definitiva.
- **E01-S167:** inventário de consumidores e dependências foi registrado no research; T001 concluída. Consulta preparada oculta ordens em revalidação ou erro; isto não limpa cache nem detecta revogação sem reconsulta. Cardinalidade e escrita 1:N continuam bloqueadas.
- **E01-S169:** parser de matriz e prévia de conferência preservam fonte, linhas e valores. Testes locais opt-in leram os dois cronogramas originais, com 59 e 53 linhas. Ainda faltam abertura XLSX segura na aplicação, staging e aprovação; nenhum cadastro foi gravado.
- **E01-S178:** ADR-0093 e `0315` preparam recepção auditada de linhas em staging, com limites e autorização atual; 21 pgTAP passaram com DDL/fixtures revertidos. Faltam concorrência real, leitura, fotos, revisão, aprovação, UI e integrações. No primeiro teste de confirmação, fixtures de Clientes geraram intenções locais de Auvo dentro da transação; Vault local sem segredos impediu envio, rollback as descartou e consulta confirmou zero das duas referências. Teste passou a suprimir explicitamente o gatilho.
- **E01-S171:** teste concorrente de registro de ciência versus confirmação passou 11/11 nas duas ordens no isolado. Fixtures `171a0000-*`, uma ciência, uma confirmação, dois comandos e dois eventos sintéticos permanecem no volume; outbox dos IDs conferidos zerada. Outro teste reproduziu confirmação após revogação durante espera por funcionário. Não considera envio ou homologação aprovados.
- **E01-S170/S171:** ADR-0094 e `0316` acrescentam revalidação após esperas por funcionário e OS. Dois cenários concorrentes antes falhavam e passaram com função substituta na transação de confirmação; 217 pgTAP passaram em transação revertida. A ordem inversa continua sem serialização entre última checagem e commit (teste TODO): não declarar revogação plenamente segura. Migration não aplicada definitivamente.
- **E01-S177:** ADR-0095 e `0317` preparam inventário agregado de colisões de códigos legados para superadmin ativo, sem expor ou alterar códigos. 13 pgTAP passaram com rollback; nenhum inventário real foi realizado. Alias, reservas, compatibilidade e correção auditada permanecem pendentes.
- **SEC-008:** leitor legado usa SheetJS `xlsx@0.18.5` via CDN, com vulnerabilidades publicadas; avaliar substituição com limites de descompressão e testes de arquivos maliciosos. Não usar na nova importação.
- **Verificação:** a primeira suíte web concorrente falhou em três testes (duas esperas de interface e uma medição de desempenho); os três passaram isolados com um trabalhador. Suíte completa com um trabalhador passou 1.660 testes e ignorou 16; typecheck passou. Teste opt-in de planilhas originais é um dos ignorados por padrão. CI/db-tests completos e revisão adversarial continuam pendentes.
- **Verificação posterior:** typecheck passou; repetição dos 21 pgTAP S178 passou com gatilho Auvo suprimido e rollback explícito. Regressão web posterior à integração terminou com 1.665 aprovados, 16 ignorados e 2 falhas; uma foi espera em `FormularioRotina.test.tsx`, que passou em repetição focada, sem provar causa. A saída capturada da segunda falha foi truncada; repetir suíte e identificar ambas antes de alegar regressão verde. Outro projeto executava testes simultaneamente; não interrompê-lo. Não reiniciar processos ou banco por timeout.
- **Falta de espaço:** repetição da regressão terminou com 39 suítes impedidas por `ENOSPC`; graphify também falhou ao gravar arquivo temporário. Depois houve recuperação parcial de espaço (aproximadamente 5 GiB), typecheck web passou e testes focados da consulta de levantamentos passaram. Banco isolado `supabase_db_sso-comprovantes-isolado` está parado com erro de entrada/saída ao acessar `hosts`; não reiniciar, resetar ou excluir volumes sem avaliar recuperação. A sequência `0319` está local e sem validação de banco. Repetir CI/testes completos e atualizar graphify quando houver espaço e ambiente estáveis.
- **Próximos passos:** integrar e testar a prévia revisionada, fundar recepção de levantamentos com aprovação separada e continuar dependências transacionais. Sem deploy, alteração de produção ou tarefa real Auvo; homologação permanece bloqueada.

## 2026-10-27 — Continuação de Plano e calendário (Codex)

- **E01-S165:** seletor de alvo não oferece resultados de busca anterior enquanto a nova consulta está pendente; preserva referência selecionada e bloqueia seleção com dados incompletos ou erro. Testes focados de interface: 42/42. A validação definitiva permanece no servidor.
- **Aprovação:** roteiro existente em duas sessões passou 30/30 verificações no banco isolado. Não prova repetição simultânea após commit nem implementação de segunda aprovação; estes gates permanecem abertos.
- **E01-S166:** prévia de mudança do dia deixou de propor reposição de ciclo anterior à vigência, inclusive quando a data anterior está fora da janela visível ou antes de hoje. Testes de domínio focados: 29/29. Não cria Visitas ou Ocorrências; integração e homologação seguem abertas.
- **E01-S167:** caracterização legada passou 13/13 com rollback no banco isolado: segunda OS continua impedida pelo legado e há vínculos de Cliente divergente aceitos, além de leitura PCM sem filtro por Cliente. Não liberar escrita 1:N nem declarar segurança corrigida com base nesse teste.
- **Comprovantes:** dez jornadas isoladas consecutivas passaram com login, download e recusa após revogação. O 401 anterior não foi reproduzido nem teve causa identificada; não declarar resolvido. Dez fixtures sintéticas persistem no volume isolado; nenhum reset, deploy ou tarefa real Auvo.
- **Regressão:** suíte web passou 1.649 testes, com 15 ignorados; typecheck passou. Estes resultados não substituem CI, db-tests completos e revisão adversarial.
- **Próximos passos:** continuar S165/S166 e dependências conforme impedimentos, implementar e testar segunda aprovação com vigências seguras, investigar login intermitente e efetuar revisão adversarial. Homologação continua bloqueada.

## 2026-10-27 — Revisão autorizada de alertas em produção (Codex)

- Consulta somente de metadados confirmou as três views sinalizadas: proprietárias `postgres`, SELECT concedido a `authenticated` e não a `anon`; dependem de filtros explícitos baseados em claims JWT. A view `comercial.portal_propostas` filtra Cliente e papel, porém retorna integralmente `proposta_versoes.payload`; não foi inspecionado conteúdo de propostas e não há prova de exploração. A correção local E01-S184 `0230` prepara projeção restrita, mas não foi implantada.
- `pcm.auvo_sync_health` retorna `last_error` sem a sanitização encontrada em `pcm.auvo_sync_error_details`; ambas usam permissões do JWT em vez de revalidar concessão no banco. Riscos dependem do conteúdo dos erros e duração do token; não houve leitura de dados ou alteração em produção. Alterar simplesmente para `security_invoker` pode interromper consumidores/RLS e exige desenho e testes de compatibilidade.
- Security Advisor mostra 3 erros e 91 avisos; somente os 3 erros solicitados foram examinados. Retomar implementação de E01-S165/E01-S166 e dependências com testes isolados; manter rollout e homologação bloqueados.
- **E01-S165:** tela agora consulta questionário histórico aprovado sob demanda, mantendo itens não reconhecidos sem interpretação, e permite consultar vigência por data escolhida somente com lista completa. A segunda aprovação e impactos reais permanecem bloqueados.
- **E01-S166:** tela oferece simulação de regra explicitamente parcial, sem feriados, exceções ou Visitas existentes e sem criação. ADR-0091 propõe vínculo de origem de Visita antes de implementar mudança efetiva; não é homologação nem migration.
- **Validação local:** 160 pgTAP de Plano, 14 de cálculo de ciclos, 9 de governança e 53 de estrutura e 217 de Visitas passaram em banco isolado, com rollback. Corrigido carregamento de Lançamentos em StrictMode; jornada real de comprovantes passou uma vez e nova tentativa falhou no login intermitente. Segue investigação; não declarar estável ou homologada.
- **Auth/comprovantes:** depois da falha intermediária, quatro execuções recentes da jornada isolada passaram. Erro de consulta de perfil foi distinguido de perfil ausente e testes simulados cobrem corrida do provedor; a origem do 401 intermitente não está identificada e erro/mensagem podem divergir em concorrência. Não considerar o problema resolvido apenas pelas passagens.
- **Regressão:** suíte web final passou 1.646 testes, 15 ignorados; typecheck e Biome nos arquivos selecionados passaram. Graphify atualizado. CI/db-tests completo e revisão adversarial permanecem exigidos para PASS.

## 2026-10-27 — Inventário autorizado de comprovantes em produção (Codex)

- Lucas autorizou consulta exclusivamente de metadados, sem abrir comprovantes nem alterar dados. No projeto Sinergica SO / branch de produção, consulta agregada em `storage.objects` encontrou 13 objetos em 13 prefixos no bucket `financeiro-comprovantes`, criados entre 2026-07-21 e 2026-08-11 (UTC); bucket configurado como privado. Não é inventário de outros artefatos ou de URLs assinadas ativas.
- Políticas de Storage encontradas para esse bucket autorizam leitura a JWT com papel superadmin ou módulo financeiro leitura/escrita e escrita/exclusão com papel superadmin ou financeiro escrita; a expressão inspecionada usa claims do token, sem verificação atual por lançamento/Cliente. Isso não prova exposição indevida nem URLs ativas; requer avaliação e rollout coordenado E01-S184, sem mudanças em produção nesta consulta.
- Dashboard exibiu status `Unhealthy` e três alertas críticos de views `SECURITY DEFINER` (`pcm.auvo_sync_health`, `pcm.auvo_sync_error_details`, `comercial.portal_propostas`). Não foi avaliado impacto ou causa; investigar separadamente sem supor comprometimento.
- Editor SQL abriu rascunho privado `Untitled query`; alterações de consulta não foram salvas explicitamente. Não executar alterações ou apagar artefatos sem autorização.

## 2026-10-27 — Ambiente recuperado com 4 GB (Codex)

- Lucas autorizou aumentar Colima para 4 GB e reiniciar. Ambiente iniciado com memória confirmada, sem reset ou exclusão de volumes; outros serviços iniciaram automaticamente.
- Banco isolado respondeu; extensão pgTAP foi instalada somente nele. E01-S166 `calendario_contratual.test.sql` passou 41/41, inclusive fuso, autorização e rollback; fixtures SQL revertidas. Isso não conclui testes concorrentes nem homologação.
- Jornada de comprovante chegou ao navegador após corrigir seletor ambíguo, mas falhou antes do download: tela de Lançamentos ficou sem conteúdo e, em outra execução, sessão foi encerrada. Não concluir validação integrada; investigar Auth/permissões/consultas. Fixtures sintéticas de execuções parciais permanecem no volume isolado.
- Próximo passo seguro: investigar falhas do teste integrado isolado sem mexer em bancos compartilhados; inventário de URLs/arquivos antigos só após definir ambiente e autorização apropriada.

## 2026-10-27 — Continuação das stories do programa (Codex)

- **Autorização:** Lucas autorizou avançar nas stories S167, S169–S174, S176–S183 e S186 com checklists abertos, mantendo homologação e deploy bloqueados até testes e revisões. Autorização anterior também cobre S165, S166 e S184. Não marcar checklists como aprovados.
- **S165/S166:** tela de Plano protege seleção e rascunho contra mudança de revisão; calendário recusa resposta divergente e valida fuso no cliente. Trigger servidor já valida fuso; 3 testes pgTAP de RPC/rollback foram acrescentados, ainda não executados devido ao Docker indisponível. Segunda aprovação permanece bloqueada.
- **S167/S170/S176/S177:** leitura paginada de OS por Chamado foi preparada sem ligar UI ou aplicar RPC; telas de capacidades, histórico e prévia de códigos bloqueiam dados/ações obsoletos em reconsulta. Recomendações pendentes são descartadas se contexto muda. Isso não substitui validação no servidor, implementação de alias ou homologação.
- **S178:** prévia pura bloqueia dependentes, ciclos e referências ausentes, sem persistir/aprovar. Importador legado agora distingue dependências e relatórios por aba/linha e propaga falhas, mas ainda grava estrutura oficial e não é staging. **S179:** parser puro preserva texto original e não infere dados ambíguos; faltam persistência e integração.
- **S180:** regras locais distinguem previsto/realizado e validam soma de rateio informado; não validam existência ou acesso à OS e não executam escrita financeira. Persistência, auditoria e integração com Visita seguem pendentes.
- **S173:** prévia de respostas identifica Não OK, corrigidos, itens obrigatórios ausentes e falta de justificativa, sem criar Pendências. **S181:** motor Comercial existente rejeita preços/parâmetros não finitos, sem mudar fórmula; formação operacional não está concluída. **S182:** prévia pura calcula saldo e estornos, sem efetivar cobrança nem validar concorrência/competência no servidor.
- **S169/S172/S174:** regras puras tratam X como programação e SPCI zero como tempo pendente, estimam HH sem duplicar quantidade na referência total e projetam retorno de escopo não resolvido. Não importam planilhas, calculam capacidade real nem alteram Chamado/Backlog; integrações e testes de banco seguem pendentes.
- **S175:** research registra que webhook e importação ainda não compartilham uma transação única; referência externa, deduplicação concorrente e capacidade de triagem precisam de contrato comprovado. Nenhum envio Auvo real foi feito.
- **Comprovantes:** Docker inspect e Auth isolado voltaram a não responder, inclusive fora do navegador; validação integrada segue bloqueada. Não reiniciar ou parar outros projetos sem nova autorização; não resetar bancos.
- **Verificação:** suíte web passou com 1.618 testes e 15 ignorados; typecheck passou. Testes pgTAP novos, CI completa, integração e revisões adversariais seguem pendentes; os resultados não encerram as stories.

## 2026-10-27 — Reinício autorizado e tentativa de comprovantes (Codex)

- **Ambiente:** Lucas autorizou reiniciar Docker/Colima compartilhado; reinício concluído sem reset ou exclusão de bancos/volumes. Contêineres existentes voltaram a iniciar automaticamente, inclusive de outros projetos. Banco isolado chegou a healthy e a rota Edge iniciou.
- **Jornada real:** após iniciar o servidor de teste, o comando de status da pilha isolada excedeu 30 segundos dentro do worker; teste falhou antes de executar o cenário e não comprova a jornada. Prazo de status do roteiro ampliado de 10 para 30 segundos. Nova investigação deve considerar pressão de recursos e serviços compartilhados; não parar ou apagar outros projetos sem autorização.
- **Homologação:** continua bloqueada, conforme `docs/planejamento/plano-manutencao/impedimentos-desenvolvimento.md`. Não houve deploy nem tarefa real Auvo.

## 2026-10-27 — E01-S165 e E01-S166 retomadas com checklist aberto (Codex)

- **Autorização:** Lucas autorizou avançar nas duas stories com os itens de checklist abertos; homologação permanece bloqueada. Não marcar PASS nem executar deploy ou Auvo real.
- **E01-S165:** consultas de versões e Rotinas ocultam conteúdo e ações obsoletos durante reconsulta ou falha; formulário aberto preserva edição, mas bloqueia escrita e retry até recuperar dados válidos. Mudança concorrente de revisão bloqueia novo salvamento. Segunda aprovação continua bloqueada até cumprir os gates da ADR-0089.
- **E01-S166:** contratos e regras antigos ficam ocultos durante reconsulta ou falha; seleção e criação exigem contrato confirmado na consulta atual. Envio e retry são serializados na mesma instância da tela, sem garantia entre abas. Prévia de Visitas limita resultados extensos, como a prévia por calendário, sem gerar Visitas ou Ocorrências.
- **Comprovantes:** nova tentativa da pilha isolada travou na inicialização do banco; somente o processo próprio foi interrompido. Testes Deno da rota (8) e download sintético em Chromium (1) passaram, mas não demonstram a jornada real de tela, Auth e Storage. Não reiniciar ou resetar o ambiente compartilhado para contornar.
- **Verificação:** suíte web com 1.553 testes aprovados e 15 ignorados; typecheck passou. Índice graphify atualizado. Isso não substitui db-tests, CI e revisão adversarial.
- **Gates:** proteção de interface não substitui autorização atual no servidor; falhas, dependências e provas pendentes continuam em `docs/planejamento/plano-manutencao/impedimentos-desenvolvimento.md`.

## 2026-10-27 — Comprovantes: tentativa de integração e progresso paralelo (Codex)

- **Jornada integrada:** roteiro `playwright.comprovante-real-isolado.config.ts` e `e2e-isolado/comprovante-real.spec.ts` prepara navegador, Auth, Storage e Edge na pilha isolada, com bloqueio de rede externa e fixtures sintéticas. Não foi validado funcionalmente: Docker/Colima não respondeu a `/_ping` e a inicialização isolada travou. Processo próprio foi interrompido; nenhuma VM compartilhada foi reiniciada, nenhum reset executado. O roteiro retém fixtures sintéticas e auditoria no volume isolado, inclusive em falha parcial; requer ambiente descartável e conferência antes de executar.
- **Rota:** JSON limitado a 4.096 bytes por leitura em partes, inclusive tamanho declarado falso, e teste cobre cancelamento do corpo; 8 testes Deno passaram. Arquivos maiores que 10 MB ainda são baixados do Storage antes da checagem; avaliar proteção por streaming. Nenhum deploy.
- **Comercial:** teste de componente real gera PDF com snapshot histórico e gerador real; acesso negado não entrega bytes. Auth/dados são simulados; não prova Portal histórico, RLS real, nem reparação auditada.
- **Visitas:** reconsulta/falha oculta lista e detalhe e bloqueia ações; formulário permanece montado e seus dados podem continuar na memória/DOM. Não substitui revalidação servidor ou isolamento de cache.
- **Gates à época:** E01-S165 e E01-S166 tinham item de checklist aberto cada; a autorização posterior de Lucas para prosseguir está registrada acima. Homologação continua bloqueada. Regressões independentes passaram.
- **Verificação:** 1.545 testes web passaram, 15 ignorados, typecheck passou; teste Deno da rota 8/8 e Chromium sintético 1/1 passaram. Teste de navegador completo não rodou. Seguir por recuperação do runtime isolado, execução do roteiro e revisão das pendências em `docs/planejamento/plano-manutencao/impedimentos-desenvolvimento.md`.

## 2026-10-27 — E01-S184 retomada com checklist aberto (Codex)

- **Autorização:** Lucas autorizou continuar a implementação com o item de checklist aberto, mantendo homologação bloqueada até testes e revisão adversarial. Não marcar PASS, deploy ou rollout.
- **Financeiro:** tela de Lançamentos remonta contexto em troca de usuário/papel/permissão observada; não mostra dados anteriores ou resposta atrasada de outra sessão. Reconsulta esconde dados e erro descarta resultados anteriores; download pendente é cancelado quando contexto ou consulta mudam. Testes de componente usam gateway simulado e não comprovam revogação remota sem revalidação.
- **Comprovantes em navegador:** `playwright.comprovante-isolado.config.ts` com `vite.comprovante-isolado.config.ts` não carrega `.env`, bloqueia tráfego externo e usa dados sintéticos. Teste Chromium confirmou bytes e nome do download do helper, não a jornada completa da tela/Auth/Storage. Suíte Playwright padrão pode acessar produção e não foi executada.
- **PDF histórico:** Comercial superadmin pode gerar versão selecionada a partir de seu snapshot; revalidação de identidade e RLS acontece antes da entrega, e troca de contexto cancela saída. Testes com SDK real e transporte simulado cobrem negativas e erros, não comprovam Auth/RLS reais, reparação auditada ou ausência de corrida após última checagem. Portal histórico permanece aberto.
- **E01-S167/E01-S176:** adapter de leitura de OS por Chamado possui testes de contrato com SDK real e rede simulada, ainda sem ligar tela ou aplicar `0312`. Formulários de Grupo e movimentação bloqueiam edição desatualizada, preservam dados e retry; servidor segue responsável pela revisão. Nenhum código ou cadastro existente foi removido.
- **Próximos passos:** preparar jornada isolada completa de comprovantes com Auth/Storage e tela, revalidar acesso sem troca de identidade e tratar URLs antigas sem exclusão de evidências; revisar versão pública histórica/Portal e integração 0312 após definir leitura e medir desempenho. Manter os gates em `docs/planejamento/plano-manutencao/impedimentos-desenvolvimento.md`.
- **Verificação:** 1.539 testes web passaram e 15 foram ignorados; typecheck passou. Teste Chromium isolado de download passou. Suite inicial falhou por inclusão indevida do Playwright no Vitest e dependência de ambiente no teste histórico; corrigidas as duas causas e repetida a suíte. Esses resultados não homologam a story ou substituem CI/pgTAP/revisão adversarial.

## 2026-10-27 — Continuação: permissões, Visitas e compatibilidade (Codex)

- **Permissões na interface:** testes reproduziram uso de permissões anteriores após troca de usuário/papel e na sequência A–B–A; o contexto agora recusa dados de outra identidade e reconsulta ao mudar papel. Resposta antiga é descartada. Revogação sem mudança de identidade/papel e validação real permanecem gates; não substituir autorização do servidor.
- **E01-S171 parcial:** criação preserva pedido mais recente após resposta antiga; ciência e listas desatualizadas ficam ocultas/bloqueadas durante reconsulta ou falha, incluindo desvinculação, equipe e posição. Não substitui revalidação transacional, integração real ou coordenação entre abas.
- **E01-S176/S177 parcial:** falha ao reservar segunda sugestão restaura siglas em teste local, mas compensação continua vulnerável a concorrência e exige solução transacional auditada. Grupos ocultam lista antiga após falha de atualização e permitem retry. Códigos existentes e escrita legada não foram removidos.
- **E01-S167 parcial:** migration `0312`, ainda sem aplicação permanente, recusa OS canônica referenciada por outro Chamado e mantém tratamento de vínculos legados válidos. Testes isolados com rollback ampliados para 23 verificações. Sem integração de interface; avaliação de desempenho, permissão de leitura e revisão adversarial continuam abertas.
- **Verificação:** suíte web passou com 1.499 testes e 15 ignorados; typecheck passou. Checklist da E01-S184 ainda tem gate de testes/revisão aberto; não marcar PASS nem iniciar rollout com base nesses resultados. Sem deploy ou operação real Auvo.

## 2026-10-27 — Continuação paralela: segurança e operação (Codex)

- **E01-S184 parcial:** comprovantes baixam pela rota segura sem janela sujeita a bloqueio; assinatura dos bytes sugere extensão PDF/PNG/JPEG/WEBP, desconhecidos usam `.bin`, sempre como download. Isso não valida o conteúdo nem substitui teste em navegador. Formatter público foi endurecido para dados malformados; teste com gerador PDF real cobre preço público, ausência de custos e preservação de snapshots, mas não prova navegação de versões históricas ou reparação de artefatos.
- **Sessões e cache:** limpeza de consultas na troca de identidade/papel ou logout e proteção contra resolução antiga, com testes locais. Uma corrida de logout foi reproduzida no SDK real; fila usada pelo adapter e logout condicional passaram em 3 testes com Auth isolado e usuários sintéticos removidos. Ainda faltam revogação sem troca de papel/identidade, mutações em voo, comportamento cross-tab, tela real e estratégia para fila presa por rede; não homologar proteção global somente por esses testes.
- **E01-S170 parcial:** requisições incertas de capacidades são preservadas por usuário na sessão do navegador e podem ser repetidas sem trocar requestId; armazenamento indisponível ou corrompido bloqueia novas escritas. Integração real em banco local passou 9 verificações para concessão/revogação, gestão de Plano e isolamento entre Clientes, com transação revertida. Faltam concorrência, outras ações legadas e integração real da interface.
- **E01-S176 parcial:** formulários isolados por usuário/Cliente, destinos antigos bloqueados durante erro de consulta, retry e preservação contra respostas ou pedidos concorrentes na mesma aba; testes focados cobrem esses casos. Pedidos incertos entre abas exigem desenho, ADR e reconciliação de abas legadas; não implementar apenas proteção visual como segurança.
- **E01-S165/S166 parciais:** seleção de versões aprovadas não presume ordenação por UUID e exige escolha explícita quando há mais de uma ou paginação; exibe vigências. ADR-0089 propõe vigências não sobrepostas, mas a segunda aprovação permanece bloqueada enquanto consumidores e impactos não forem verificados. Prévia de ciclos agora reconsulta o mesmo período; testes cobrem âncora mensal, ano bissexto, tolerância e feriado simulado, sem materializar Ocorrências.
- **E01-S171 parcial:** edição não oculta pedido diferente quando uma resposta antiga chega; associação de OS e seleção de pessoa ficam bloqueadas durante revalidação ou se a opção escolhida deixa de constar na lista. Isso não substitui autorização e revalidação no servidor nem conclui as transições após confirmação.
- **E01-S167/S177 caracterização:** 13 testes de banco locais e revertidos mostram limites legados de Chamado–OS, inclusive vínculo entre Clientes divergentes e restrição de número após exclusão lógica; não remover índice isoladamente. ADR-0090 e migration `0312` preparam leitura restrita e paginada; 15 verificações em transação revertida no banco isolado cobriram vínculos unilaterais e ambiguidades, mas não há aplicação, integração ou homologação. Mapeados consumidores dos códigos públicos; testes de descriptors Auvo com dados fictícios passaram, sem envio real. Segurança de aliases e importação segue em aberto.
- **Verificação e limites:** suíte web passou com 1.482 testes e 15 ignorados; typecheck web, 9 pgTAP de governança, 13 de compatibilidade e 15 da leitura isolada passaram. Esses resultados não substituem os testes de integração ignorados, CI completa nem revisão adversarial. Nenhuma story recebeu PASS; não houve deploy, push ou operação real no Auvo. Detalhes e gates em `docs/planejamento/plano-manutencao/impedimentos-desenvolvimento.md`.

## 2026-10-27 — E01-S171 fundação isolada (Codex)

- **Parcial, não aprovada:** T001 revalidada; ADR-0058 a 0070 e migrations locais `0282`–`0294` criam Visita própria, vínculo histórico com OS e equipe. Chaves compostas impedem associação entre Clientes; índices parciais limitam OS a uma associação vigente, sequência única e funcionário a uma participação vigente por Visita. `0288` encerra participação preservando motivo e histórico; `0289` edita janela, posição, responsável e deslocamento de Visita não confirmada, com validação e auditoria. `0290` planeja rascunho; `0291` confirma Visita planejada com responsável ativo, equipe e OS vigentes, registrando política efetiva e revisão em snapshot imutável. `0292` registra evidência de ciência completa, vinculada à revisão e, se posterior, à confirmação exata; permite registrar antes ou depois da confirmação PCM, mantendo histórico imutável. `0293` confere política atual e evidência correspondente, sem autorizar envio; ciência em data futura ou anterior à edição não satisfaz conferência. `0294` oferece listagem paginada por Cliente/período e detalhe com contagens vigentes. Confirmação PCM independe da ciência do Cliente. Revalidação transacional no envio ainda não existe. Comandos e consultas usam autorização `visita.confirmar`, revisão, auditoria e retry quando aplicável; escrita direta não foi liberada. Associação, equipe e janela não alteram Visita confirmada nesta etapa. Nenhuma agenda legada ou OS foi convertida; referência Auvo existente é preservada.
- **Próximos passos:** desvinculação de OS, alterações após confirmação com invalidação, validade da ciência e revalidação antes do envio, vínculo com calendário, estados/transições, prévias, UI global/360, concorrência adicional e revisão adversarial. Testar disputas das políticas de contrato e Visita e demais comandos, incluindo retry simultâneo. Equipe cadastrada não comprova disponibilidade ou capacidade. A capacidade usada para rascunho é conservadora e precisa integrar o modelo completo de permissões. E01-S167/S170 e contrato Auvo continuam não homologados. Avaliar locks das constraints adicionais em OS/Áreas e efeitos das proteções de localização antes de rollout. T002/T003 e demais tarefas não estão concluídas.
- **Aplicação parcial:** contrato tipado e adapter conectam criação, edição, associação de OS, equipe, planejamento, confirmação, ciência, lista e detalhe aos comandos locais. Respostas são validadas e conferência jamais é tratada como autorização de envio. Recuperação por sessão cobre criação, edição, associação, equipe, planejamento, confirmação e registro de ciência, mantém operação incerta por usuário/Cliente/Visita e não apaga nova operação quando retry antigo termina; rejeição definitiva de revisão obsoleta libera nova conferência. Política por Cliente/contrato ainda requer recuperação em escopo próprio. Faltam visão global, interface e testes de integração real; não marcar T007/T008 como concluídas.
- **Atualização de composição:** ADR-0071 e migration local `0295` acrescentam consultas paginadas de OS e equipe, incluindo histórico e motivo de encerramento, com autorização por Cliente. Adapter tipado conectado. Permanecem pendentes visão global, interface operacional de edição, histórico de alterações de nomes e integração real. Não há alteração de agenda ou envio.
- **Seletores de composição:** ADR-0072 e migration local `0296` consultam OS do Cliente sem vínculo vigente e funcionários ativos, com busca literal, paginação e autorização atual; funcionário já vinculado pode ser incluído ou excluído para seleção de responsável ou equipe. Adapter conectado. Consultas não garantem disponibilidade e servidor revalida ao gravar; faltam formulários e integração real.
- **Seletor de posição:** ADR-0085 e migration local `0309` consultam Áreas e Locais ativos por Cliente/Visita, com `visita.confirmar`, busca literal e paginação; Local exige Área válida do mesmo Cliente. 217 testes pgTAP S171 passaram. Próximo passo: conectar adapter e interface de edição de posição, com recuperação de pedido, posição anterior indisponível, cancelamento e testes; consulta ainda não altera Visita. Migration aplicada diretamente apenas no banco local.
- **Edição de posição na interface:** adapter conecta seletor por Cliente/Visita; Visitas em rascunho ou planejadas permitem selecionar Área e Local atuais ou remover ambos, sem alterar horário, responsável ou deslocamento. Pedido incerto é recuperado com mesma identidade e revisão. 49 testes focados passaram, 3 de fuso foram pulados por ambiente; typecheck passou. Interface exige escolha explícita e informa que posição antiga pode ter mudado; faltam testes de paginação/erro, homologação integrada e pós-confirmação. Aplicação depende da migration `0309` antes do uso.
- **Busca de posição:** formulário busca Áreas e Locais no servidor, reinicia seleção dependente quando a busca ou Área muda e distingue lista vazia de erro; opções antigas são ocultadas em erro. 50 testes focados passaram, 3 testes condicionais de fuso foram pulados, e typecheck passou. Paginação, erro, acessibilidade e homologação em navegador continuam pendentes.
- **Paginação e erro de posição:** testes de interface cobrem selecionar Área da segunda página e falha/recuperação sem enviar dados incompletos; 52 testes focados passaram e 3 condicionais de fuso foram pulados no fuso padrão. Em `America/New_York`, 27 testes passaram; em `Australia/Lord_Howe`, teste de repetição de 30 minutos passou. Cenários de fuso não aplicáveis foram pulados em cada execução. Homologação integrada e acessibilidade em navegador permanecem pendentes.
- **Elegibilidade de OS:** ADR-0073 e migrations locais `0297`–`0298` recusam OS legada `finalizado` ou `cancelado` na seleção e associação e conferem OS vigentes sob lock ao confirmar Visita. Retry preserva resultado anterior; nenhum histórico ou código é alterado. E01-S167, concorrência de encerramento e revalidação no envio continuam gates.
- **Interface parcial:** Cliente 360 → Operação → Mais → Visitas oferece criação inicial de rascunho, listagem por período, detalhe e histórico paginados de OS/equipe, associação de OS, inclusão e encerramento de pessoa, atribuição de responsável em rascunho ou Visita planejada, conferência informativa, registro de ciência, planejamento e confirmação PCM mediante escolha explícita. Seletores consultam páginas por Cliente e mostram aviso de que disponibilidade não é verificada. Criação inicial não informa contrato, posição ou responsável; responsável pode ser definido posteriormente, preservando os demais dados. Formulários identificam o fuso do dispositivo e mantêm campos após erro de validação. Falhas incertas preservam pedido para repetir; criação usa chave de sessão por usuário/Cliente, e revogação de permissão não apaga pedido incerto. Conflitos de índices de vínculo identificados liberam correção; conflito genérico de requestId continua pendente. Troca de usuário/Cliente desmonta contexto anterior, consultas usam sinal de cancelamento quando disponível, ausência de permissão não carrega dados e falhas permitem nova tentativa. Não possui edição geral, desvinculação de OS, histórico geral de alterações ou agenda global; validar foco, responsividade, fuso e integração real antes de PASS. Reaproveita componentes e cores do sistema existente; não dispara Auvo.
- **Evidência parcial:** 169 testes pgTAP no banco local cobrem listagem e detalhe por Cliente, cursor com mesmo horário, conferência de ciência, planejamento, confirmação PCM, edição, equipe e associação, retry, revogação, histórico e ausência de alteração da agenda ou intenção Auvo. Dezenove testes de aplicação/adapter e typecheck passaram; testes de adapter usam double e não substituem integração. `supabase/manual-tests/E01-S171_ciencia_concorrencia.sql` passou 16 verificações em duas sessões para política do Cliente: configuração antes/depois da confirmação e revogação enquanto confirmação aguarda. Fixtures sintéticas explícitas foram removidas; operações disputadas revertidas, exceto configuração usada como fixture, também removida. Ainda não comprova demais escopos nem integração de envio. Cinco testes de domínio de ciência e 23 testes de calendário/preventivas passaram anteriormente. Migrations aplicadas somente no banco local, porta 55322.
- **Evidência adicional:** 179 testes pgTAP S171 e 21 testes de aplicação/adapter passaram após `0295`; typecheck passou. Leituras de nomes refletem cadastro atual, não snapshot histórico.
- **Evidência de interface:** 34 testes focados de aplicação/adapter/interface passaram, incluindo criação, confirmação explícita, ciência completa, preservação de formulário, retry com mesmo pedido e retenção após revogação; typecheck passou. Em execução posterior, 11 testes da interface passaram incluindo bloqueio de pedido corrompido. Quatro testes existentes de Cliente 360 passaram anteriormente. Os testes usam doubles e não substituem teste de integração/browser. Interface ainda não foi homologada.
- **Evidência dos seletores:** 188 testes pgTAP S171 e 37 testes web focados passaram com a `0296`; typecheck passou. Aplicação da migration somente no banco local. Compatibilidade integral com E01-S167 permanece pendente.
- **Evidência adicional de elegibilidade:** 194 testes pgTAP S171 passaram com `0298`, incluindo OS finalizada/cancelada, retry após encerramento e recusa de confirmação quando OS vinculada encerra. Testes transacionais em duas sessões e integração com estados canônicos continuam pendentes.
- **Evidência de composição na interface:** 40 testes web focados e typecheck passaram, incluindo associação com retry, inclusão de pessoa e diferenciação entre conflito de vínculo conhecido e conflito de requestId. São testes com doubles, não homologação integrada.
- **Responsável na interface:** 41 testes web focados e typecheck passaram, incluindo seleção de integrante já vinculado, preservação dos dados da Visita e repetição do mesmo pedido após falha incerta. Seleção isolada não substitui edição geral ou homologação integrada.
- **Encerramento na interface:** rascunhos e Visitas planejadas permitem selecionar participação vigente por páginas, informar motivo e encerrar preservando histórico no servidor; falha incerta permite repetir o mesmo pedido. 42 testes web focados passaram. Alteração após confirmação continua pendente.
- **Histórico de composição:** interface permite alternar entre vínculos vigentes e histórico paginado de OS/equipe, identifica encerramentos e mostra motivo; informa que nomes e títulos são atuais, não snapshots. 43 testes web focados passaram. Histórico geral de alterações, autoria e homologação integrada continuam pendentes.
- **Desvinculação de OS:** ADR-0074 e migration local `0299` encerram vínculo com motivo, autoria, revisão, auditoria e retry sem excluir OS ou histórico; recusam alteração de Visita confirmada e reavaliam autorização. Adapter e interface permitem selecionar vínculo vigente paginado e informar motivo; falha incerta preserva o pedido. 208 testes pgTAP S171 e 45 testes web focados passaram; typecheck passou. Concorrência em duas sessões, revisão adversarial e integração com envio continuam pendentes. Não houve alteração de agenda ou envio Auvo.
- **Concorrência OS e confirmação:** `supabase/manual-tests/E01-S171_ciencia_concorrencia.sql` passou 29 verificações em duas sessões: bloqueio em ambas as ordens entre confirmação e alteração de status da OS com rollback; fechamento confirmado enquanto confirmação aguarda é reavaliado e impede confirmar com `os_nao_elegivel`. Fixtures, auditoria e outbox dos IDs sintéticos foram conferidos ausentes. Ainda faltam commit da confirmação antes do fechamento, desvinculação e demais conflitos; não substitui gate integrado.
- **Retry concorrente de desvinculação:** o mesmo teste passou 35 verificações após acrescentar duas sessões com mesmo pedido: retry aguarda commit e retorna a mesma revisão, com um comando e um evento de auditoria. Fixtures, comando, auditoria e outbox sintéticos foram removidos e conferidos. Não cobre disputa entre desvinculação e confirmação nem substitui revisão adversarial.
- **Programação na interface:** rascunhos e Visitas planejadas permitem editar início, fim e deslocamento, preservando posição, responsável e fuso da Visita; horários editados usam o fuso do dispositivo, indicado na tela, e horários não alterados mantêm precisão original. Falha incerta preserva pedido. Ações abertas ficam bloqueadas com aviso se a revisão observada mudar; o servidor ainda valida revisão no envio. 47 testes web focados passaram; testar fusos/DST no navegador e edição de posição continuam pendentes.
- **Fuso na interface:** horários locais inexistentes e repetidos na transição são recusados antes de pedidos de criação, edição e registro de ciência; horários já salvos e não editados são preservados. Passaram 23 testes sob `America/New_York` e teste da repetição de 30 minutos sob `Australia/Lord_Howe`. Ainda é necessária homologação de fusos no navegador e opção explícita para escolher um dos instantes repetidos, caso seja necessária.

## 2026-10-27 — E01-S166 prévia contratual isolada (Codex)

- **Tolerância isolada:** avaliação pura usa vencimento original e limites inclusivos independentes antes/depois, padrão zero e datas civis validadas. 31 testes focados de calendário e aplicação passaram. Ainda não está integrada à persistência, geração ou interface e não conclui AC-7.
- **Compatibilidade de Ocorrências:** ADR-0075 registra evolução faseada da tabela referenciada por OS, avaliações e achados, com isolamento por origem e Cliente, identidade estável de ciclo, preservação do legado e gates para leitores/RLS antes de liberar geração. Nenhuma migration foi aplicada; integração e mapeamento detalhado dos consumidores ainda são necessários.
- **Inventário inicial de compatibilidade:** [mapa de consumidores](planejamento/plano-manutencao/mapa-compatibilidade-ocorrencias.md) identifica filtros legados, três políticas PCM amplas confirmadas no banco local, índice de OS única por Ocorrência e funções privilegiadas que dependem de `plano_id` legado. É levantamento parcial, não liberação de escrita ou homologação; faltam consumidores externos e testes de isolamento/correlação.
- **Identificação faseada:** ADR-0080 e migration `0304` adicionam `origem = legado` às Ocorrências existentes, com check que impede qualquer origem nova nesta fase. Migration aplicada diretamente apenas no banco local; 23 testes pgTAP legados passaram, inclusive materialização e bloqueio da nova origem. Avaliar lock e compatibilidade do ambiente alvo e aplicar pelo fluxo normal de migrations antes de rollout; leitores, RLS e integração da origem nova permanecem pendentes.
- **Leitores legados separados:** consultas de Preventivas e histórico do Sistema filtram explicitamente `origem = legado`; 25 testes focados de adapter/interface e typecheck passaram. A migration `0304` precisa anteceder este código em qualquer ambiente. Filtros não substituem RLS por Cliente, adaptação das Edge Functions nem leitura da origem nova; não libera geração.
- **RLS legada por origem:** ADR-0081 e migration `0305` restringem as políticas antigas de Ocorrências, avaliações e achados à origem legada, sem alterar o acesso amplo ao legado; service role não é limitado por RLS. Aplicada diretamente apenas no banco local. 31 testes pgTAP passaram, incluindo origem nova simulada em transação revertida, preservação de avaliação/achado legados, leitor PCM e superadmin. Testar permissões efetivas no alvo, custos dos joins, funções privilegiadas e política nova por Cliente antes de liberar escrita ou rollout.
- **Guarda de resultados legados:** ADR-0082 e migration `0306` protegem escritas de avaliações e atualização de resultado consolidado contra origem não legada, inclusive por service role; importação mista falha integralmente. 34 testes pgTAP passaram com origem nova simulada em transação revertida; migration aplicada diretamente apenas no banco local. Triggers são proteção faseada e precisarão evoluir com os caminhos novos; não cobrem reserva/envio remoto, achados ou toda a integração privilegiada. Testar locks, desempenho e concorrência antes de rollout.
- **Guarda de achados e reclassificação:** ADR-0083 e migration local `0307` protegem gravações de achados por origem e verificam origem anterior e nova também na edição de avaliações, evitando mudar vínculo para contornar a guarda. 39 testes pgTAP passaram, incluindo service role e preservação do legado. Apenas banco local; testar conflitos de locks e revisar Edge Functions antes de habilitar origem nova.
- **Entradas privilegiadas legadas:** confirmação preventiva e envio de achado ao backlog recusam origem diferente de `legado` antes dos respectivos efeitos; reserva e atualizações da confirmação também filtram origem. O retry de backlog confere origem antes de retornar OS existente. Oito testes unitários da lógica compartilhada e `deno check` das duas funções passaram; ainda faltam testes de handler com doubles, concorrência e autorização atual por Cliente. Exigem migration `0304` implantada antes das funções; nenhuma chamada Auvo real ou deploy foi realizado.
- **Evento antigo e origem:** ADR-0084 e migration local `0308` conferem origem sob lock antes de atualizar ou retornar resultado preventivo legado; impedem que evento antigo leia resultado de origem incompatível. 40 testes pgTAP passaram, preservando o comportamento monotônico legado. Migration aplicada diretamente apenas ao banco local; concorrência, custo de lock e autorização das rotas externas continuam pendentes.
- **Cálculo de ciclos no banco:** ADR-0076 e migration local `0300` adicionam função interna pura por âncora/intervalo/unidade/índice, sem materializar dados ou alterar a função legada. 14 testes pgTAP passaram, incluindo bissextos, limites e ausência de acesso direto. O teste legado passou 20 verificações, incluindo comparação efetiva de ciclos semanais e mensais de fim de mês. Comparação abrangente com TypeScript, integração transacional e demais frequências seguem pendentes.
- **Convergência TypeScript/banco:** teste opt-in `calendario-servidor.integration.test.ts` compara 78 ciclos reais entre projeção da interface e função local do servidor: dias, semanas, meses, trimestre, anos, fim de mês e ano 2100. Passaram 21 testes de calendário e typecheck. São amostras, não prova exaustiva nem geração de Ocorrências; execução requer `SSO_TESTE_BANCO_LOCAL=1` e o contêiner local do projeto.
- **Prévia de ciclos aprovados:** ADR-0077 e migration local `0301` consultam snapshot de Rotina por calendário, vigência e tolerâncias, com autorização de gestor e janela limitada, sem gravar nem gerar Ocorrências. 143 testes pgTAP S165 passaram, incluindo versão rascunho, ausência de Rotina, janela excessiva, acesso negado e datas de snapshot infinitas ou malformadas. A função local foi reaplicada após ajuste da migration ainda não publicada. Faltam paginação/integração de interface, feriados e perfis de leitura antes de uso; prévia não é confirmação de geração.
- **Prévia na interface:** Plano aprovado permite consultar período da Rotina por calendário com tolerâncias congeladas, distinção entre vazio/erro e cancelamento de consulta; aviso informa ausência de feriados, cancelamentos e geração. Adapter e interface passaram 24 testes focados e typecheck. Testes integrados de navegador/permissão, paginação e homologação permanecem pendentes.
- **Janela de tolerância:** a prévia exibe limites inclusivos calculados a partir do vencimento original e das tolerâncias congeladas; valor fora da faixa de datas é informado como indisponível. 27 testes focados e typecheck passaram. É uma indicação local, não decisão de pontualidade, validação legal ou geração de Ocorrência.
- **Atualização da prévia:** resultados anteriores são ocultados enquanto a consulta é revalidada e após falha, inclusive recusa de autorização; 28 testes focados passaram. O controle de acesso continua no servidor, e a atualização de acesso do contexto geral ainda precisa homologação integrada.
- **Invalidação integrada:** prévias de ciclos e comparação usam a mesma raiz de cache do Plano; alterações/revalidação acionam nova consulta e ocultam dados antigos se autorização falhar. 47 testes web focados e typecheck passaram. Revogação em outra sessão sem evento de atualização ainda depende de revalidação de acesso e homologação integrada.

- **Parcial, não aprovada:** T001 concluída após revalidar referências e dependências; ADR-0052 registra prévias puras separadas das preventivas legadas. A prévia de Visitas respeita dia/intervalo/vigência, suprime feriado contratual sem reposição e preserva Visitas confirmadas, reprogramadas, exceções aprovadas e extras recebidos. Comparação preliminar de mudança de dia descreve propostas futuras antes/depois e sinaliza explicitamente impactos operacionais não calculados; não aplica mudança nem consulta Visitas reais. A prévia por calendário mantém vencimento em feriado e calcula ciclos ancorados em dias, semanas, meses e anos; janela padrão inclui o 30º dia. ADR-0053 a 0057 e migrations locais `0276`–`0281` criam séries e versões de regra vinculadas ao Cliente e contrato comercial, com RLS, fuso validado, identidade protegida e exclusão de vigências sobrepostas. Comando inicial grava série, regra, auditoria e resultado idempotente numa transação; operação contextual verifica Cliente do contrato no servidor. Cliente 360 → Preventivas lista regras e cadastra regra inicial, com seleção mínima de contratos sem valores e recuperação por sessão; troca de Cliente ou usuário recria contexto. Escrita direta não foi liberada, não gera Visitas ou Ocorrências.
- **Próximos passos:** completar AC-2 e AC-3 com comandos auditados e prévia de impacto efetiva; testes reais de interface/acessibilidade e concorrência, exceções, E01-S171 e geração por Visita ainda não existem. Avaliar localização de `btree_gist` e bloqueio da constraint no contrato antes de rollout. Validar convergência do cálculo por calendário com o legado antes de integrar, implementar tolerâncias e geração idempotente sem afetar âncora ou dados legados. Não marcar T002–T016 concluídas com base nesta fundação.
- **Evidência parcial:** 38 testes pgTAP S166, 135 testes pgTAP S165 anteriormente, 41 testes web de domínio, comandos, adapter, interface e regressão legada passaram; typecheck passou. Migrations aplicadas apenas no banco local, porta 55322. Dois testes pgTAP executados em paralelo disputaram criação da extensão; execução sequencial passou. Nenhum acionamento externo.

## 2026-10-27 — E01-S165 fundação isolada (Codex)

- **Questionário aprovado:** ADR-0078 e migration local `0302` oferecem consulta mínima ao gestor a partir do snapshot congelado, sem payload bruto Auvo; ausência explícita e snapshot inconsistente são distinguidos. Adapter tipado valida versão/Rotina e preserva estrutura das perguntas sem interpretação. 149 testes pgTAP S165 e 27 testes focados de adapter/interface passaram; typecheck passou. Uso por técnicos, paginação/limites de conteúdo, interface e execução continuam pendentes; não comprova integração Auvo.
- **Integridade de questionário:** a consulta rejeita objeto congelado sem identidade, inclusive quando a referência também é nula; 150 testes pgTAP S165 passaram. O formato de perguntas recebido como JSON ainda requer contrato para apresentação fiel e execução. Migration `0302` não publicada foi ajustada e reaplicada somente no banco local.
- **Retry de revisão:** submissão/devolução/aprovação mantêm pedido incerto quando a permissão é revogada e só removem o pedido correspondente; teste reproduz falha de rede, recusa de permissão e repetição com mesma identidade. 25 testes focados e typecheck passaram. Auditoria de outros fluxos de Plano/Rotina e integração de autorização continuam pendentes.
- **Início de nova versão:** interface conecta comando existente para Plano aprovado, exige confirmação explícita e preserva o mesmo pedido após falha; explica que a nova versão não pode ser aprovada sem conferência completa. Ações de revisão abertas bloqueiam confirmação se a revisão do Plano mudar e exigem nova conferência. 31 testes focados e typecheck passaram. Impactos reais, aprovação de versões posteriores e homologação integrada ainda estão pendentes.
- **Comparação de revisão:** interface e adapter conectam a comparação paginada de conteúdo entre snapshot e rascunho, ocultam resultados de revisão divergente e informam que impactos em Ocorrências/OS não foram calculados. 34 testes focados e typecheck passaram. A comparação não substitui prévia operacional nem desbloqueia aprovação.
- **Retirada de Rotina do rascunho:** ADR-0079 e migration local `0303` permitem retirada com motivo, autorização, revisão, retry e auditoria da imagem integral; linha aprovada e snapshot permanecem. A linha do rascunho é removida, com recuperação manual possível pela auditoria, não automática. Adapter e interface exigem confirmação, bloqueiam revisão paralela e recuperam pedido incerto após reabrir a tela. 160 testes pgTAP S165 e 45 testes web focados passaram; typecheck passou. Concorrência e revisão adversarial seguem pendentes; testes usaram transação revertida e não removeram dados reais.
- **Proteção adicional da retirada:** antes de criar pedido, a interface verifica operações pendentes de criação/edição de Rotina e revisão do mesmo Plano na sessão, preservando inclusive pedidos ilegíveis. 50 testes web focados e typecheck passaram; a proteção é local à sessão e não substitui concorrência no servidor nem homologação integrada.
- **Proteção do salvamento de Rotina:** criação e edição também recusam iniciar enquanto existe pedido pendente de Rotina ou revisão do mesmo Plano na sessão; resposta anterior não apaga pedido diferente. 54 testes web focados e typecheck passaram. Proteção entre abas e integração de outras ações de Plano ainda precisam ser verificadas.
- **Proteção adicional de pedidos do Plano:** criação/edição do Plano e transição de revisão não sobrescrevem pedido pendente surgido após abertura do formulário; resposta anterior de salvamento só remove seu próprio pedido. 56 testes web focados e typecheck passaram. A proteção é por sessão, não substitui validação concorrente no servidor.
- **Retry concorrente da retirada:** `supabase/manual-tests/E01-S165_retirada_concorrencia.sql` passou 9 verificações em duas sessões: o retry espera o primeiro commit, retorna a mesma revisão e não duplica comando ou auditoria. Não gera outbox para os IDs testados. Fixtures sintéticas, auditoria e comandos foram removidos e conferidos ausentes no banco local. Disputa com edição/revisão e revisão adversarial continuam pendentes.
- **Disputa edição/retirada:** o mesmo teste ampliado passou 20 verificações em duas sessões. Em ambas as ordens, a operação concorrente aguarda e, após o commit, rejeita revisão obsoleta sem sobrescrever a vencedora. O retry posterior também aguarda bloqueio sintético do request e retorna resultado original. Fixtures e registros sintéticos foram removidos e conferidos ausentes. Disputa com transição de revisão e revisão adversarial seguem pendentes.
- **Disputa retirada/submissão:** o teste ampliado passou 32 verificações. Nas duas ordens, retirada e envio para revisão aguardam o Plano bloqueado e recusam revisão obsoleta após o commit; o rascunho ou a Rotina permanecem conforme a operação vencedora. Fixtures e registros sintéticos foram removidos e conferidos ausentes. A aprovação, revogação concorrente de permissão e revisão adversarial continuam pendentes.

- **Parcial, não aprovada:** ADR-0039 a 0051 e migrations locais `0260`–`0275` criam rascunho de Plano, versão inicial e inclusão/edição de Rotinas com alvo tipado único, autorização `plano.gerir` individual, revisão, retry e auditoria. A `0269` acrescenta submissão/devolução de revisão no servidor; a `0270` oferece conferência paginada informativa; `0271` aprova transacionalmente após revalidação e bloqueio das referências, congela Plano/Rotinas/nomes de alvo/conteúdo de questionário e registra vigência, responsável, auditoria e retry. Tempo pendente resulta em aviso, não capacidade validada. `0272` protege snapshot e identidade de versão aprovada contra alteração/exclusão privilegiada; fechamento futuro da vigência permanece possível. `0273` lê Rotinas aprovadas do snapshot e falha se ele estiver ausente; a interface identifica dados históricos. `0274` cria rascunho de nova versão a partir do snapshot, somente para Plano aprovado ainda não ativo, preservando identidade lógica e histórico; `0275` compara conteúdo por Rotina, mas declara expressamente que impactos em Ocorrências/OS não foram calculados. Segunda aprovação está bloqueada até implementar vigências não sobrepostas e prévia completa de impacto; revisão não está na interface. Ainda não há contrato de leitura do questionário completo para execução; disputa entre sessões e revisão adversarial ainda precisam teste. Nenhum legado foi convertido; comandos não criam Ocorrência, OS nem outbox. Leitura desta fundação é limitada ao gestor; demais perfis e política de leitura precisam solução antes da entrega.
- **Próximos passos:** integrar visão global; implementar versões posteriores, leitura do questionário congelado para execução, concorrência e testes completos. Cliente 360 → Preventivas oferece listagem/criação/edição do nome de Plano, criação/listagem/edição de Rotinas e ações confirmadas de submissão, devolução e aprovação por gestor; operações incertas são recuperadas por sessão. Aprovação exige vigência e mostra avisos; recusa mostra pendências por ID de Rotina. A interface impede revisão durante edição aberta e confere operações de Rotina pendentes da mesma sessão antes de enviar; outras sessões continuam dependentes de revisão e bloqueio no servidor. Verificar foco/acessibilidade antes de PASS. A lista apresenta instrução, questionário, data-base, tolerâncias e pendências conhecidas; rascunho usa nomes atuais e versão aprovada usa nomes congelados. Cálculo de capacidade ainda não existe. Cache é isolado por usuário/Cliente e invalidado após sucesso. Resultados idempotentes antigos não comprovam referência de tempo; consultar dados atuais. Regras locais de prévia não aprovam nem substituem validação do servidor. E01-S170/S176 seguem não homologadas; fixtures não comprovam integração. `T001` concluída; T002/T003 e todas as US estão parciais ou abertas.
- **Evidência:** 135 testes pgTAP S165, incluindo prévia de adição/retirada/alteração e mudança de questionário, revisão copiada do snapshot, bloqueio de segunda aprovação sem vigências seguras, aprovação, rejeição de Plano incompleto, autoaprovação autorizada, leitura histórica após mudança de fonte, proteção contra alteração, conferência, autorização/revogação, retry e ausência de efeitos externos. Quarenta testes web focados de domínio, comandos, consultas, adapter e workspace, além do typecheck, passaram anteriormente. Migrations aplicadas apenas no banco local, porta 55322.
- **Concorrência parcial:** `supabase/manual-tests/E01-S165_aprovacao_concorrencia.sql` passou 30 verificações em duas sessões: aprovação e alteração do Sistema nas duas ordens; desativação confirmada enquanto aprovação aguarda é revalidada e rejeitada; aprovação aguarda edição de questionário e congela a versão confirmada; retry simultâneo espera o primeiro pedido e executa após rollback; revogação confirmada durante espera por referência impede aprovação; alteração concorrente do Plano causa conflito de revisão. Teste usa banco local descartável, `psql` como `supabase_admin`, `dblink_connect_u` e supressão da integração. Após execução, conferidos ausência de fixture, auditoria e outbox dos IDs sintéticos. Falta testar comandos reais de edição/devolução, retry após commit e demais ordens de revogação; não é gate automatizado. Durante limpeza manual de uma execução interrompida foram geradas duas intenções locais sintéticas pendentes por falta da configuração de supressão; ambas foram identificadas e removidas, e o banco local foi conferido sem essas intenções.

## 2026-10-27 — E01-S176 em andamento (Codex)

- **Parcial, não aprovada:** ADR-0031 a 0038; migrations locais `0247`–`0259` reforçam hierarquia e posição, criam Grupo Quantitativo e capacidades explícitas, preservando cadastros e códigos existentes. `0251` registra alterações estruturais futuras; `0252`/`0253` consultam histórico com capacidade atual e isolamento de ambos os Clientes, ocultando eventos sem escopo comprovável. `0254` ordena derivação de Cliente e protege mudanças inversas; `0255` propaga Área para subárvore de Locais, Componentes e Sistemas na mesma transação. `0256`/`0257` criam revisão estrutural e comando de movimentação autorizado/idempotente, oferecido no detalhe com recuperação por sessão; as escritas legadas ainda não são obrigadas a usá-lo. `0258`/`0259` fornecem busca literal e seletores paginados por Cliente com capacidade atual. Avaliar volume, concorrência, permissões e efeitos da integração existentes antes de implantar. Grupo mantém identidade, quantidade, revisão e auditoria sem criar unidades ou tarefas Auvo. Histórico paginado disponível para grupos e no detalhe do Componente; após salvar grupo, lista e histórico são invalidados. Ainda faltam testes integrados de ambas as telas.
- **Próximos passos:** testar concorrência real entre alteração de vínculos e criação/atualização de grupo; completar serviços, histórico e demais AC da story, integrar capacidades aos cadastros existentes, conferir inventário legado e realizar revisão adversarial antes de PASS. Listagem, cadastro e edição inicial usam capacidade; formulário permite selecionar Sistema e editar características, preserva revisão, e mantém operação incerta na sessão para repetição. Conflito `40001` libera nova conferência; `22023`/`23514` devolvem dados ao formulário para correção. Sessão com pedido corrompido bloqueia novas escritas, exigindo suporte; tratar recuperação e outros erros antes da entrega. A autorização dos cadastros antigos não foi substituída pela nova capacidade. T001 concluída; demais tarefas não estão concluídas.
- **Evidência parcial:** 53 testes pgTAP de estrutura/comando/seletores e 27 de grupos/histórico passaram após `0259`; testes web focados e typecheck passaram. Foram verificados ainda 28 testes legados de posição/hierarquia, antes das últimas migrations; teste de posição suprime enqueue por se limitar à localização. Migrações aplicadas somente no banco local (porta 55322); nenhuma operação real no Auvo.
- **Concorrência:** `supabase/manual-tests/E01-S176_grupos_concorrencia.sql` passou 9 verificações em duas sessões antes da `0251`: criação de grupo versus mudança do Local nas duas ordens e tentativa concorrente de ciclo na hierarquia. Requer `psql` local como `supabase_admin`, usa `dblink_connect_u` sem senha e não integra `supabase test db`. Após `0251`, executar somente em banco descartável: eventos sintéticos de auditoria são append-only. Se interrompido antes da limpeza, verificar IDs `17620000-...`. Ainda faltam disputas por Área, Sistema e comandos idempotentes, além de gate automatizado.
- **Repetição concorrente:** `supabase/manual-tests/E01-S176_comando_concorrencia.sql` passou 6 verificações com duas sessões para o mesmo `requestId`, bloqueio e rollback da primeira antes de executar a segunda. Ambas as transações foram revertidas; conferidos ausência de fixture, evento e comando. Não prova ainda o cenário em que a primeira transação confirma; executar esse caso em banco descartável para não deixar auditoria sintética.

## 2026-10-26 — E01-S170 iniciada em paralelo lógico (Codex)

- **Em andamento:** `specs/E01-S170-governanca-plano/`. ADR-0029 registra perfis acumuláveis complementares aos grupos legados; ADR-0030 permite módulos elegíveis alternativos por ação. `0239`–`0246` foram aplicadas somente no banco local: catálogo, perfis, vínculos, concessões, consultas administrativas paginadas e comandos transacionais com revisão, retry, motivo e auditoria. `plano.gerir` exige concessão individual, inclusive para superadmin.
- **Próximo passo:** integrar as capacidades às ações efetivas das demais stories; cobrir concorrência, rollback e navegação E2E e realizar revisão adversarial. A aba Configurações → Capacidades permite criar perfis, vincular usuários e gerir concessões; consultas são paginadas, e a concessão global pede confirmação. As ações de gestão/validação ainda não consomem essas capacidades: não declarar AC concluído. T001 concluída; demais tasks abertas ou parciais.
- **Verificação parcial:** 63 testes pgTAP em três suítes; testes web focados passaram para domínio, comandos, adapter, repetição e interface (incluindo edição de perfil). Typecheck web e Biome dos arquivos tocados passaram. Ainda faltam testes integrados em serviços/fluxos reais e revisão adversarial. E01-S184 continua em andamento abaixo.

## 2026-10-26 — E01-S184 iniciada (Codex)

- **Em andamento:** `specs/E01-S184-protecao-custos-portal/`. O usuário autorizou seguir com o item de checklist relativo a testes/revisão ainda aberto. O PDF usa formatador público e as views de proposta/orçamento recebem projeção parcial, com vínculo atual do usuário e bloqueio de leitura direta de orçamento para Cliente. **Não considerar a exposição inteiramente resolvida nem publicar esta alteração isoladamente:** ainda falta auditar todos os caminhos, autorização interna, documentos/anexos, cache e revisão adversarial.
- **Próxima ação:** fechar acesso intermediado a comprovantes para impedir emissão/uso de URLs assinadas sem checagem atual e definir remediação auditada de artefatos antigos; avaliar ações comerciais sem custos, cobrir US2/US3 e executar revisão adversarial. T001 concluída; demais tasks abertas ou parciais. Leituras/escritas de composição privada são restritas a administrador ativo, com consulta sem custos para colaborador. Decisões do Portal e exceção de preço usam endpoints novos com vínculo atual; RPCs legadas foram revogadas. O PDF do Comercial também usa formatação pública.
- **Base do acesso intermediado:** ADR-0086 e migration local `0310` acrescentam consulta de caminho apenas por lançamento vinculado e objeto existente no bucket privado, exigindo permissão financeira atual e erro uniforme. 17 testes pgTAP passaram, incluindo Cliente negado e revogação com token antigo; aplicação direta somente no banco local. A consulta ainda não serve arquivos nem bloqueia links assinados: faltam rota intermediada, migração coordenada do cliente e Storage, escopo por Cliente, corrida de revogação e remediação de links existentes. Não considerar AC-6 concluído.
- **Rota intermediada aditiva:** ADR-0087 e `supabase/functions/financeiro-comprovante-seguro/` verificam autenticação, limite compartilhado por usuário, lançamento autorizado antes e depois do download, e entregam bytes como anexo sem URL, cache ou tipo ativo. Cinco testes Deno com doubles e `deno check` passaram. Ainda não está ligada à aplicação nem testada com Auth/Storage reais; o acesso direto e URLs assinadas existentes continuam possíveis. Não implantar isoladamente nem declarar AC-6 concluído; gates detalhados em impedimentos.
- **Tela conectada à rota:** download financeiro envia ID do lançamento para a Edge Function, valida resposta como arquivo e não recorre ao Storage direto quando há erro. Passaram 162 testes financeiros, 5 testes Deno da rota com doubles, 17 pgTAP e typecheck. Falta teste integrado com Auth/Storage e navegador, incluindo abertura/download de arquivo genérico; migration e Edge Function devem anteceder novo cliente no rollout. Políticas atuais ainda permitem emissão de URLs assinadas, e URLs antigas não foram revogadas: AC-6 continua aberto.
- **Integração parcial da rota:** 2 testes Deno executam o handler contra a RPC real no banco local, com fixtures revertidas; Auth, limite e conteúdo do Storage são simulados. Segunda consulta sem concessão recusa entrega, mas não demonstra corrida real. Auth/Storage/navegador reais seguem pendentes. Não iniciar/resetar a pilha sobre o banco compartilhado sem reconciliar o histórico do CLI: `0304`–`0310` foram aplicadas manualmente e não constam nesse histórico.
- **Pilha isolada e bloqueio direto:** ADR-0088 e migration `0311` bloqueiam leitura/assinatura direta por usuário autenticado no bucket privado, preservando os outros buckets. Teste HTTP com Auth, PostgREST, Storage, Edge Runtime e SDK reais passou em ambiente isolado: download autorizado, upload por financeiro, bloqueio de nova assinatura e recusa após revogação. Um link sintético emitido antes da revogação continuou funcionando, comprovando gate de remediação. 17 pgTAP passaram; `0311` foi aplicada diretamente nos dois bancos locais. Ainda faltam teste da tela em navegador, revisão adversarial, escopo por Cliente e rollout coordenado; não declarar AC-6 completo.
- **Banco local:** `supabase/config.toml` usa portas 55320–55327 para coexistir com outro projeto; Supabase iniciado somente com banco via Colima. Usar `DOCKER_CONFIG=/tmp/sinergica-codex-docker-no-config` e `DOCKER_HOST=unix:///Users/lucasazevedo/.colima/default/docker.sock` nos comandos locais. `0230`–`0238` aplicadas apenas nesse banco local; correções aditivas preservam as migrations já aplicadas.
- **Verificação:** 87 testes pgTAP em cinco suítes mais 10 testes pgTAP de comprovantes, 9 testes de formatação, 2 testes da consulta comercial e 2 testes de download autenticado passaram. O Storage testa autorização atual para emitir nova leitura; **não** revoga URLs assinadas já emitidas. Testes usam transação revertida; Vault local sem segredos, sem envio real ao Auvo. O formatter não altera snapshots privados. Impedimentos e gates são acompanhados em [registro próprio](planejamento/plano-manutencao/impedimentos-desenvolvimento.md).

## 2026-10-26 — Programa SSO especificado para Terra (Codex)

- **Branch documental:** `codex/handoff-plano-manutencao`; alterações locais preservadas. Sem commit/push/PR, implementação, migration aplicada, deploy, cobrança ou tarefa real Auvo nesta entrega.
- **Ponto de entrada vigente:** [Programa SSO para Terra](planejamento/plano-manutencao/programa-sso-terra.md), [matriz](planejamento/plano-manutencao/matriz-rastreabilidade.md) e [guia](planejamento/plano-manutencao/guia-execucao-terra.md).
- **Fontes:** Caderno_Tecnico_Implementacao_SSO_v1.docx na raiz e [respostas posteriores do Fabrício](planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md). P01/P02/P03 e as quatro perguntas subsequentes encerradas; não reenviar dúvidas já respondidas.
- **Entrega:** 22 stories E01-S165–S186, owner Terra, 136 AC e 377 tarefas abertas. S165–170 foram revisadas mantendo IDs; S171–186 novas. Cada pasta contém spec/plan/tasks/research/modelo/contratos/quickstart/checklist; checklist de requisitos não declara implementação aprovada.
- **Próxima ação concreta na futura implementação:** ler E01-S184-protecao-custos-portal, criar teste que reproduza exposição de custos em resposta/PDF e proteger fonte/artefatos; E01-S170 funda capacidades por ação. Seguir dependências, não iniciar todas as stories de uma vez. `.specify/feature.json` local aponta S184.
- **Decisões:** Plano amplo e alvo único da Rotina; modo por Visita suprime feriado, modo por calendário preserva obrigação/âncora; tolerâncias antes/depois com default zero; código protegido após uso e correção administrativa com alias; recepção/importação de levantamentos em staging aprovado, Copiloto completo fora da etapa atual.
- **Arquitetura:** propostas técnicas [ADR-0026](adr/0026-programa-sso-objetos-planejamento-execucao.md), [ADR-0027](adr/0027-orcamento-canonico-e-faturamento-operacional.md), [ADR-0028](adr/0028-identidade-alias-e-levantamentos-aprovados.md) substituem desenho parcial ADR-0025. Comercial.propostas/versões canônico; Financeiro recebe origem operacional única; preservar pcm.equipamentos e nomes Componentes/Sistemas.
- **Gates:** contratos reais Auvo, compatibilidade de cardinalidades/números legados e autorização/custos são verificações da implementação. Doubles até prova controlada; Fabrício libera teste real/piloto. Nenhuma dúvida funcional bloqueadora remanescente no pacote.
- **Validação:** [relatório documental](planejamento/plano-manutencao/validacao-documental.md). O eval legado seleciona E01 por diff de commits versus origin/main; estas pastas ainda locais não entram nessa seleção. Checar pacote explicitamente antes de concluir rastreabilidade. Código existente passou 67 testes focados na análise anterior; isso não homologa o novo programa.

O registro abaixo é histórico e antecede Caderno/respostas e specs atuais.

## 2026-10-24 — Handoff do Plano de Manutenção (Codex)

- **Branch de continuação:** `codex/handoff-plano-manutencao`, criada de `origin/main`
  no commit `22aca3918224bc45175e80c6ec88b957fdb604aa` (PR #70).
- **Pedido desta sessão:** Lucas pediu para subir todo o material ao Git e fornecer um prompt
  para continuar em outro computador. Esta entrega é documental: não implementa o novo módulo,
  não altera banco, não faz deploy e não envia tarefas reais ao Auvo.
- **Ponto de entrada:** [README do planejamento](planejamento/plano-manutencao/README.md).
  Ler depois [decisões consolidadas](planejamento/plano-manutencao/decisoes-consolidadas.md),
  os originais em `fontes/` e [prompt de continuação](planejamento/plano-manutencao/continuar.md).
- **Feature ativa:** preparação do Plano de Manutenção do Fabrício; ainda não existe story/spec
  executável criada para essa iniciativa. Não tratar o briefing como implementação concluída.
  `E01-S53` é a base existente de Preventivas, não a spec completa do novo fluxo.
- **Próxima ação concreta:** ler os documentos acima, confirmar somente as três pendências
  registradas e preparar a divisão em stories/specs via Spec Kit. Conferir o próximo ID e marcar
  owner no ROADMAP antes de codar; nunca carregar o ROADMAP inteiro.

### Decisões recentes

- O fluxo operacional definido pelo Fabrício prevalece sobre limitações do código atual.
  Lucas pediu preservar a nomenclatura de UI **Componentes e Sistemas**, cadastros e códigos.
- Novo fluxo para preventivas, corretivas, PMOC e chamados manuais: Plano → Versão → Rotina →
  Ocorrência → Chamado → uma ou várias OS → Visita → tarefa Auvo por OS → execução → validação PCM.
- Calendário contratual vem antes da geração: semana suprimida por feriado não gera Visita
  nem ocorrência correspondente, não conta nos indicadores operacionais e não tem reposição
  automática. Mudança do dia fixo tem vigência e preserva histórico/exceções aprovadas.
- Conclusão Auvo é conclusão em campo. PCM valida/encerra OS individualmente; Chamado recebe
  indicação de apto e depende de encerramento próprio após atendimento integral.
- Preventiva Não OK pode ser concluída, com necessidade corretiva vinculada. Continuação recebe
  somente escopo e esforço restantes; técnico sugere e PCM revisa.
- Confirmação PCM obrigatória; ciência do cliente configurável e não exigida por padrão.
  Terceiros têm horas separadas; capacidade interna inclui somente esforço Sinérgica.
- Despesas previstas/realizadas, comprovantes e vínculo Financeiro são geridos pelo SO.
- Requisitos detalhados e precedência das fontes estão nas decisões consolidadas.

### Pendências efetivas

1. Fabrício define quem poderá aprovar/suspender/encerrar planos e autorizar cancelamentos.
   Permissões serão configuráveis, sem nomes fixos no código.
2. Fabrício define se o planejador pode aprovar o próprio plano ou exige outra pessoa.
3. Confirmar com exemplo a sequência de rotinas mensais/trimestrais após feriado:
   próxima visita válida versus próxima oportunidade periódica, e preservação da âncora.
   A supressão da semana já está aprovada; não reabrir essa decisão.
- Os 25 tempos SPCI zerados do Rimini são **Tempo a validar**, não esforço zero. Não impedem
  documentar o rascunho, mas impedem declarar sua capacidade completa/validada.
- O gatilho real Auvo e seu contrato precisam ser reavaliados na futura implementação.
  Testes que criam tarefas reais exigem liberação operacional expressa do Fabrício.
- Credenciais locais e sessão autenticada não são transportadas pelo Git. Reconfigurar o ambiente
  no outro computador sem solicitar tokens/senhas nesta conversa ou versionar `.env`.

### Entregas anteriores preservadas

- PR #70 já integrada na main: identificador com sugestões e manual operacional/ajuda.
- [Levantamento funcional e apresentação](entregas/2026-10-14/README.md): Markdown, HTML offline
  com 109 capturas únicas e ZIP, agora versionados. Referência histórica em 14/10/2026;
  não equivalem à homologação do novo módulo nem ao estado vivo de produção.
- Histórico do STATE antigo preservado em
  [2026-09-29 a 2026-10-01](state-historico/2026-09-29-a-2026-10-01.md).
  Suas pendências de ambiente são históricas e não devem ser copiadas como estado atual.
