# Limpeza excepcional do clone de recorte

Use somente se o harness informar que a limpeza não foi comprovada. Espere o processo do ensaio
terminar e preserve sua saída: ela identifica o valor hexadecimal exclusivo de `sso.recorte` e a
rede esperada `sso-recorte-<identidade>`. Se não houver identidade inequívoca, pare.

1. Liste apenas containers e rede com esse rótulo, usando o valor exato informado pelo harness:
   `docker ps -a --filter label=sso.recorte=<identidade> --no-trunc` e
   `docker network ls --filter label=sso.recorte=<identidade> --no-trunc`.
2. Inspecione cada ID completo e confirme rótulo, nome esperado (`sso-recorte-<identidade>-db`,
   `-auth`, `-rest` ou `-storage`), imagem e mounts. Confirme que nenhum outro ensaio usa o
   recurso. Não remova nada com nome, rótulo ou identidade divergente.
3. Verifique quais volumes são exclusivamente do ensaio e se não existiam antes dele. Se isso
   não puder ser demonstrado, preserve-os e registre a pendência. Somente após essa conferência,
   remova pelo ID completo os containers identificados e seus volumes comprovadamente exclusivos.
4. Confirme que não restam containers com aquele rótulo e remova pelo ID completo apenas a rede
   cujo nome e rótulo coincidem com a identidade. Liste novamente para comprovar o resultado.

Não use `docker prune`, remoção por prefixo amplo, nem altere o banco de referência ou os serviços
do usuário. Se o Docker estiver indisponível ou a exclusividade não puder ser comprovada, não
apague o recurso e reporte a falha de limpeza.
