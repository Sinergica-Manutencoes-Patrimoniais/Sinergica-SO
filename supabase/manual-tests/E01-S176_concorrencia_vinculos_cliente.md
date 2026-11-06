# E01-S176 — roteiro manual de concorrência de vínculos e hierarquia

**Preparado, não executado.** Exclusivamente banco descartável e isolado, sem credenciais reais,
sem conexão com Auvo, Storage ou produção, com migrations até 1797 instaladas. Nunca executar no
banco compartilhado. As sessões A e B precisam de conexões distintas e devem ser operadas em
paralelo; comandos que aguardam não devem ser interrompidos até registrar resultado.

## Preparação

Criar fixtures sintéticas no banco descartável a partir do padrão de
`supabase/tests/E01-S176_vinculos_cliente_final.test.sql`, usando IDs reservados abaixo. Nesse
ambiente somente, confirmar a criação das fixtures para que ambas as sessões as enxerguem. O
roteiro não usa IDs de Cliente ou pessoas reais e não envia integração; configurar supressão local
de enqueue conforme a infraestrutura do teste. Conferir antes que não existe nenhum dos IDs.

| Objeto | ID sintético | Relação inicial |
| --- | --- | --- |
| Cliente A | `176a0000-0000-0000-0000-00000000000a` | ativo |
| Cliente B | `176a0000-0000-0000-0000-00000000000b` | ativo |
| Sistema A | `176a0000-0000-0000-0000-000000000051` | Cliente A |
| Item X | `176a0000-0000-0000-0000-000000000011` | Cliente A, sem vínculo nem pai |
| Item Y | `176a0000-0000-0000-0000-000000000012` | Cliente A, sem vínculo nem pai |

As fixtures precisam conter nome válido, clientes ativos e colunas obrigatórias atuais. Antes de
cada cenário, conferir identidade, Cliente, hierarquia e vínculos por SELECT. Executar cada cenário
em transações novas, `READ COMMITTED`, com `SET LOCAL app.auvo_sync_write = 'true'` em ambas.
Resultados diferentes dos previstos, deadlock ou timeout são achados; registrar erro SQLSTATE e
estado final, não repetir até documentar. O valor `40001` é uma recusa recuperável; `40P01` mostra
deadlock e precisa de investigação, mesmo que o banco o resolva abortando uma sessão.

## Cenário 1 — Criar vínculo versus mudar Cliente do Sistema

1. A inicia transação, insere vínculo Sistema A–item X e não confirma.
2. B inicia transação e tenta mudar `pcm.sistemas.cliente_id` do Sistema A para Cliente B.
   Registrar se aguarda lock de linha ou retorna `40001`; não assumir qual ocorre.
3. A confirma. Deixar B prosseguir e registrar o resultado: B não pode confirmar mudança que
   mantenha vínculo A–X entre Clientes diferentes. Se B recebeu erro, fazer ROLLBACK.
4. Consultar Sistema, item e vínculo. Confirmar Sistema/Item no Cliente A e vínculo único.

Executar também ordem inversa em fixtures limpas: B inicia mudança de Cliente e mantém transação
aberta; A tenta inserir vínculo A–X; confirmar B e deixar A prosseguir. A não pode confirmar
vínculo entre Clientes distintos. Uma recusa ou `40001` é aceitável; erro diferente precisa ser
registrado. Consultar as três linhas após ambas as sessões terminarem.

## Cenário 2 — Criar vínculo versus mudar Cliente do item

Repetir cenário 1, trocando a operação de B por mudança de `pcm.equipamentos.client_id` do item X
para Cliente B. Exigir mesma propriedade final nas duas ordens. Em qualquer tentativa que falhe,
verificar que não houve atualização parcial, duplicação ou perda do vínculo anterior.

## Cenário 3 — Hierarquia concorrente

1. Em fixtures limpas, A inicia transação e altera pai de X para Y, sem confirmar.
2. B inicia transação e tenta alterar pai de Y para X. Registrar qualquer espera ou erro.
3. Confirmar A, deixar B terminar e registrar SQLSTATE. Nunca podem ser confirmadas as duas
   relações simultaneamente. Em falha de B, ROLLBACK.
4. Repetir com ordem A/B invertida e consultar `parent_item_id` de X e Y após as transações.

Repetir com cadeia maior: criar, antes do cenário, três itens adicionais A/B/C no mesmo Cliente;
preparar B→C e D→A. Em uma sessão propor A→B, na outra C→D. Se confirmadas ambas, haveria ciclo
A→B→C→D→A: o resultado permitido é confirmação de no máximo uma alteração. Registrar bloqueios
e SQLSTATE. Conferir o caminho completo por leitura recursiva limitada, sem presumir ordem de
resolução do escalonador.

## Cenário 4 — Snapshot antigo

Usar fixtures limpas. B inicia `REPEATABLE READ`, faz SELECT para fixar snapshot e tenta inserir
vínculo ou alterar pai/Cliente. A ação relevante deve falhar com `25001`; encerrar B com ROLLBACK.
Repetir com `SERIALIZABLE`. Para avaliar isolamento após commit prévio, preparar a mudança de A e
confirmá-la depois de B fixar snapshot, antes da escrita de B: a escrita relevante de B ainda deve
ser recusada, não depender de snapshot antigo. Não converter essa recusa em autorização para ignorar
concorrência em READ COMMITTED.

## Cenário 5 — Legado, reparo e efeitos

Em fixture sintética previamente preparada **antes** de instalar os guards, simular vínculo entre
Clientes diferentes. Aplicar migrations no banco descartável; verificar que leitura continua e que
DELETE explícito do vínculo é permitido. Não desativar triggers em ambiente compartilhado. Depois
da correção, consultar vínculo e Clientes; nenhum outro item pode mudar. Para alteração indireta,
avaliar `UPDATE local_id/area_id` que derive Cliente após normalização; conferir o Cliente final,
as guardas e o histórico transacional. Requer fixture legada construída previamente: se não
existir, marcar cenário não executado, nunca fabricá-la em produção.

## Encerramento e limpeza

Após cada transação, verificar estado dos IDs sintéticos e ausência de tarefa real ou efeito
externo. Preservar evidências de exceções e de ambos os resultados. Como há auditoria append-only,
não apagar eventos ou alterar triggers para limpar: encerrar conexões e descartar o banco
**descartável** pelo procedimento autorizado do ambiente. A destruição do banco não faz parte deste
roteiro executável automaticamente. Se houver dúvida sobre o alvo, parar e não limpar.
