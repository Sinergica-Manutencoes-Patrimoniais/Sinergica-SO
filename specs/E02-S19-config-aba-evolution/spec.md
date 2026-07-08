---
name: spec
description: Contrato — aba "Evolution" dedicada (conexão/QR de instâncias), paridade heziomos.
alwaysApply: true
---

# Spec — Aba de config: Evolution (conexão/QR)

> **Fonte da verdade.** Status: implementado localmente; UAT Evolution/pgTAP pendente · Tier: Pequeno
> Hoje o mapeamento de instância Evolution vive espalhado entre a aba "Agentes" e a aba "Canal"
> (`groupJid`/`botJid`). Promove a uma aba de conexão própria como no heziomos.

## Resumo
A aba "Evolution" gerencia a conexão das instâncias do Evolution API (criar/conectar via QR, status,
número vinculado), centralizando o que hoje está diluído em Agentes/Canal.

## Critérios de aceite

### AC-1: Conectar instância via QR
- **Dado** a aba Evolution
- **Quando** o usuário cria/conecta uma instância
- **Então** o QR/estado de conexão é exibido e o status (conectado/desconectado) reflete o real

### AC-2: Status e número vinculado
- **Dado** uma instância conectada
- **Quando** exibida
- **Então** mostra o número vinculado e o status; permite reconectar/desconectar

### AC-3: Compatibilidade com Agentes/Canal
- **Dado** o mapeamento instância→persona (aba Agentes) e `groupJid`/`botJid` (aba Canal)
- **Quando** a aba Evolution assume a conexão
- **Então** o vínculo existente continua funcionando (sem regressão no Zé/roteamento)

## Casos de borda e erros
- Instância cai/desconecta → status "desconectado", ação de reconectar; sem crash.
- Token/URL Evolution inválido → erro claro.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Canais Meta — `E02-S16`. Roteamento persona/agente — já existente (E02-S06).

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `EvolutionTab`.
- Âncora Sinergica: `AtendimentoConfigPage.tsx`, `ConfigCanalForm`, `InstanciasAgenteList`.
