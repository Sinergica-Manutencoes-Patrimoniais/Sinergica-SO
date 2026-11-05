# ADR 1588 — Integração da declaração legada inerte

## Contexto
Uma ocorrência legada pode ser preparada antes da vigência de uma escolha posterior `somente_sso`. Depois da vigência, a declaração PCM 1729 preserva a linha e confirma que ela está inerte, mas 1724 ainda bloqueia o ciclo SSO e as telas a contam como pendência.

## Decisão
A guarda reconhece somente declaração correspondente ao selo vigente, com linha ainda prevista, sem técnico/data, avaliação, ponte, OS, tarefa ou resultado. Ela continua impedindo execução da fonte legada. Uma consulta por Cliente e IDs informa `substituida` ou `normal`, sem remover a linha do histórico ou da trava estrutural; origem divergente falha fechada.

## Limites
A guarda 1045 permanece ativa. Operação não se baseia em ausência global de dados externos; são conferidos efeitos conhecidos no SSO. A implantação exige revisão, testes de concorrência e verificação de todos os consumidores.

A leitura de estados segue a política PCM existente: usuário autenticado com acesso PCM ou superadmin e IDs pertencentes ao Cliente informado. Essa política não comprova concessão individual por Cliente; a ação de conciliação, por sua vez, exige `plano.gerir` para o Cliente e autorização adicional de Visita quando aplicável. A última conferência auditada prevalece; mudança posterior da fonte invalida seu efeito até nova conferência.
