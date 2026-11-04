# ADR-1505 — Consulta de Visitas na fila preventiva

## Contexto
O painel de Preventivas consulta apenas o catálogo cronológico de ciclos por calendário. Ciclos canônicos de Visita têm identidade própria e não devem ser atribuídos à tabela de calendário ou presumidos distintos de obrigações externas por coincidência de data.

## Decisão
Disponibilizar, com a flag de fila de Visita e seu gate, seção própria no painel existente (que também requer a flag do painel de calendário) por Cliente e Plano. A consulta paginada no servidor usa data e identidade canônica, aplica os mesmos filtros de estado/período, exige `plano.gerir` e `visita.confirmar`, e retorna somente entradas da fila de Visita. A interface mantém as páginas, seleção e ação separadas das entradas de calendário; preserva consulta e contratos anteriores. Gestão usa o comando autenticado da ADR-1504. A lista representa registros da fila, não comprovação atual de ausência de OS ou execução.

## Limites
Seções separadas não garantem exclusividade entre calendário, Visita e fontes externas não reconciliadas; decisões de origem e continuidade são necessárias antes de liberar. Não habilitar gates, ativar operação, homologar ou publicar sem testar paginação, isolamento, concorrência e revisão adversarial. Nenhuma OS ou tarefa Auvo é criada.
