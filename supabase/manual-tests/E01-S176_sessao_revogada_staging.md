---
name: "supabase-manual-tests-e01-s176-sessao-revogada-staging-md"
description: "Documento Sinérgica SO: Ensaio pendente — sessão revogada durante leitura de anexos staging"
alwaysApply: false
---

# Ensaio pendente — sessão revogada durante leitura de anexos staging

Ainda não executado. As três funções chamam `serve` no carregamento e usam Auth e Storage reais; não há factory de handler com dependências injetáveis. Os testes abaixo exigem harness real específico e não são cobertos pelo ensaio de fotos cadastrais de Grupo.

## Ambiente

Clone descartável com migrations originais necessárias e 1812, Auth, PostgREST, Storage e Edge Runtime oficiais em rede interna, sem portas no host, sem dados ou credenciais reais, sem Auvo e com limpeza verificada dos recursos próprios. Ativar somente no clone os gates necessários de cada cenário; conferir flags das rotas e privilégio de cada usuário antes de iniciar. Criar usuários e Clientes sintéticos A/B com permissões distintas, vínculos aceitos e objetos privados válidos nos buckets correspondentes. A origem sintética não comprova coleta real de campo. Não editar políticas ou conceder privilégios apenas para fazer o teste passar.

## Casos por rota

- `pcm-foto-staging-ativo-segura`: objeto JPEG/PNG aceito em `sso-levantamento-fotos`, RPC `sso_caminho_foto_staging_ativo_servico` (0943), usuário com capacidade no Cliente A.
- `pcm-foto-staging-grupo-segura`: foto de Grupo aceita no mesmo bucket, `SSO_FOTO_GRUPO_MEDIADA_ENABLED=true` e mediação/gates 1462. O modo anterior chama núcleo privado e não serve de caminho positivo sem outra mediação.
- `pcm-documento-staging-ativo-seguro`: PDF aceito em `sso-levantamento-documentos`, `SSO_DOCUMENTO_ATIVO_MEDIADO_ENABLED=true` e gates 1812. Confirmar que listagem 1812 e identidade autorizada correspondem ao mesmo Cliente/objeto.

Para cada rota: validar primeiro token válido e bytes corretos; ausência de token e Cliente B não podem retornar bytes. Em seguida, executar leitura em paralelo com proxy interno descartável que bloqueie a resposta de Storage após o início do download. Somente após comprovar a barreira, invalidar a sessão do usuário no Auth real; confirmar que o mesmo token falha em `auth.getUser`, liberar Storage e exigir HTTP 401, sem bytes do anexo. Repetir com a invalidação após a primeira revalidação e antes da última, usando barreira explícita no tráfego de Auth. Sem essa barreira, ou se Auth continuar aceitando o token, classificar o caso como inconclusivo, não PASS.

Confirmar também que mudança de permissão enquanto o download está bloqueado impede a entrega e que o status representa autorização, não erro de infraestrutura. Conferir limites de tamanho/MIME, `Cache-Control: private, no-store`, nenhum caminho na resposta e nenhuma alteração no Auvo. A fotografia de Grupo tem hipótese não reproduzida de mudança do vínculo entre autorização e locator; não alegar cobertura de concorrência apenas com revogação. Revalidar identidade e limpar os recursos pelo ID exclusivo mesmo após falha.

## Limites

Revogar a sessão não prova revogação de permissão, e teste isolado não demonstra atomicidade entre banco e Storage nem imunidade a substituição privilegiada dos bytes. Registram-se resultado por rota, barreiras atingidas, status e limpeza, sem logar tokens ou conteúdo privado.
