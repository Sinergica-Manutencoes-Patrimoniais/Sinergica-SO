# ADR-0105 — Versões imutáveis da organização de materiais

## Estado

Proposta para E01-S179, subordinada à ADR-0099. Não autoriza aplicação ou habilitação em produção.

## Decisão

Cada salvamento da organização cria snapshot imutável de linhas associado à lista e à nova revisão. A ordem do vetor integra a identidade histórica de cada linha: referências futuras a uma linha precisam incluir lista, revisão e posição, nunca apenas posição. Juntar e dividir são operações de edição que geram nova revisão, sem apagar snapshots anteriores. O texto original da lista nunca muda; cada trecho de evidência informado deve corresponder exatamente a uma linha desse texto. Lista vazia de linhas é válida e mantém texto simples.

Comando recebe requestId, lista, revisão esperada e linhas, serializa request e agregado, confirma autorização `material.gerir` para Cliente derivado da lista e OS ativa, grava revisão, snapshot, resultado idempotente e auditoria mínima na mesma transação. A leitura de snapshots exige autorização atual e retorna uma revisão explícita. Mesmo requestId com payload diferente conflita; retry idêntico não cria revisão extra. Exceções, disponibilidade e integração de aquisição permanecem fora desta fundação e exigem decisões/contratos próprios.

## Gates

Sem aplicação ou flag habilitada até pgTAP, autenticação/RLS, isolamento entre Clientes, falhas atômicas, replays, concorrência entre edições e revogação de permissão em espera, análise de retenção dos textos e revisão adversarial. A capacidade atual de serializar revogação ainda não foi comprovada: a autorização desta migration não constitui prova desse requisito.
