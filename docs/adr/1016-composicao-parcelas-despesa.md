# ADR-1016 — Composição de orçamento por parcelas de despesa

Status: preparação privada, não homologada.

Preparar caminho alternativo que recebe referências explícitas a parcelas do rateio vigente, seu grupo de custo e revisão; o servidor verifica Cliente, Visita, OS, lista, revisão e soma centavos da fonte, recusando repetição da mesma despesa/parcela entre grupos. A chamada ao comando canônico de composição e o registro imutável das fontes ocorrem na mesma transação. Custo e totais não são retornados no recibo. O fluxo não deduz categoria pela descrição e não substitui a composição legada até rollout coordenado.

Este recorte aceita somente parcelas já rateadas; outras origens de aquisição e despesas integrais precisam de contrato próprio. A classificação aquisição/operacional é declarada e exige revisão humana; não prova que fatos distintos não representem o mesmo gasto. Comando privado e gate fechado. Antes de habilitar, validar revogação, RLS/FORCE, locks com rateio/correção, alterações de OS/lista, replay, privacidade, compatibilidade do comando canônico, histórico, volume e revisão adversarial. Nenhuma despesa ou cobrança é criada.
