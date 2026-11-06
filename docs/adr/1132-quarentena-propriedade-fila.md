# ADR-1132 — Quarentena de propriedade da fila de integração

Status: proposta local, não aplicada nem homologada.

Se a varredura encontrar item cuja observação pertence a outro Cliente, deve registrar conflito privado e seguir para o próximo item, sem mover, apagar ou divulgar o histórico anterior. A mesma regra se aplica à observação de demora. Repetições sem mudança não criam novos eventos; mudanças de identidade ou Cliente geram revisão imutável. A origem precisa ser conferida e travada pelo consumidor antes do registro.

A quarentena não comprova que a transferência foi legítima, não resolve conflito nem autoriza acesso cruzado, retry ou efeito externo. Permanecem pendentes consulta/decisão, casos de origem sem Cliente, conflitos com mais de uma titularidade histórica, concorrência com transferência, RLS/FORCE e revisão adversarial. Gate fechado até integração e testes.
