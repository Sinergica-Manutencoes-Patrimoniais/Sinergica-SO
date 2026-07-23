---
name: product-E01-S76-hierarquia-localizacao-ativos
description: PRD — estrutura hierárquica de localização de ativos (Cliente>Área>Local>Item) + Sistemas no PCM.
alwaysApply: false
tier: arquitetural
---

# Product — Hierarquia de localização de ativos + Sistemas

## Problema
No PCM os ativos (`pcm.equipamentos`, 2000+ linhas sincronizadas do Auvo) são planos: cada equipamento
liga-se só a um cliente e a única informação espacial é `localizacao text` (texto livre, herança da
limitação do Auvo). Uma empresa de manutenção predial (prédios, condomínios, galpões) precisa saber
**onde** cada ativo está instalado e **de qual sistema funcional** ele faz parte. Hoje isso não existe.

## Público
Supervisores e colaboradores do PCM (Sinérgica Manutenções) que cadastram e operam a base de ativos por
condomínio/prédio. Papéis: `superadmin`, `supervisor`, `colaborador` (matriz de permissão por módulo `pcm`).

## Proposta
Estrutura de organização customizável:
`Cliente > Área (Torre A) > Local (árvore: andar > sala > ambiente) > Item (Equipamento | Componente)`,
mais **Sistemas** transversais ("Sistema de Hidrante Torre A" = todos os hidrantes da Torre A). Sistemas
são empurrados ao Auvo como **Equipamento** (`/equipments`) para receber um código referenciável no campo.

## Objetivos
- Cadastro customizável de Áreas e Locais por cliente (árvore de profundidade livre).
- Todo ativo pode ser posicionado num Local; Componentes podem ser filhos de Equipamentos.
- Ao abrir um Item: ver **caminho de instalação** (breadcrumb Cliente>Área>Local) e **sistemas** de que participa.
- Sistemas agrupam itens (N:N) e recebem um código do Auvo (via `/equipments`).

## Não-objetivos (fora de escopo)
- Auto-parse do `localizacao` texto-livre existente para Área/Local (backfill é manual pela UI).
- Ligar `writeEnabled:true` do Sistema no Auvo nesta story (é follow-up gated após teste de contrato real).
- Rotas por URL / deep-link (app segue router-por-`useState` em `HomePage.tsx`).

## Métrica de sucesso
Um Item aberto na UI exibe corretamente Cliente>Área>Local + chips de sistema; um Sistema criado com N
itens enfileira no outbox Auvo (dry-run enquanto gated). AC-1..AC-10 verdes pelos gates.

## Riscos
- Schema change em `pcm.equipamentos` (produção) — mitigado por colunas aditivas nullable/default + FK NOT VALID→VALIDATE.
- Sistema-como-Equipment volta no pull de Equipment(27) e cria linha-fantasma em `pcm.equipamentos` — mitigação documentada no design como pré-condição do gate `writeEnabled`.
