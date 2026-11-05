# Diagnóstico em lote — dependências dinâmicas do recorte

**Somente análise estática; não é manifesto de release.** Base `22aca391`, manifesto candidato
de 640 migrations com fonte `84c9fcf`. A sobreposição 0803 e as duas ações de catálogo usadas no
ensaio são diagnósticas; não substituem o fechamento do recorte ou as migrations originais.

Foram inspecionadas 121 migrations selecionadas que contêm `pg_get_functiondef`. A busca combinou
nomes de função, referências anteriores e trechos literais atribuídos às variáveis de substituição.
As cadeias abaixo são achados priorizados, não enumeração exaustiva: SQL dinâmico, identificadores
montados, variáveis, sobrecargas, formatação e substituições sucessivas escapam a esse método.
Encontrar uma migration anterior não prova que seu efeito seja exigido por uma guarda posterior.

## Dependências de texto evidenciadas

| Consumidora selecionada | Cadeia anterior omitida | Evidência e impacto |
| --- | --- | --- |
| `0903_E01-S168_origem_grupo_retorno.sql` | `0803_E01-S168_recebimento_origem_visita.sql` | A 0903 exige trecho inserido pela 0803 no classificador criado em 0402; sem ele lança `classificador_definicao_incompativel` (`55000`). A inclusão diagnóstica da 0803 permitiu avançar além de 0903. Altera classificação de retorno de Visita e ACL da função privada. |
| `0906_E01-S173_pendencia_origem_grupo.sql` | `0807_E01-S173_pendencia_origem_visita.sql` | A 0906 exige ramo e variável inseridos pela 0807 na função original da 0371; lança `pendencia_definicao_incompativel` (`55000`) quando faltam. O ensaio após 0803 parou em 0906 com 55000; o texto exato da exceção não foi preservado. A 0807 altera origem de pendências por Visita e revoga EXECUTE da função privada. |
| `1692_E01-S165_cobertura_visita_fotografia_os.sql` | `0805_E01-S168_guarda_cobertura_origem_visita.sql` → `0904_E01-S168_cobertura_retorno_grupo.sql` | A 0805 substitui trecho exato da função 0582; a 0904 transforma o `if` inserido pela 0805 em ramo `elsif`, que a guarda `guarda_fotografia_incompativel` da 1692 exige. As quatro migrations anteriores citadas têm funções de guarda/integração S168; 0582 e 1692 estão na seleção, 0805 e 0904 não. Incluir altera verificação de cobertura por Visita e Grupo, com revogação de EXECUTE. |
| `1692_E01-S165_cobertura_visita_fotografia_os.sql` | `0811_E01-S168_previa_cobertura_visita.sql` → `0905_E01-S168_perguntas_retorno_grupo.sql` | A 0811 substitui trecho exato da função 0562; a 0905 transforma seu `if` em `elsif`, exigido pela guarda `previa_fotografia_incompativel` da 1692. A 0562 está selecionada; 0811 e 0905 não. Incluir altera a prévia de cobertura por Visita e Grupo, com revogação de EXECUTE. |

As comparações textuais acima foram feitas nos arquivos da fonte. A função real após todas as
migrations anteriores selecionadas pode diferir; confirmar ordem e conteúdo com `pg_get_functiondef`
em banco descartável antes de decidir quaisquer inclusões. O ensaio diagnóstico inicial não chegou
à 1692; o ensaio integrado posterior está registrado abaixo.

## Omissões com risco comportamental, sem falha textual comprovada

- `1675_E01-S53_serializar_materializacao_legada.sql` está ausente antes da 1714 selecionada.
  Acrescenta `FOR UPDATE` à leitura do Plano legado em `pcm.materializar_ocorrencias_preventivas`.
  A 1714 altera outra âncora dessa função para respeitar reservas; a ausência da 1675 **não foi
  demonstrada como falha da guarda textual da 1714**, mas pode remover serialização de mudanças
  concorrentes. Revisar compatibilidade com os demais escritores e testar duas sessões.
- `1587_E01-S168_retorno_grupo_chamado.sql` e `1591_E01-S168_cobertura_grupo_chamado.sql`
  estão ausentes antes da 1692. Elas ampliam os critérios de classificador/prévia/guarda para
  Chamado canônico do mesmo ciclo de Grupo, usando `pcm.sso_chamado_ciclo_grupo` da 1586, que
  está selecionada. Não se demonstrou que os trechos alterados por 1587/1591 sejam exigidos pelas
  âncoras da 1692; sua ausência pode causar divergência funcional mesmo se a migration compilar.
  Revisar também `1588` e demais consumidores relacionados, sem inclusão automática em lote.
- Coincidências genéricas apontaram 1323 antes de 1695 (`declare v_actor ...`) e 1485 antes de
  1746 (mensagem `revisao_obsoleta`). Elas não demonstram dependência: os trechos não são únicos
  da função correspondente. Permanecem para inspeção contextual, sem recomendação de inclusão.

## Restrições para evolução do recorte

- A 0415 também depende das ações introduzidas por 0323 e 0334, ambas ausentes. Antecipar apenas
  seus valores foi um artifício de diagnóstico; as migrations originais incluem tabelas, policies
  e funções de S180/S172, com impactos de escopo e autorização que precisam de revisão.
- Não editar migrations históricas nem adicionar todas as ausentes indiscriminadamente. Para cada
  cadeia, revisar código, ACL, gates e funções/transações anteriores, registrar procedência e
  testar em ordem num clone descartável. Um teste com seeds artificiais continua não implantável.
- Os testes Auth/Storage/fotos executados sobre clone mais amplo não provam que esta seleção reduzida
  compila ou preserva RLS, concorrência, integridade e compatibilidade do legado. Não habilitar gates,
  implantar ou disparar Auvo com base neste diagnóstico.

## Ensaio do candidato de integração

O ensaio em banco descartável aplicou as **228 migrations da base e 656 candidatas**, incluindo
as migrations originais do manifesto de integração, sem antecipar ações por seeds sintéticas.
Os recursos criados para o ensaio foram removidos. Esse resultado demonstra aplicação das
migrations naquela composição; não demonstra fechamento de todas as dependências transitivas,
correção funcional, concorrência, RLS ou compatibilidade com dados e integrações existentes.

O candidato permanece separado do pacote de release. Gates de segurança continuam fechados;
homologação e deploy dependem de revisão e validações próprias. Não houve acionamento do Auvo.

Na validação integrada posterior, também sem seeds artificiais, foram aplicadas 228 migrations
da base e 656 candidatas. As quatro fixtures pgTAP passaram: S170, 12 verificações; S176, 10;
S165, 180; e S166, 7, totalizando **209 verificações**. A fila continha as seis entradas
produzidas pelos seeds oficiais de categorias e permaneceu integralmente igual após cada fixture.
Os recursos descartáveis do ensaio foram removidos.

A fixture S165 usa modo `replica` em cenários de adulteração: esses trechos não comprovam o
funcionamento das guardas desativadas nesse modo. O resultado também não comprova concorrência,
interface, permissões em produção ou prontidão para release. Gates e condições de homologação
permanecem como registrados acima.

Em outro ensaio isolado com 228 migrations da base e 656 candidatas, duas sessões distintas
validaram a revogação antes do comando de administração na S170 e a contenção genérica entre
criação de vínculo e alteração de Cliente na S176. O clone foi descartado, sem acionamento do
Auvo. O resultado não comprova as ordens inversas, replay ou o funcionamento de uma guarda
específica na contenção da S176.

Em ensaio posterior no mesmo recorte, fixtures sintéticas exercitaram as duas ordens de
contenção genérica da S170 e da S176. O replay da S170 foi negado após a revogação. O clone
descartável e os recursos do ensaio foram removidos; não houve acionamento do Auvo. Esses
cenários não identificam necessariamente a guarda responsável pela contenção nem demonstram
as demais disputas, interface, ACL de produção ou prontidão para release.

Em ensaio separado com a migration 1804, foram aplicadas 228 migrations da base e 657
candidatas. A fixture sintética passou nas verificações de gate, versão esperada, Cliente e
replay. A transação foi revertida e os recursos descartáveis removidos, sem acionamento do Auvo.
O setup usa `session_replication_role=replica`: não comprova as guardas desativadas durante essa
preparação. O ensaio não inclui concorrência real nem aprovação inicial via SQL e não constitui
homologação ou autorização para release.
