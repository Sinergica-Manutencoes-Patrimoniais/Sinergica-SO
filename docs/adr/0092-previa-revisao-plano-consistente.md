# ADR-0092 — Prévia revisionada de conteúdo do Plano

## Estado

Proposta para implementação local; não libera segunda aprovação, homologação ou deploy. Complementa ADR-0051 e ADR-0089. A prévia de impactos operacionais permanece pendente.

## Problema

O comparador existente identifica Rotinas adicionadas, retiradas, alteradas e inalteradas. Já as consultas individuais de Rotinas não devolvem a revisão do Plano. Buscar separadamente o conteúdo aprovado e o rascunho pode misturar revisões se houver edição concorrente, inclusive quando uma resposta antiga chega depois da nova. A interface não pode apresentar essa combinação como comparação atual. A paginação da prévia também precisa confirmar a revisão quando uma página está vazia.

## Decisão proposta

Adicionar uma RPC de leitura, distinta dos comandos de escrita, que recebe o Plano, `expectedRevision`, limite e cursor opaco ou chave estável por identidade lógica da Rotina. A autorização efetiva `plano.gerir` e o escopo do Cliente são validados no servidor em cada requisição. O Cliente e o ator são derivados da sessão e do Plano, não aceitos como prova do chamador.

Em cada chamada, ler Plano, versão aprovada de origem, rascunho e campos comparáveis sob o mesmo snapshot transacional. Se a revisão lida não coincidir com `expectedRevision`, recusar explicitamente como revisão obsoleta, sem retornar conteúdo. A origem é a versão aprovada usada como base da revisão, não uma escolha por UUID nem a versão presumidamente vigente. Se a origem não puder ser demonstrada com os dados persistidos, recusar a comparação; não inventar vínculo. A solução deve tratar histórico com múltiplas versões e vigências futuras, antes de remover qualquer bloqueio de aprovação.

O snapshot deve ser garantido pelo desenho executável da RPC, por exemplo uma única instrução de consulta ou semântica `STABLE` comprovada para todas as leituras relevantes; não presumir que comandos separados em `READ COMMITTED` compartilham snapshot. Nenhuma trava deve atravessar requisições de páginas. O teste integrado deve validar a semântica efetiva com as sessões reais, inclusive autorização e revisão.

O resultado é um envelope que sempre devolve `revision`, identidade das duas versões, itens e próximo cursor, inclusive com zero itens. Cada item identifica a Rotina lógica, classificação e campos anteriores e do rascunho estritamente necessários à comparação. As referências históricas e o questionário anterior vêm do snapshot aprovado; dados do rascunho vêm da versão correspondente. Não expor o snapshot inteiro, custos ou dados não necessários. A edição ou remoção de fonte externa não altera o conteúdo histórico.

O registro de comando que informa a origem pode ser alterado por acesso privilegiado. A consulta deve corroborar seu vínculo e responsável com o evento de auditoria append-only da criação e recusar divergência, ausência ou duplicidade. Isso não protege contra um operador com poderes para forjar simultaneamente comandos e eventos; tal ameaça exige revisão dos privilégios e auditoria. O conteúdo do questionário atual é mutável sem revisão do Plano: a consulta não o usa para comparar páginas. Quando não há outra alteração comparável e existe questionário, a classificação é `questionario_indeterminado`; o item informa explicitamente que seu conteúdo está pendente. O questionário histórico continua acessível pela leitura própria do snapshot, não por payload externo bruto na comparação.

Cada página valida novamente a revisão esperada; a interface descarta todas as páginas e fecha detalhes se houver conflito, erro de autorização, troca de usuário, Cliente, Plano, revisão ou versões. Resposta tardia de contexto anterior não pode restaurar conteúdo. Enquanto houver reconsulta ou falha, nenhum resultado anterior é apresentado como atual. A consulta não modifica dados, não cria Ocorrências, Chamados, OS ou tarefas e não gera intenção externa.

Essa comparação é exclusivamente de conteúdo. Deve informar que impactos em Ocorrências e OS **não foram calculados**. Não interpretar ausência de vínculos canônicos como ausência de impacto, nem permitir aprovação posterior com base nela. A prévia operacional de manter/alterar Ocorrências e identificar OS abertas exige contratos de origem e tratamento de histórico próprios, ainda não concluídos.

## Verificação antes de uso

- pgTAP para autorização atual permitida e negada, isolamento entre Clientes, campos históricos congelados, referências removidas e página vazia com envelope e revisão.
- Duas sessões: edição e mudança de revisão durante a leitura; cada resposta tem conteúdo coerente com a revisão declarada ou falha explícita. Entre páginas, edição deve invalidar a continuação, inclusive quando o cursor anterior leva a página vazia.
- Testes de interface para troca de contexto A–B–A, resposta atrasada, falha e retry, páginas parcialmente carregadas e remoção de seleção. Cobrir rascunho adicionado, alterado e retirado sem sugerir aprovação ou cálculo operacional.
- Conferir custo, tamanho do snapshot, limites de paginação e bloqueios com dados representativos; revisão adversarial para segurança e integridade. Não usar mocks como prova de isolamento ou atomicidade.

## Rollout e limites

Migration aditiva somente após coordenação da sequência e testes; não alterar migrations já aplicadas. Preservar contratos atuais durante transição e bloquear acesso à comparação detalhada até servidor e interface revisionados coexistirem. Planejar rollback sem reescrever histórico. ADR-0089, prévia operacional, geração e segunda aprovação continuam bloqueadas; esta decisão não altera regras operacionais do Fabrício.
