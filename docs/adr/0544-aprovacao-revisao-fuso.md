---
name: "docs-adr-0544-aprovacao-revisao-fuso-md"
description: "Documento Sinérgica SO: ADR-0544 — Vigência futura de revisão no fuso histórico"
alwaysApply: false
---

# ADR-0544 — Vigência futura de revisão no fuso histórico

Status: preparado, gates desligados, não aplicado nem homologado. A substituição aditiva de 0342 avalia o início futuro pela data civil do fuso congelado na versão aprovada anterior, através da função 0766. Ausência de fuso histórico bloqueia a operação; nenhum fuso é inferido. A nova aprovação continua sujeita ao snapshot explícito 0763, às proteções de vigência e à guarda de impacto 0715.

Não prova que a fonte é contratual nem que impactos foram resolvidos. A guarda 0715 continua bloqueando aprovação enquanto não houver prova transacional; testes de fronteira/DST, comparação com a função efetivamente instalada, concorrência e revisão adversarial permanecem obrigatórios.
