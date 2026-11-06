# ADR-0244 — Identidade manual de linhas de cronograma

Status: proposta, não homologada.

O staging unificado mantém lotes imutáveis com chaves posicionais. Posição não identifica uma Rotina entre arquivos reordenados. O PCM declara uma identidade de origem explícita para cada linha de cada lote, com revisão otimista e histórico append-only. Não se presume que a identidade corresponda a uma Rotina oficial; a declaração pode ser corrigida sem apagar o histórico. Não pode haver duas linhas ativas com a mesma identidade no mesmo lote.

A comparação lê apenas identidades declaradas dos dois lotes do mesmo Cliente e compara os atributos disponíveis no staging. Sem identidade, a linha fica pendente; igualdade de atributos não implica equivalência operacional. A comparação não classifica rejeições, não aprova, não incorpora e não cria Rotinas ou ciclos. A função e a escrita ficam sem EXECUTE e dependem do gate de cronograma; ativação exige testes, revisão de segurança e homologação. Retorno é desativar o gate; não apagar histórico.
