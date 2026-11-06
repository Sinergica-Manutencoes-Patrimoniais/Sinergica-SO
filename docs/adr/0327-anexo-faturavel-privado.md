# ADR-0327 — Anexo privado de item faturável

Status: proposta; gate e funções fechados, sem testes.

Nesta fatia, somente comprovantes já registrados como realização ou correção da própria despesa que originou o candidato podem ser vinculados ao item. A associação é explícita e auditada; arquivo continua no bucket privado e é servido por rota mediada que revalida a capacidade financeira e o vínculo. Nenhum caminho ou URL assinada é entregue à interface ou ao Portal. Não permite vincular arquivos arbitrários, alterar financeiro ou cobrar. Outras origens e tipos de documento dependem de contrato de proveniência próprio. Exige revisão adversarial de Storage, permissões, concorrência e testes antes da ativação.
