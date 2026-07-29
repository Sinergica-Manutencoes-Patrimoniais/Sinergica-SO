---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — "Ferramentas por Técnico" vira hub único (técnico + cliente)

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas testando localmente (2026-07-29). Item 10. **Estende E01-S106**
> (que hoje só aparece na Visão 360 do cliente) e reorganiza `FerramentasPorTecnicoPage.tsx`.

## Contexto de código
- `FerramentasPorTecnicoPage.tsx` já existe (E01-S65+), gerencia alocação de **unidades** de
  ferramenta a **funcionários/técnicos** (`ferramenta_unidades`, `atribuirUnidadeFerramenta`,
  `devolverUnidadeFerramenta`, histórico).
- E01-S106 criou um modelo **separado**: `pcm.ferramenta_alocacoes_cliente` (ferramenta agregada,
  não unidade individual, alocada a **cliente**), com UI só na aba Resumo da Visão 360.
- Lucas quer os dois num só lugar: a tela "Ferramentas por Técnico" vira o hub de alocação de
  ferramentas em geral (técnico OU cliente).

## Resumo
`FerramentasPorTecnicoPage` ganha uma segunda seção/aba "Por Cliente" reusando o
`FerramentaAlocacaoClienteGateway`/adapter já existentes (E01-S106) — sem duplicar lógica, só
mover/adicionar a UI. O painel na Visão 360 do cliente (E01-S106) pode continuar existindo como
atalho de leitura, ou ser removido a favor do hub único — decisão de UX do Lucas (ver questão
aberta).

## Critérios de aceite

### AC-1: Nova seção/aba "Por Cliente" na tela de Ferramentas
- **Dado** a tela "Ferramentas por Técnico" (ou renomeada pra só "Ferramentas")
- **Quando** o operador troca pra aba/seção "Por Cliente"
- **Então** vê a lista de ferramentas alocadas a clientes, com ação de alocar/devolver (mesmo
  comportamento já implementado em E01-S106, reaproveitado).

### AC-2: Alocação por técnico continua funcionando (regressão)
- **Dado** o fluxo já existente (atribuir/devolver unidade a funcionário)
- **Quando** o operador usa a aba "Por Técnico"
- **Então** nada muda em relação ao comportamento atual.

### AC-3: Reaproveita gateway/adapter de E01-S106
- **Dado** a nova seção "Por Cliente"
- **Quando** implementada
- **Então** usa `FerramentaAlocacaoClienteGateway`/`supabaseFerramentaAlocacaoClienteAdapter` sem
  duplicar CRUD.

## Casos de borda e erros
- Nenhum novo além dos já cobertos em E01-S106.

## Fora de escopo
- Unificar o MODELO de dados (unidade individual vs ferramenta agregada) — continuam conceitos
  distintos (E01-S65 rastreia unidade física, E01-S106 rastreia ferramenta no nível agregado);
  esta story só unifica a **tela**.

## Questão em aberto (resolvida, Lucas 2026-07-29)
- [x] O painel "Ferramentas alocadas" na Visão 360 **fica** — é o local de fácil acesso a tudo do
  cliente num só lugar. O hub em "Ferramentas por Técnico" é adicional (visão operacional
  centralizada), não substitui o painel.

## Rastreabilidade
- Código: `FerramentasPorTecnicoPage.tsx`, `application/ferramenta-alocacao-cliente*.ts`,
  `infrastructure/supabase-ferramenta-alocacao-cliente-adapter.ts` (todos já existem, E01-S106).
- Estende: E01-S106.
- ADRs relacionados: —
