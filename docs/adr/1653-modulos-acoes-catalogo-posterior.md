---
name: "docs-adr-1653-modulos-acoes-catalogo-posterior-md"
description: "Documento Sinérgica SO: ADR 1653: elegibilidade das ações adicionadas ao catálogo"
alwaysApply: false
---

# ADR 1653: elegibilidade das ações adicionadas ao catálogo

O ADR 0030 exige elegibilidade explícita por módulo e concessão atual para o Cliente. Quatro ações criadas depois da migração 0246 declaram módulo e nível em `sso_acoes`, mas não foram incluídas em `sso_acao_modulos`. Assim, usuários comuns com concessão legítima são recusados; superadministrador permanece sujeito à concessão.

Adicionar somente os pares declarados nas migrações de origem: leitura Comercial para `orcamento.operacional.ler`, escrita Comercial para `orcamento.dispensar` e `orcamento.excecao_preco`, e escrita PCM para `anexo_os.publicar`. Antes, conferir código, módulo, nível e exigência de concessão individual, recusando catálogo divergente ou mapeamento existente com nível divergente. Preservar outras opções e não criar, modificar ou revogar concessões.

A alteração torna elegíveis usuários com módulo e concessão já existentes; é uma mudança efetiva de autorização. Os gates específicos das ações continuam inalterados. A conferência das migrations locais não demonstra o estado de um ambiente já implantado. Compilação e testes de autorização, Cliente e concorrência permanecem pendentes.
