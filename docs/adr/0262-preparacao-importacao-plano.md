# ADR-0262 — Preparação de incorporação de cronograma

Status: proposta, não homologada.

O mapeamento de staging atual não preserva todos os campos exigidos para incorporação confiável (incluindo tolerâncias e vínculo entre identidade declarada e Rotina oficial). Uma identidade declarada não demonstra equivalência entre lotes, e ausência de ligação de origem em Rotinas impediria garantir idempotência em reprocessamento. Não chamar o comando canônico de criação de Rotina enquanto essas condições não forem resolvidas.

A consulta proposta permite conferir linhas candidatas de uma revisão de lote aprovada e de um Plano rascunho do mesmo Cliente, preservando referências de origem e revisão do Plano. É fotografia de leitura, sem criar Plano, Rotina, ocorrência ou OS; revisões posteriores a invalidam. Rejeitadas e não-dados não são candidatos. Gate e EXECUTE ficam fechados até revisão e testes; não há autorização para incorporação.
