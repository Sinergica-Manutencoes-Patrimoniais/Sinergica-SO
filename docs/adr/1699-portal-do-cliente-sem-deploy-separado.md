---
name: "docs-adr-1699-portal-do-cliente-sem-deploy-separado-md"
description: "Documento Sinérgica SO: ADR-1699 — o Portal do Cliente continua dentro do app único, sem build nem deploy separados; cancela a E09-S11 (E09-S12)"
alwaysApply: false
---

# ADR-1699 — Portal do Cliente sem deploy separado (E09-S12)

**Status:** aceita · **Data:** 2026-11-25 · **Story:** E09-S12 · **Tier:** arquitetural
**Motivo do tier:** decisão de topologia de deploy, com efeito sobre o modelo de defesa do dado do
cliente. Reverte uma decisão de PO registrada e já implementada em código.

**Esta ADR não edita nenhuma outra: ela substitui a decisão que originou a E09-S11.** A convenção do
projeto é nunca editar ADR nem decisão antiga; esta é a que a sucede.

## Contexto

A E09-S11 nasceu de uma frase do PO: *"depois vamos para um deploy separado para não ter risco do
cliente conseguir com o acesso dele ver informações do OS"*. O código foi feito: `apps/portal`, um
segundo build Vite que importava só `features/area-cliente/`, um `netlify.toml` próprio com CSP
estrita e um gate `check-isolation.mjs` que falhava se um import interno do SO vazasse para o bundle
do portal. Faltava só criar o site e o subdomínio no Netlify — gate operacional externo, nunca feito.

Em 25/11/2026 o Lucas decidiu o contrário: **o Portal fica onde está, dentro do app único.** Razão
dada, textual: "aumenta muito a complexidade".

## Decisão

1. `apps/portal` sai do repositório. Com ele saem o segundo `netlify.toml`, o segundo `vite.config`,
   o segundo `tsconfig` e o gate `check-isolation`.
2. O Portal continua servido por `apps/web`: `App.tsx` já roteia `papel === 'cliente-sindico'` para
   `PortalShell`, e é esse o caminho que está em produção hoje. Nenhuma tela do portal é removida —
   `features/area-cliente/` fica intacta, com seus 45 arquivos e seus testes.
3. `packages/portal-core` **fica**. Apesar do nome falar em "dois builds", quem o consome hoje é o
   `PortalShell` dentro do `apps/web`; são contratos neutros (seções, claim de tenant), úteis
   independentemente da topologia.

## O que isto custa, dito na cara

`apps/portal` era **defesa em profundidade**, não o controle principal. Removê-lo significa que o
bundle que o síndico baixa volta a conter o código das telas internas do SO — como sempre conteve,
porque o deploy separado nunca chegou a existir em produção. O que impede o síndico de **ver dado**
interno continua sendo, e sempre foi:

- **RLS por `cliente_id`** (E09-S01, ADR-0011), com `force` e teste pgTAP de permitido e negado;
- **papel `cliente-sindico`** carimbado no JWT, checado no servidor;
- **mediação no banco** das leituras do portal (ADR-1221, ADR-1224, ADR-1403, ADR-1404, ADR-0261).

Nenhuma dessas é tocada aqui. O que se perde é a camada que impediria o síndico de **ler o código**
das telas internas no bundle — JavaScript minificado de interface, não dado de cliente.

**Consequência vinculante:** como a separação de bundle deixou de existir como defesa, qualquer
leitura nova do portal continua obrigada a passar por função mediada no banco, nunca por consulta
direta do cliente a tabela interna. Isso já era regra; agora é a única linha.

## Alternativas consideradas

- **Manter o código parado sem deployar.** Recusada: código morto num monorepo com gate de CI
  próprio envelhece e passa a quebrar build por motivo que ninguém quer mais resolver. Foi o mesmo
  raciocínio que aposentou a prévia simulada `/preview-s41` (E02-S42).
- **Deployar como estava.** Recusada pelo PO: complexidade de dois sites, dois domínios, duas
  configurações de auth e dois pipelines, para uma defesa secundária.

## Reversão

Retomar é recuperar `apps/portal` do git (último commit antes do `chore(E09-S12)`) e criar o site no
Netlify. Nada no schema, na RLS ou em `features/area-cliente/` impede a volta.
