---
name: "adr-1668-mediacao-composicao-estrutura"
description: "Leitura transacional das novas composições"
alwaysApply: false
---

# ADR-1668 — Leitura transacional das novas composições

Status: proposta; depende do gate fechado da 1809. Um mediador consulta as fontes necessárias às visões de Local e Sistemas na mesma transação que trava o gate e verifica ator/Cliente e ação atual. Com gate desligado ou indisponível, nenhuma fonte é entregue. A consulta preserva paginação de 50 linhas, ordenação e campos necessários; cada fonte recebe filtro explícito de Cliente. Vínculos só são retornados se Sistema e Equipamento pertencerem ao Cliente autorizado. Categorias são compartilhadas e retornam apenas identificador e nome.

O mediador usa SECURITY DEFINER e filtros explícitos porque o legado tem políticas amplas; exige owner compatível com FORCE RLS, ACL fechada e `search_path` vazio. Para Sistemas, Locais, Itens, Vínculos e Categorias, também exige a claim PCM assinada de leitura/escrita ou papel superadmin, preservando as políticas legadas; Grupos mantêm a política existente de capacidade por Cliente. A trava do gate impede que ele seja desligado durante a leitura; a trava compartilhada do protocolo de autorização impede revogação concorrente. O gate continua desligado por padrão e sua ativação requer o plano de concessões do ADR-1667. As páginas não formam snapshot transacional entre si. Testes de dois Clientes, gate, revogação, limites de paginação, filtros e concorrência permanecem obrigatórios antes da homologação. Não há alterações de dados, deploy ou Auvo.
