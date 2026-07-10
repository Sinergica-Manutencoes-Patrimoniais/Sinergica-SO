---
name: spec
description: Contrato — banner de transparência nas telas com writeEnabled:false (Ferramentas/Categorias/Segmentos/Palavras-chave).
alwaysApply: true
---

# Spec — Banner "escrita local ainda não vai pro Auvo"

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Feedback de teste manual do Lucas (2026-07-09, ponto 4): "cadastrei uma ferramenta no PCM e não
> refletiu no Auvo, o mesmo vale para categoria". Achado (E01-S47): não é bug novo — é `writeEnabled:false`
> já documentado desde a E01-S36, mas a UI não avisa, então parece falha silenciosa.

## Resumo
Componente compartilhado `BannerEscritaAuvoPendente` avisa, nas telas de Ferramentas e nos catálogos
simples (Categorias de produto/equipamento, Segmentos, Palavras-chave — todos com `writeEnabled:false`),
que alterações gravam só localmente e ainda não sincronizam de volta pro Auvo.

## Critérios de aceite

### AC-1: Banner visível antes de editar
- **Dado** a tela de Ferramentas ou qualquer catálogo simples (`CatalogoSimplesPage`)
- **Quando** a tela carrega
- **Então** um banner explica que a escrita é só local, sem o usuário precisar descobrir por tentativa
  e erro

### AC-2: Texto reflete o estado real
- **Dado** o texto do banner
- **Quando** exibido
- **Então** não promete sincronização automática (isso só existe quando `writeEnabled:true`) — refere-se
  à E01-S47 como o próximo passo, sem prazo inventado

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Mudar `writeEnabled` de qualquer entidade — isso é E01-S47 (mantido `false` nesta rodada).
- Criar UI de "categoria" nova (não existe fluxo de criar categoria — só editar as sincronizadas).

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Depende de/segue: E01-S47 (decisão sobre `writeEnabled`).
- Arquivos-âncora: novo `apps/web/src/features/pcm/components/BannerEscritaAuvoPendente.tsx`,
  `apps/web/src/features/pcm/pages/FerramentasPage.tsx`,
  `apps/web/src/features/pcm/pages/CatalogoSimplesPage.tsx`.
