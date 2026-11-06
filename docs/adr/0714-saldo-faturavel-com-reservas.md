---
name: "docs-adr-0714-saldo-faturavel-com-reservas-md"
description: "Documento Sinérgica SO: ADR-0714 — Saldo de faturável com reservas"
alwaysApply: false
---

# ADR-0714 — Saldo de faturável com reservas

Status: preparado, não aplicado nem homologado.

O saldo da alocação deve distinguir valor conferido, alocações ativas e reservas internas ainda não liberadas. O saldo de 0751 sozinho não representa disponibilidade quando existe reserva. A consulta aditiva 0939 valida Cliente e capacidade, calcula os componentes em uma única instrução e falha diante de fonte divergente; não cria reserva nem concede execução. Gates existentes permanecem fechados.

O valor é apenas observação, não reserva: os comandos de escrita devem revalidar saldo sob o protocolo transacional comum. A revisão das escritas legadas, concorrência, reconciliação e autorização efetiva é obrigatória antes de expor a consulta ou ativar qualquer gate. Nenhuma operação externa é realizada.
