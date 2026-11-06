# ADR-0438 — Inventário de geração preventiva legada

Status: preparado, gate fechado, não aplicado nem homologado. O gerador `materializar_ocorrencias_preventivas` (0224) opera por `planos_preventivos`, independentemente dos Planos de Manutenção. A ponte 0340 vincula apenas ocorrências específicas; não comprova equivalência entre Planos nem autoriza inferir que todas as futuras ocorrências pertencem ao mesmo Plano novo.

A consulta agregada conta Planos legados do Cliente com ou sem pontes observadas, com mais de um Plano preparado e com divergência de Cliente, sem expor IDs de outros Clientes. Não bloqueia ou altera nenhum gerador, especialmente Planos sem identidade comprovada. Uma futura guarda necessita associação explícita validada, política para múltiplos vínculos, concorrência, testes e revisão adversarial; até então suspensão nova não interrompe geração legada.
