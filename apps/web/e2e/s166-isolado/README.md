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

Os futuros testes devem importar `test` de `./fixture`. Em caso de falha, ela anexa categorias de console e métodos/rotas/status sem headers, query strings ou corpos, além de captura visual integralmente mascarada (sem detalhes da tela). Ainda é necessário assegurar que apenas dados sintéticos entrem no navegador e comprovar a rede interna e identidade do clone; a fixture não é uma barreira de rede completa. A configuração só aceita gateway em `127.0.0.1` e não executa um ensaio por si só.

## Hipótese para prévia de Grupo indisponível

O segundo ensaio autenticou, mas não exibiu a prévia; não foram preservados o status da RPC ou os detalhes da tela. A configuração GoTrue usada no ensaio **não habilitou** o hook de token previsto pelo projeto. Esse é um bloqueio provável: `supabase/config.toml` ativa `config.custom_access_token_hook`, que inclui `user_role`; `config.sso_autorizar_acao` exige que esse claim coincida com o papel do usuário. A fixture SQL anterior simulava explicitamente o claim `superadmin`, enquanto uma sessão real sem hook não o recebe. A causa exata da falha da prévia ainda não foi comprovada.

Para o próximo ensaio **somente no GoTrue ligado ao clone isolado**, acrescentar estas variáveis ao processo GoTrue:

```text
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/config/custom_access_token_hook
```

Manter `GOTRUE_JWT_AUD=authenticated`. Antes de tentar a UI, verificar no clone as permissões necessárias de `supabase_auth_admin` sobre o hook e suas dependências; não ampliar permissões em outro banco. Após login real, conferir em memória que o claim `user_role` coincide com o papel sintético esperado e emitir apenas um resultado booleano, sem imprimir ou persistir JWT, payload, senha ou resposta do login. Não gerar JWT manualmente nem dispensar as validações da aplicação. Capturar a resposta da RPC apenas por status e rótulo de rota usando a fixture sanitizada.

Referências: [configuração local do projeto](../../../../supabase/config.toml), [hook do projeto](../../../../supabase/migrations/0008_E00-S09_resolver_hook_permissoes.sql), [autorização da ação](../../../../supabase/migrations/0246_E01-S170_modulos_elegiveis.sql), [configuração oficial de hooks GoTrue](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks).

## Evidência do ensaio de Grupo

Em 2026-11-04, um ensaio sintético com hook JWT ativo passou por login real, prévia e declaração PCM usando componente real, GoTrue e PostgREST em rede Docker interna e clone separado. A declaração foi persistida uma vez; a fila permaneceu em verificação. Rotas e status sanitizados estão em `evidencia-2026-11-04.txt`. A página de montagem, o proxy e a fixture usados foram temporários; portanto essa evidência não torna o harness reproduzível e não cobre navegação completa do aplicativo, concorrência, Visita ou homologação. GoTrue aplicou suas migrations no clone; nenhum Auvo foi acionado.

Para reconstruir este recorte, ainda de forma manual:

1. Provisionar uma rede Docker interna sem portas externas, PostgreSQL dedicado e banco `sso_s166_teste`; restaurar uma cópia do banco-base isolado com ACLs e aplicar migrations 1614–1683. Atestar pelo PostgREST que a conexão alcança o clone antes de inserir dados.
2. Iniciar GoTrue e PostgREST na mesma rede e namespace do navegador, com `GOTRUE_JWT_AUD=authenticated` e o hook informado acima; usar chaves efêmeras exclusivas do ensaio. GoTrue atualizou tabelas de autenticação no clone.
3. Carregar `supabase/tests/manual_E01-S166_grupo_fila_fixture.sql` no clone; preparar série e ciclo, entrada em `verificacao` e gates necessários com os comandos iniciais de `supabase/tests/manual_E01-S166_grupo_fila_afirmacao.sql`. Ajustar a conta sintética para login real e confirmar em memória o claim do papel emitido pelo hook.
4. Montar `ConferirGrupoFila` numa página temporária com QueryClient e o cliente Supabase real; expor o proxy Auth/PostgREST somente em `127.0.0.1` no namespace interno e servir a página localmente. Fazer login sintético, informar fontes e motivo, confirmar e registrar a declaração. Não enviar dados ao Auvo.
5. Conferir resposta da prévia e declaração, uma declaração persistida e fila ainda em `verificacao`. Capturar apenas rotas/status sanitizados. Remover banco, serviços, rede, dependências e imagem usados exclusivamente no ensaio.

Este roteiro descreve a preparação realizada; não há script de automação, teste `.spec.ts` ou proxy versionado. A validação de toda a jornada no aplicativo permanece pendente.

## Bootstrap do banco descartável

`bootstrap-interno.py` cria rede Docker interna e PostgreSQL dedicado, sem portas publicadas nem mounts. O comando `carregar` valida identidade/isolamento antes de restaurar uma cópia do banco-base sintético `sso-validacao-isolada-20261104`, preserva ACLs e aplica migrations 1614–1735. Execute apenas com esse banco-base isolado, nunca com produção. Requer imagens locais e Docker; não baixa imagens. O ID é escolhido pelo executor e pertence apenas ao ensaio.

```sh
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py criar --id 32bd19ca417e
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py carregar --id 32bd19ca417e
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py servicos --id 32bd19ca417e
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py login --id 32bd19ca417e
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py navegador --id 32bd19ca417e
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py login-navegador --id 32bd19ca417e
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py verificar --id 32bd19ca417e
python3 apps/web/e2e/s166-isolado/bootstrap-interno.py remover --id 32bd19ca417e
```

Testado em 2026-11-05: criação, restauração de 98 migrations, verificação e remoção passaram. Senhas e chave JWT são efêmeras e sintéticas. GoTrue e PostgREST responderam 200 na rede interna, sem portas publicadas. O comando `login` cria conta sintética no clone, autentica pelo GoTrue, confere claim em memória e consulta o próprio usuário via PostgREST; foi executado com sucesso sem expor senha ou token. A imagem oficial Playwright 1.61.1 local e o pacote `playwright-core` do repositório permitem iniciar Chromium sem portas ou mounts, sob usuário não privilegiado na mesma rede interna. O teste `login-navegador` autenticou conta sintética no navegador e consultou o PostgREST sem exibir token ou senha. Este bootstrap ainda não serve a interface nem executa jornada S165/S166, portanto não comprova a jornada integrada de negócio. Em caso de falha durante `carregar`, remova os recursos e recrie; não reutilize banco parcialmente restaurado.

## Jornada sintética de revisão e Visita

`python3 apps/web/e2e/s166-isolado/executar-jornada.py` constrói uma página de ensaio com os componentes reais, cria clone e serviços na rede interna, autentica conta sintética, aprova revisão pela interface usando a guarda 1045 real e prepara Visita pela interface. Após aprovação, adianta o relógio civil apenas no clone e executa retirada da fila anterior pela interface do painel de Preventivas; não comprova navegação completa do produto nem execução em campo. Os recursos temporários são removidos ao final; imagem local de navegador é preservada. Não usa `.env.local`, servidor existente, credenciais reais ou Auvo.

Executado com sucesso em 2026-11-05, incluindo verificação do estado aprovado e duas ocorrências preservadas no clone. Requer imagem Playwright 1.61.1 e dependências locais, além do banco-base sintético identificado no bootstrap. Flags são ligadas somente no build do ensaio.

## Exceção de Visita e mudança de dia

`python3 apps/web/e2e/s166-isolado/executar-excecao.py` usa componentes reais para aprovar uma exceção e alterar o dia no clone sintético. Verifica preservação da Visita com exceção, confirmada, extra, reprogramada e OS, além do movimento de Visita elegível. Executado com sucesso em 2026-11-05. Não acessa Auvo; os IDs externos na fixture são sintéticos. Os recursos temporários são removidos; a imagem Playwright permanece local conforme solicitação.

## Vínculo legado existente e fila

`python3 apps/web/e2e/s166-isolado/executar-legado.py` prepara relação e ocorrência sintéticas no clone, usa a interface real para escolher a ocorrência legada, vincular e incluir a preparada na fila Aguardando; verifica ponte, estado e ausência de OS. Executado com sucesso em 2026-11-05 com backend 1735, rede interna e conta sintética. A preparação inicial e declaração de relação são feitas por comandos no clone; o ensaio não demonstra a navegação completa do produto nem cobre Auvo.

## Comparação obsoleta por avaliação legada

`python3 apps/web/e2e/s166-isolado/executar-comparacao.py` cria dados sintéticos, exibe a comparação pela interface, insere avaliação no clone e tenta decidir usando a fotografia anterior. A função de decisão recebe instrumentação temporária com sequência não transacional para contar tentativas; essa alteração existe apenas no clone descartável. Em 2026-11-05, com migration 1743, a RPC executou uma vez, rejeitou a comparação e a interface reconsultou e apresentou o alerta. A fixture prepara a relação e decisão anterior por SQL; o ensaio não comprova navegação integral nem homologação.

`executar-revisao-obsoleta.py` usa a mesma instrumentação e altera apenas a revisão do Plano no clone após a conferência. Com 1744, a decisão foi rejeitada em uma execução e a interface pediu nova conferência; as listas mediadas também rejeitam a revisão antiga sem `40001`.

`executar-conflito-reserva.py` altera a revisão após a prévia de reserva de Calendário em rascunho e verifica que a interface libera nova conferência. `executar-conflito-visita.py visita-escolha` consulta uma Visita candidata e altera a revisão no clone antes da escolha; a interface reconhece a rejeição e pede nova conferência. Os dados e alterações são sintéticos e os dois ensaios foram executados sem Auvo.

`executar-conflito-lote.py` consulta prévia e envia comando de lote com revisão obsoleta via HTTP autenticado. Ambos responderam `P0015`; o estado aprovado e os gates necessários foram ajustados somente na fixture do clone. A política de replay multirrotina foi testada separadamente na interface com respostas simuladas.

`executar-preparo-visita-conflito.py` autentica conta sintética e envia preparações individual e em lote com revisão obsoleta, verificando `P0016` por HTTP. Os gates foram ligados no clone; os testes de interface para primeira rejeição e replay incerto usam respostas simuladas.

`executar-origem-rotina-conflito.py` verifica `P0017` por HTTP na consulta e na declaração com revisão obsoleta. `executar-origem-rotina-replay.py` declara origem, altera a revisão apenas no clone e confirma que a repetição do mesmo pedido devolve o recibo anterior. As fixtures e credenciais são sintéticas.

`executar-regra-conflito.py` verifica `P0018` por HTTP na prévia de mudança de dia com revisão obsoleta; os testes de interface cobrem separadamente primeira rejeição e replay incerto. O ensaio não cobre as decisões de feriado nem todos os caminhos de regra.
