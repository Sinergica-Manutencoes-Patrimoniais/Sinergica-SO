# Preflight de proprietário e ACL — aprovação 1804/1805

O SQL de mesmo nome é somente de leitura e termina em `ROLLBACK`. Use `psql -X -v
ON_ERROR_STOP=1 -f E01-S165_preflight_owner_1804_1805.sql` com conexão e operador autorizados,
após confirmar o destino. Primeiro avaliar em clone descartável; a execução em destino real é uma
etapa separada e não foi realizada. O operador precisa conseguir consultar catálogos, gates e token;
se não puder, a falha não autoriza conceder privilégios automaticamente.

O preflight exige os dois gates presentes e desligados, tabelas privadas com RLS/FORCE, ausência de
privilégios diretos ou herdados para os papéis de aplicação nas tabelas privadas, bordas executáveis
por `authenticated` e não por `anon`, helper privado, proprietários `SECURITY DEFINER` com
`BYPASSRLS` ou superusuário, permissões de acesso/trava explicitamente verificadas e marcadores do
ciclo de token nas funções. Exige privilégios de tabela inteiros, uma condição conservadora que pode
recusar configuração válida baseada apenas em privilégios por coluna. Exceções relatam somente
nomes de objetos/papéis/permissões, sem conteúdo dos dados.

Um PASS é apenas fotografia de configuração sob o snapshot da consulta. Não demonstra concorrência,
segurança de outras funções ou permissões não verificadas, ausência de tokens em transações ainda
não confirmadas, deploy, integridade de código/markers além da presença examinada, nem autoriza
habilitar gates. O preflight é intencionalmente incompatível com gates já ativos e precisa de revisão
específica para ambientes nessa condição; não os desligue para fazê-lo passar.
