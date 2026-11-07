---
name: "docs-adr-0293-codigo-informado-grupo-staging-md"
description: "Documento Sinérgica SO: ADR-0293 — Localização de códigos informados em Grupos de levantamento"
alwaysApply: false
---

# ADR-0293 — Localização de códigos informados em Grupos de levantamento

Consulta privada e desligada busca correspondência exata de `codigoInformado` em linhas de Grupo do levantamento do Cliente, com paginação e autorização. Trata-se de dado declarado, não de código público, alias, identidade confirmada ou atribuição oficial. Nenhum namespace ou normalização é imposto, e linhas incorporadas ou rejeitadas são identificadas sem apagar histórico.

O modelo atual não atribui códigos provisórios editáveis nem aliases a Grupos; a consulta não cria esses conceitos. Revisão de segurança e testes precedem ativação.
