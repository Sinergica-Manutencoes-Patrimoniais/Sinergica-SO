# Data Model — E01-S171

## Aggregates and Constraints

pcm.visitas: Cliente, contrato opcional, Posição, data, início/fim, timezone, natureza regular/extra/reposição manual, estado, responsável, deslocamento opcional, confirmação e revisão. pcm.visita_equipes: funcionário/papel/horas. pcm.visita_ordens_servico: OS, Visita, sequência, estimativa, início/fim da vigência da associação; única associação vigente por OS, N:N histórico. Política ciência efetiva guarda origem e snapshot.

## State and history

### US1 — Agrupar e confirmar várias OS na Visita

- AC-1: Dada Visita, quando adicionar OS de origens distintas do mesmo Cliente, então mantém contêiner com janela, equipe, responsável, horas, deslocamento, sequência e referências; OS de outro Cliente ou segundo vínculo vigente é negada.
- AC-2: Dada Visita planejada, quando PCM autorizado confirmar, então registra revisão e política resolvida; padrão não exige cliente, modo informativo não bloqueia e modo obrigatório exige confirmação/data/responsável/canal/observação.
- AC-3: Dado Cliente 360 ou agenda global, quando criar/abrir Visita, então usa o mesmo caso de uso, filtro Cliente e detalhe, com carregamento/vazio/erro/retry e foco preservado.

### US2 — Reprogramar e cancelar com rastro

- AC-4: Dada OS em Visita, quando reprogramar, então fecha associação anterior e cria nova vigente com motivo/data/ator; preserva tarefa Auvo e gera somente intenção de atualização de E01-S168.
- AC-5: Dada confirmação prévia, quando alterar equipe, janela ou conteúdo, então invalida revisão confirmada e exige nova confirmação PCM; cancelamento concorrente impede envio de revisão antiga.
- AC-6: Dada Visita extra ou cancelada/parcial, quando salvar, então não muda regra contratual semanal, mantém regular na mesma semana e registra estados Rascunho/Planejada/Confirmada/Enviada/Em execução/Parcial/Concluída/Reprogramada/Cancelada conforme transição permitida.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
