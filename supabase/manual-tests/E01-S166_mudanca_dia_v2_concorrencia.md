# Ensaio manual preparado — E01-S166 fotografia V2

Não executar até a equipe de dados confirmar um clone descartável, identidade PCM sintética e gate de ensaio. O gate de produção continua fechado.

## Ensaio de volume e atomicidade

1. Criar Cliente, contrato, série e regra em clone; gerar 501 visitas futuras com `visita_origem_contratual`, sem OS remota e sem ocorrências incompatíveis. Guardar IDs e estado inicial.
2. Abrir o gate somente no clone e iniciar uma sessão com `request_id` persistido pelo cliente. Repetir `iniciar` com os mesmos parâmetros e conferir que retorna o mesmo `mudancaId`; repetir com outro parâmetro usando o mesmo ID e exigir `request_id_conflitante`.
3. Ler páginas 0–5; conferir 100/100/100/100/100/1 linhas, cursor estritamente crescente, nenhuma repetição e total 501. Repetir a página 2 e conferir payload idêntico.
4. Selar, conferir digest e comparação bidirecional completa. Alterar uma visita elegível e repetir `selar`: fotografia deve invalidar sem efeito operacional. Para a fotografia nova, alterar uma fonte depois do `selar`; `confirmar` deve abortar integralmente. Em outra chamada/txn, chamar `invalidar`.
5. Fotografar de novo e instalar um trigger de falha temporário que aborte o processamento após uma das transições de teste. `confirmar` deve deixar série, regra, visitas, ocorrências, supressões, transições, auditoria e recibo sem alterações parciais.
6. Remover o trigger de falha, iniciar fotografia limpa e confirmar 501 numa única transação. Comparar todos os estados e contadores antes/depois; nenhuma chamada Auvo/outbox pode ocorrer. Repetir `confirmar` e exigir recibo idêntico e sem segunda aplicação.
7. Fechar o gate. Repetir início com o mesmo `request_id` aplicado e recuperar apenas o recibo. Tentativas de iniciar sessão nova, continuar página ou confirmar sessão não aplicada devem falhar.

## Corridas de dois clientes SQL

Executar cada cenário em dois terminais com `lock_timeout` curto; preservar logs e tempos.

**Escritor vence primeiro (ordem A):** sessão A inicia `UPDATE pcm.visitas` ou associação OS e pausa após obter locks de linha; sessão B executa `sso_confirmar_mudanca_dia_v2`. O trigger do escritor deve adquirir a trava de série primeiro e B falhar com conflito sem aguardar locks de linha. A confirma e commita; novo snapshot precisa incluir a alteração.

**Confirmação vence primeiro (ordem B):** sessão B confirma enquanto sessão A tenta atualizar visita, mudar regra/série, inserir origem, associar OS, alterar OS/Auvo, registrar reprogramação, alterar ocorrência ou inserir/revogar supressão. A deve falhar rapidamente pelo try-lock, sem commit parcial. Depois de B commitar, repetir A e conferir as precondições atuais.

**Ordem inversa multi-série:** em duas sessões, transacionar duas séries em UUIDs invertidos através dos escritores que atingem mais de uma série. Todos os locks tentados em ordem UUID; conflito deve abortar a operação inteira, sem deadlock.

Repetir em isolamento `REPEATABLE READ`: confirmar deve rejeitar antes de efeitos. Registrar `pg_stat_activity`, waits, locks, WAL, CPU, duração e pico de memória nos volumes 501, 1.000 e 5.000; somente esses resultados definem orçamento operacional configurável. Não ajustar limite por extrapolação.
