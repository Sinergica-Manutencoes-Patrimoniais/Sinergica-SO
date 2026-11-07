---
name: "docs-adr-0467-geracao-visita-contratual-md"
description: "Documento Sinérgica SO: ADR-0467 — Geração contratual preparada com declaração de feriados"
alwaysApply: false
---

# ADR-0467 — Geração contratual preparada com declaração de feriados

Status: preparado, gate desligado, não aplicado nem homologado. Sob dupla autorização, o comando verifica série, regra, semana, vigência e horário civil, exige declaração humana de cobertura de feriados e serializa processamento pela série. Feriado declarado do Cliente/contrato registra supressão auditada sem Visita nem reposição; caso contrário cria Visita regular rascunho pelo comando 0283 e registra origem 0313 na mesma transação, sem OS ou Auvo.

Declaração de cobertura não comprova fonte oficial completa. Uma Visita/origem existente exige reconciliação, não duplicação deliberada. A identidade série/semana é única nesta nova tabela, mas ainda não há constraint que impeça todos os escritores concorrentes da tabela legada 0313: ativação depende de inventário, proteção completa, política de reconciliação e testes. Horário ambíguo de verão exige escolha explícita do instante pelo operador e revisão; nenhum efeito remoto é permitido.
