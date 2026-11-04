# Ensaio isolado S166 — preparação pendente

Este diretório ainda não contém um ensaio UI/backend completo. Nunca use a configuração Playwright padrão do projeto: ela carrega `.env.local` e pode reutilizar servidor existente. O arquivo `playwright.s166-isolado.config.ts` é apenas parte da infraestrutura; seu filtro HTTP não prova isolamento completo de rede.

Antes de executar uma jornada: criar rede Docker interna, serviços e navegador exclusivamente nela, banco descartável separado, atestar via gateway a identidade do banco, bloquear saída externa no nível da rede e usar credenciais criadas somente para esse ensaio. Não tocar Auvo. Remover recursos descartáveis ao final.

## Hipótese do erro de login

No ensaio anterior, o GoTrue v2.197.0 foi iniciado sem `GOTRUE_JWT_AUD`, enquanto a fixture SQL cria o usuário com `aud='authenticated'`. A consulta do GoTrue filtra pelo `aud` da configuração, além de exigir `is_sso_user=false`; sem header ou token, utiliza a audiência configurada. Configurar explicitamente:

```text
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
```

No segundo ensaio, com esta configuração, o login sintético retornou 200; a jornada não chegou à prévia de Grupo e não foi concluída. Preferir criar o usuário sintético pelo endpoint Admin do próprio GoTrue isolado, com e-mail confirmado e senha efêmera, e usar o ID retornado na fixture de negócio. Não usar token forjado como substituto da autenticação. Antes de concluir, verificar que o login real funciona e que a conta gerada possui a audiência e concessões corretas no clone. Nunca salvar senha ou token em logs ou no repositório.

Fontes da versão examinada: [obtenção da audiência](https://github.com/supabase/auth/blob/v2.197.0/internal/api/helpers.go), [consulta do usuário](https://github.com/supabase/auth/blob/v2.197.0/internal/models/user.go), [configuração JWT](https://github.com/supabase/auth/blob/v2.197.0/internal/conf/configuration.go).

Os futuros testes devem importar `test` de `./fixture`. Em caso de falha, ela anexa categorias de console e métodos/rotas/status sem headers, query strings ou corpos, além de captura visual com textos e imagens ocultos. Ainda é necessário assegurar que apenas dados sintéticos entrem no navegador e comprovar a rede interna e identidade do clone; a fixture não é uma barreira de rede completa. A configuração só aceita gateway em `127.0.0.1` e não executa um ensaio por si só.

## Hipótese para prévia de Grupo indisponível

O segundo ensaio autenticou, mas não exibiu a prévia; não foram preservados o status da RPC ou os detalhes da tela. A configuração GoTrue usada no ensaio **não habilitou** o hook de token previsto pelo projeto. Esse é um bloqueio provável: `supabase/config.toml` ativa `config.custom_access_token_hook`, que inclui `user_role`; `config.sso_autorizar_acao` exige que esse claim coincida com o papel do usuário. A fixture SQL anterior simulava explicitamente o claim `superadmin`, enquanto uma sessão real sem hook não o recebe. A causa exata da falha da prévia ainda não foi comprovada.

Para o próximo ensaio **somente no GoTrue ligado ao clone isolado**, acrescentar estas variáveis ao processo GoTrue:

```text
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/config/custom_access_token_hook
```

Manter `GOTRUE_JWT_AUD=authenticated`. Antes de tentar a UI, verificar no clone as permissões necessárias de `supabase_auth_admin` sobre o hook e suas dependências; não ampliar permissões em outro banco. Após login real, conferir em memória que o claim `user_role` coincide com o papel sintético esperado e emitir apenas um resultado booleano, sem imprimir ou persistir JWT, payload, senha ou resposta do login. Não gerar JWT manualmente nem dispensar as validações da aplicação. Capturar a resposta da RPC apenas por status e rótulo de rota usando a fixture sanitizada.

Referências: [configuração local do projeto](../../../../supabase/config.toml), [hook do projeto](../../../../supabase/migrations/0008_E00-S09_resolver_hook_permissoes.sql), [autorização da ação](../../../../supabase/migrations/0246_E01-S170_modulos_elegiveis.sql), [configuração oficial de hooks GoTrue](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks).
