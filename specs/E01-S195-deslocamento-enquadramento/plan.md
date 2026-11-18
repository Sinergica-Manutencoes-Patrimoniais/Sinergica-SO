# Plano técnico — E01-S195

## Achado prévio (antes de codar)

Grep exaustivo por "horas contratadas"/"jornada limite"/"capacidade semanal" antes de desenhar
o schema: **não existe, em nenhum lugar deste repositório, tabela de hora contratada por Cliente
nem limite de jornada configurado por técnico.** Isso muda a leitura de duas ACs:

- **AC-6** ("não reduz hora contratada automaticamente") vira uma garantia **por ausência**: como
  o conceito não existe, não há o que reduzir. Provado como teste de schema (nenhuma coluna
  "hora_contratada" nesta migration), não como simulação de um sistema inexistente.
- **AC-7** ("excedente a validar, sem classificar hora extra") perde o denominador — sem um
  limite de jornada configurado, "excedente" não tem contra o que comparar. Resolvido como
  SPEC_DEVIATION (ver ADR-1693): a RPC devolve o minuto bruto computável; a comparação contra um
  limite fica para quando existir decisão de produto sobre qual é esse limite — inventar um agora
  seria decidir política de hora extra, that a spec marca fora de escopo.

## O que foi corrigido (migration `1855`, ADR-1693)

- `pcm.sso_trechos_deslocamento` — tabela aditiva, imutável (trigger de proteção, mesmo padrão
  de `1357`), uma revisão = o dia inteiro de trechos, `request_id` idempotente.
- `pcm.sso_enquadrar_trecho_deslocamento(origem, destino)` — função pura, coluna `enquadramento`
  `generated always as ... stored`: nunca um campo editável, sempre derivado.
- `pcm.sso_declarar_trechos_visita` — grava o lote; devolve `totalComputadoMinutos`/
  `totalNaoComputadoMinutos` na mesma resposta (AC-5).
- `pcm.sso_listar_trechos_visita` — lê a revisão vigente; quando não há nenhum trecho ainda,
  devolve 1 linha só com `revisao_visita_atual` (lida fresca de `pcm.visitas`, mesmo padrão de
  `sso_consultar_deslocamento_visita` de 1357) — sem isso o primeiro envio do dia não saberia
  que revisão da Visita usar.

## Frontend — alcance (AC-F1 a AC-F5)

- **Caminho de navegação (AC-F1)**: Agenda/Capacidade → aba "Fontes de Demanda" → expandir uma
  Visita → "Conferir trechos de deslocamento" (`FontesDemanda.tsx`, ao lado do já existente
  "Conferir deslocamento declarado"). Novo componente `TrechosDeslocamento.tsx`.
- **Flag (AC-F2)**: `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED`, declarada em `.env.example` e
  `netlify.toml` (primeira entrada desse tipo em `netlify.toml` — achado: nenhuma das outras
  flags `VITE_SSO_*` está lá, só no dashboard do Netlify; não corrigido retroativamente, fora de
  escopo unilateral).
- **"Disponível, não ativado" (AC-F3)**: gate fechado (`pcm.sso_trechos_deslocamento_gate`,
  `habilitado=false` por padrão) mostra `<output>Recurso disponível, ainda não ativado para este
  Cliente.</output>`, não erro genérico nem tela em branco. `E00-S28` definiu um componente
  compartilhado pra essa mensagem, numa branch ainda não mesclada aqui — mensagem equivalente
  inline até lá.
- **Procedimento de abertura/retorno (AC-F4)**: abrir = `update
  pcm.sso_trechos_deslocamento_gate set habilitado=true where id;` (ação de "ir ao ar", sign-off
  humano separado, mesmo padrão de E01-S193 task 6/18). Retorno = `set habilitado=false`; os
  dados já declarados continuam íntegros (nenhuma linha é apagada ao fechar o gate de novo).
- **Linha de ativação (AC-F5)**: falta abrir `pcm.sso_trechos_deslocamento_gate` e a flag
  `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED` em produção — o código funciona e está testado, a
  jornada só não está em uso até essas duas decisões de ativação.

## Achados corrigidos durante a escrita do teste do componente

Escrever o teste de `TrechosDeslocamento.tsx` (não só o pgTAP) achou 2 bugs reais antes de
publicar:

1. `consulta.error instanceof Error` nunca é verdadeiro pra erro do Postgrest/supabase-js (é um
   objeto plano `{message,...}`, não uma instância de `Error`) — a mensagem "disponível, não
   ativado" nunca apareceria em produção, caindo sempre no erro genérico. Corrigido com
   `mensagemDeErro()` que checa `.message` sem exigir `instanceof Error`.
2. `useQuery` sem `retry: false` — gate fechado é erro permanente, mas o retry automático do
   TanStack Query (3 tentativas, backoff) atrasaria a mensagem certa por vários segundos. Mesmo
   padrão já usado em `DeslocamentoDeclarado`, só não tinha sido copiado.

## SPEC_DEVIATION

- **AC-7 (parcial)**: ver achado prévio acima — devolve o bruto computável, não compara contra
  limite de jornada (não existe um configurado no sistema).
