# Contrato — Edge Function `marketing-sincronizar-meta`

`POST`. Camadas na ordem obrigatória: CORS restrito → `requireAuth` (JWT) → Zod → autorização →
lógica → resposta. Erro em `problem+json` (RFC 7807) com `reqId`, sem stack.

## Entrada

```json
{ "contaId": "<uuid>", "janelaDias": 7 }
```

`janelaDias` opcional, inteiro de 1 a 90, padrão **7**. `contaId` precisa existir em
`marketing.contas_anuncio` e estar `ativa`.

## Autorização

`marketing = 'escrita'` no claim do chamador, verificada no servidor (AC-12). Sem ela: `403`.

## Saída (200)

```json
{
  "sincronizacaoId": "<uuid>",
  "origem": "meta" | "demonstracao",
  "janela": { "de": "2026-11-19", "ate": "2026-11-25" },
  "gravados": { "campanhas": 3, "conjuntos": 7, "anuncios": 21, "metricas": 147 }
}
```

`origem: "demonstracao"` quando não há credencial no cofre (AC-10). O mesmo valor é gravado em
`marketing.sincronizacoes` e exibido na tela como tarja.

## Erros

| Status | Quando |
|---|---|
| 401 | sem JWT |
| 403 | sem escrita no módulo `marketing` |
| 404 | `contaId` inexistente ou inativa |
| 422 | corpo fora do schema Zod |
| 502 | a Meta respondeu erro — `detail` traz **o código**, nunca o corpo nem o token |
| 500 | erro inesperado, sem stack |

Em qualquer falha, a execução é gravada com `resultado = 'falha'` (AC-11).

## Idempotência

Rodar duas vezes a mesma janela não cria linha nova de métrica: upsert por `(anuncio_id, dia)`;
hierarquia por id externo com `coalesce(excluded.x, atual.x)` (ausente não apaga). O que cresce é
`marketing.sincronizacoes`, de propósito — é o histórico de operação.

## Fora do contrato, para sempre

Nenhuma rota, parâmetro ou ramo desta função escreve na Meta. A porta `MetaAdsPort` declara
somente `hierarquia` e `numerosDiarios` (FR-017, SC-006).
