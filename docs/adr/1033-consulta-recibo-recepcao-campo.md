---
name: "docs-adr-1033-consulta-recibo-recepcao-campo-md"
description: "Documento Sinérgica SO: ADR-1033 — Consulta de recibo de recepção de campo"
alwaysApply: false
---

# ADR-1033 — Consulta de recibo de recepção de campo

Status: preparação local, sem teste ou concessão.

Após resposta incerta, somente o ator original, com sessão e capacidade cadastral atuais para o Cliente, pode consultar o recibo mediante request, envelope, OS, linhas e referências exatamente iguais. O retorno é mínimo e não entrega o conteúdo persistido. O gate permanece fechado e a função privada. A consulta não confere autenticidade das informações, não incorpora cadastros e não substitui o processo de reconciliação para outras identidades ou dispositivos.

Deve ser testada com revogação, gates, concorrência, privacidade, limites, alteração de triagem e ordenação de locks, e passar revisão adversarial. A tentativa no navegador contém informações potencialmente sensíveis; avaliar retenção e limpeza entre abas ou sessões antes de ativar.
