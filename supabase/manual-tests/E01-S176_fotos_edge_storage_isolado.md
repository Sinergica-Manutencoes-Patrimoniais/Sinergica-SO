# E01-S176 — ensaio descartável de fotos cadastrais com Edge e Storage

**Especificação de ensaio; infraestrutura ainda não implementada. Não executado.** Este roteiro
não autoriza deploy, Auvo, acesso a projeto Supabase local existente ou limpeza de recursos alheios.

## Dimensionamento observado em 2026-11-05

- Volume do projeto: 7,8 GiB livres. Não representa automaticamente a cota da VM Docker.
- Banco-base sintético conhecido: `pg_database_size` de 121.212.051 bytes; leitura apenas.
- Sistema de arquivos consultado dentro do container-base: 87.185.452 KiB disponíveis no overlay.
  Esse número não garante que o arquivo de disco da VM possa crescer no volume do host.
- `docker system df` relatou 264,6 MB de camadas graváveis de todos os containers existentes;
  não é uma medição de pico do ensaio novo.
- Imagens PostgreSQL, Auth, PostgREST, Storage e Edge Runtime já estão no cache. Não baixar imagens.
- Os cenários usam arquivos sintéticos limitados a 10 MiB cada. Prever simultaneamente pelo menos
  quatro cópias (envio, objeto, leitura e arquivo de comparação), além de clone de banco, logs e
  camadas graváveis. Não usar 10 GiB como suposto consumo medido.

Antes de criar recursos, capturar espaço livre tanto no volume do host quanto no filesystem de dados
do Docker. Calcular e registrar um orçamento inicial como `2 × pg_database_size(base) + 4 × 10 MiB
+ tamanho gravável efetivo dos containers de ensaio existentes`, tratando o último termo como
estimativa, não limite comprovado. Acompanhar espaço durante cada etapa e abortar antes que o espaço
de host ou VM caia abaixo do orçamento remanescente. Executar somente após demonstrar, por ensaio
controlado e medição do crescimento da VM, que essa guarda funciona; se não houver medição confiável
ou margem suficiente, parar antes de subir serviços. Não apagar imagens, volumes, caches ou dados do
usuário para obter espaço.

## Topologia e pré-condições

1. Criar ID aleatório e rede bridge `--internal` com rótulo exclusivo. Banco, Auth, PostgREST,
   Storage, gateway, duas funções Edge e cliente de teste devem pertencer somente a essa rede, sem
   portas publicadas, bind mounts, privilégios ampliados ou acesso a serviços externos. Verificar
   cada recurso por `docker inspect` antes de transferir dados ou credenciais.
2. Criar PostgreSQL novo e restaurar somente schema, ACLs e seeds oficiais não pessoais necessários;
   aplicar migrations em ordem até 1803. O procedimento de seeds 1303/0434/0437/0445/0465 já foi
   exercitado para 1795, mas não substitui inventário das dependências até 1803. Não usar dump de
   dados de um banco do usuário. Conferir ausência de usuários, Clientes e fila Auvo antes de fixture.
3. Criar credenciais exclusivamente sintéticas, aleatórias e efêmeras para Auth, PostgREST, Storage,
   Edge e gateway. Configurá-las somente nos containers descartáveis; não imprimir, gravar em arquivo,
   inserir em logs ou backups. Banco e serviços devem compartilhar o mesmo segredo JWT sintético.
4. Storage deve usar backend local efêmero dentro do container, bucket privado `sso-grupos-fotos` e
   os metadados do banco descartável. O gateway interno deve encaminhar `/auth/v1`, `/rest/v1` e
   `/storage/v1` aos serviços deste mesmo ensaio. Edge recebe como URL somente esse gateway interno.
   Confirmar por inspeção e por requisições de saúde que nenhum endereço externo é usado.
5. Iniciar Auth com hook de claim `user_role`, PostgREST com schemas e roles necessários, Storage e
   Edge com configuração conhecida e documentada. O bootstrap S166 atual não inicia Storage/Edge;
   não afirmar que está pronto até implementação e inspeção independente da configuração exata.

## Cenários obrigatórios

Criar Cliente, Grupo, usuário e concessões exclusivamente sintéticos. Ativar gates somente no banco
descartável. Exercitar o endpoint real de ingestão e o de leitura, sem mocks de Auth, RPC ou Storage:

- Sem token, papel desatualizado, Cliente diferente e ausência/revogação de `cadastro.gerir` são
  recusados. Revogar durante envio e antes da confirmação; verificar ausência de vínculo indevido.
- Enviar PNG/JPEG pequeno: somente um vínculo, digest dos bytes armazenados e leitura correta.
  Repetir mesmo requestId e bytes após sucesso e após resposta incerta; não criar segunda foto.
- Reusar requestId com bytes ou contexto divergente é recusado. Duas requisições simultâneas com
  mesmo requestId não criam vínculos ou objetos conflitantes.
- Após confirmação, alterar bytes no Storage somente nesse clone e conferir que leitura falha por
  digest. Foto histórica sem digest continua identificada como não verificada. Não inventar digest.
- Verificar bytes inválidos, mais de 10 MiB, tempo esgotado, cancelamento, gate desligado, objeto
  ausente e arquivo pertencente a outro Grupo. Nenhuma resposta expõe caminho, credencial ou URL.
- Conferir que a rota de atestados permanece separada e que a fila Auvo não recebe novos registros.

## Encerramento

Em `finally`, remover exclusivamente recursos com nome e rótulo do ID da execução, após conferir
propriedade; destruir os containers elimina suas credenciais sintéticas. Nunca limpar banco-base,
serviços existentes, volumes ou imagens. Registrar somente resultado de cada cenário, primeiro erro
e prova de limpeza; não registrar tokens, senhas, caminhos privados ou corpo da requisição.
