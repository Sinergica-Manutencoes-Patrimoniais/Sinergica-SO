# Contrato — RPCs do schema `marketing`

Todas chamadas pelo cliente com a sessão do usuário (anon key + Authorization). `service_role`
nunca no navegador.

## `marketing.fn_metricas_periodo(p_de date, p_ate date)`

`stable`, invoker — a RLS das tabelas é quem autoriza, e ela chama
`config.sso_acesso_atual('marketing', 'leitura')` (releitura ao vivo, E00-S27): o claim do
token não concede nada por si, e quem foi revogado perde acesso na próxima consulta.

Devolve **uma linha por anúncio** com as somas do período:

```
campanha_id uuid, campanha_nome text, campanha_situacao text,
conjunto_id  uuid, conjunto_nome  text,
anuncio_id   uuid, anuncio_nome   text, anuncio_situacao text,
tem_numeros boolean,
gasto_centavos bigint, alcance bigint, impressoes bigint, cliques bigint, leads bigint
```

Ordenado por `campanha_nome, conjunto_nome, anuncio_nome, anuncio_id`.
Erros: `22023 periodo_invalido` quando `p_ate < p_de` ou a janela passa de 366 dias.

## `marketing.fn_receita_por_campanha(p_de date, p_ate date)`

`security definer`. Exige `config.sso_acesso_atual('marketing', 'leitura')` **e**
`config.sso_acesso_atual('comercial', 'leitura')` — releitura ao vivo nos dois contextos;
senão `42501 sem_permissao`.

```
campanha_id uuid, campanha_nome text,
gasto_centavos bigint, leads bigint,
oportunidades bigint, contratos bigint, receita_centavos bigint
```

Campanha com gasto e sem atribuição aparece com zeros (AC-18), nunca é omitida.

## `marketing.fn_registrar_entrada_anuncio(p_token text, p_nome text, p_email text, p_telefone text, p_ocorrido_em timestamptz)`

`security definer`. Exige `config.sso_acesso_atual('marketing', 'escrita')`. Devolve `uuid`
da entrada.
Token nulo, malformado ou desconhecido → entrada gravada com `anuncio_id` nulo (AC-14), nunca
atribuída a outro anúncio e nunca rejeitada.

## `marketing.fn_vincular_oportunidade(p_entrada_id uuid, p_oportunidade_id uuid)`

`security definer`. Exige `config.sso_acesso_atual('marketing', 'escrita')` **e**
`config.sso_acesso_atual('comercial', 'leitura')`.
`23505` se a oportunidade já estiver vinculada a outra entrada (AC-15).

## `marketing.fn_token_meta()`

`security definer`, `grant execute` **apenas** a `service_role`. Lê `vault.decrypted_secrets` pelo
nome fixo `marketing_meta_access_token`. Sem parâmetro — não é leitor genérico do cofre.
Nenhuma rota do cliente a alcança.
