---
name: quickstart
description: Comandos e jornadas para validar a continuação 360.
alwaysApply: false
---

# Validação — pesquisa e navegação

1. Aplicar migrations 1893/1894 em ambiente local sob lock sbdb.
2. Rodar pgTAP E01-S190_pesquisa_estrutura.test.sql e E01-S179_central_sete_estados.test.sql.
3. Rodar Vitest PesquisaGlobalEstrutura.test.tsx, MateriaisAquisicoesPage.test.tsx,
   navegacao-sso.test.ts e rotas-legadas.test.ts.
4. Cliente com cadastro.ler ou cadastro.gerir: Clientes e Estrutura → Cliente → Estrutura.
   Pesquisar nome/código/TAG; conferir tipo e abrir Área → Local → Sistema → Equipamento → Componente.
   Grupo permanece tipo próprio, com histórico e planos próprios.
5. Trocar Cliente/usuário, revogar acesso e paginar: nenhuma identidade ou resultado anterior aparece.
6. Trabalho → Materiais e Aquisições → Cliente; conferir sete estados e abrir OS/orçamento autorizado.

