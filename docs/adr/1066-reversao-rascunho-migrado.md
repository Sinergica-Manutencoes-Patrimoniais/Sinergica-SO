---
name: "docs-adr-1066-reversao-rascunho-migrado-md"
description: "Documento Sinérgica SO: ADR-1066 — Reversão lógica do rascunho de Plano legado"
alwaysApply: false
---

# ADR-1066 — Reversão lógica do rascunho de Plano legado

**Status:** preparação privada, não homologada. Complementa ADR-1064.

A reversão não apaga Plano, versão, Rotina, origem ou histórico legado. Sob revisão esperada e trava, verifica se o rascunho continua na revisão criada, se há exatamente a versão e Rotina originais e se existem referências estrangeiras posteriores. Quando não houver uso detectado, encerra logicamente o Plano e registra a decisão; caso contrário, registra pendência de reconciliação sem mudar o Plano. O motivo, ator e requestId ficam no histórico imutável. O comando exige superadmin ativo, capacidade de Plano e gates fechados.

A varredura de dependências cobre FKs do banco, não referências em JSON, identificadores externos ou todos os escritores. Um gate separado e fechado impede concluir reversão automática enquanto essa cobertura não for comprovada; a operação pode apenas registrar pendência. O executor deve enxergar todas as linhas apesar de FORCE RLS; sem esse privilégio o comando falha fechado. Não é reversão genérica de lote nem prova de ausência de uso histórico apagado. A função não recebe EXECUTE operacional. Antes de habilitar, inventariar referências sem FK e escritores após encerramento, testar RLS/owner, duas ordens de concorrência, locks, alterações simultâneas, replay, dependências financeiras/OS e revisão adversarial. Nunca apagar execução ou dados financeiros.
