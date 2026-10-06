# Data Model: Cliente 360 como cockpit operacional

## Scope

E01-S163 não cria tabela nem coluna. Ela compõe entidades existentes em read-models de UI e acrescenta contratos efêmeros. RLS e escopo persistido permanecem nas tabelas atuais.

## Existing persisted entities

### PlanoPreventivo

Campos relevantes: `id`, `nome`, `estado`, `primeira_data`, `intervalo_unidade`, `intervalo_n`, `cliente_id`, `sistema_id`, `equipamento_id`, `questionario_id`, `tipo_tarefa_id`.

Regras:

- Um plano pertence a exatamente um cliente.
- O alvo é sistema ou equipamento, conforme regra existente.
- Sem ocorrência materializada: metadados, alvo, primeira data e intervalo são editáveis.
- Com qualquer ocorrência materializada: alvo, primeira data e intervalo são imutáveis; nome/questionário/tipo podem ser alterados apenas se a regra vigente não alterar evidência passada.
- Pausar não apaga ocorrências; novo ciclo estrutural usa novo plano.

### OcorrenciaPreventiva

Campos relevantes: `id`, `plano_id`, `vencimento`, `visita_em`, `envio_estado`, `auvo_task_id`, `tecnico_funcionario_id`, `resultado_estado`, `os_id`, `os_numero`, `os_status`, `os_concluida_em`.

Regras:

- É materializada quando há linha persistida, independentemente do estado de envio.
- Vencimento, execução, resultado e vínculos históricos não mudam em consequência da edição do plano.
- A ocorrência sempre herda o escopo do cliente do plano; leitura não aceita ocorrência órfã no drawer.

### OrdemServicoOperacional

Campos relevantes: identidade, título, cliente, status, prioridade, técnico, datas, `chamadoId`, `auvoTaskId` e origem.

Regra de projeção:

- `ehOsRegistroVisita(ordem)` igual a `true` exclui o registro de backlog, histórico, KPI e timeline de manutenção.
- A exclusão não altera a linha persistida e não afeta agenda/apontamento/auditoria.

### SiglaHierarquica / IdentificadorAtivo

Valor lógico composto por níveis do caminho, siglas de três caracteres e sequência.

Regras:

- Sugestão é estado de formulário, não dado persistido.
- Aplicar sugestão recalcula a prévia.
- Salvar valida formato e unicidade e persiste as siglas ausentes antes/na mesma operação lógica de criação ou atualização do ativo.
- Identificador existente não é substituído automaticamente.

## Ephemeral view models

### Cliente360UiState

```text
clienteId: UUID
grupoAtivo: operacao | ativos | gestao
abaAtiva: string
filtrosPorAba: Record<Aba, Filtros>
visaoPreventivas: lista | timeline | calendario
detalhe: ContextoDetalhe360 | null
```

Invariantes:

- `clienteId` é obrigatório para qualquer detalhe ou coleção.
- Ao mudar `clienteId`, `detalhe` vira `null` e resultados anteriores não são renderizados.
- A preferência `visaoPreventivas` pode ser persistida no navegador; filtros não precisam sobreviver a outra sessão.

### ContextoDetalhe360

União discriminada:

```text
{ tipo: "os", id, clienteId, originElementId }
{ tipo: "chamado", id, clienteId, originElementId }
{ tipo: "ocorrencia_preventiva", id, clienteId, originElementId }
{ tipo: "plano_preventivo", id, clienteId, originElementId }
```

O `clienteId` recebido deve coincidir com a entidade carregada. Divergência produz estado “não encontrado/não autorizado”, nunca fallback para consulta global.

### FiltrosEstrutura

- `busca`: string normalizada
- `tipos`: conjunto de ids
- `areasRaiz`: conjunto de ids
- `vinculoAtivos`: todos | com_ativos | sem_ativos

A árvore filtrada inclui matches e ancestrais necessários.

### FiltrosComponentes

- `busca`: nome/identificador
- `categorias`, `areas`, `locais`, `sistemas`: conjuntos de ids
- sentinel `sem_sistema`
- `situacao`: todas | ativos | inativos
- `syncAuvo`: todos | ok | pendente | erro | sem_vinculo

### FiltrosSistemas

- `busca`: nome/identificador
- `categorias`, `areas`, `locais`: conjuntos de ids
- `composicao`: todos | com_componentes | sem_componentes

### FiltrosFerramentas

- `busca`: nome
- `categorias`: conjunto de ids
- `alocacao`: todas | ativa | devolvida
- `alocadaDe`, `alocadaAte`: datas opcionais e inclusivas

## State transitions

### Plano preventivo

```text
rascunho --ativar--> ativo --pausar--> pausado --retomar--> ativo
```

- Edição estrutural é permitida em qualquer estado somente se `ocorrencias.length === 0`.
- Com ocorrência, “Editar recorrência/alvo” é substituído por “Pausar e criar novo plano”.
- Não é criado novo estado persistido nesta story.

### Drawer

```text
fechado -> carregando -> pronto | erro
pronto -> mutando -> pronto | erro
qualquer -> fechado
```

Troca de cliente força `fechado` e invalida respostas tardias pelo escopo da query key.

## Validation

- Intervalo preventivo positivo e unidade suportada.
- Datas válidas e período de filtro com início menor ou igual ao fim.
- Siglas no formato já aceito pelo domínio; colisões apresentadas no nível responsável.
- Filtros desconhecidos vindos de preferência antiga são ignorados com defaults seguros.
