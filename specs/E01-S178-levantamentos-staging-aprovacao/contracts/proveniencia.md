# Contrato proposto: proveniência de levantamento

**Estado:** proposta não implementada. ADR-0101. A recepção e a homologação permanecem bloqueadas.

## Entrada manual

O comando manual recebe `requestId`, Cliente, chave manual estável, linhas tipadas e, opcionalmente, uma origem **declarada** (`planilha`, `auvo` ou `campo`). O servidor identifica a sessão e verifica capacidade atual. O meio gravado é `manual`; a origem declarada não comprova recebimento da fonte. O comando não aceita em seu payload uma marcação `verificada`, identificador de evento autenticado, caminho de foto ou resultado de aprovação.

Repetir o mesmo `requestId` e conteúdo retorna o resultado anterior; mesmo ID com conteúdo diferente conflita. Idempotência da chave manual é separada de identidades de eventos comprovados. Duas sessões não podem duplicar o mesmo comando/lote. Rejeição não deixa lote parcial, linha ou auditoria parcial. Retentativa após revogação é negada com sessão antiga.

## Integração comprovada

Cada integração terá fronteira própria autenticada, Cliente resolvido no servidor e comprovação do vínculo fonte/evento; payload de operador ou texto corrido jamais declara uma origem comprovada. Identidade, reentrega, conflito, fotos e retenção seguem contrato próprio antes de habilitar o canal. Nenhum teste deve disparar Auvo real sem autorização operacional.

## Compatibilidade e consulta

Lotes anteriores sem prova preservam identidade, conteúdo e histórico e são apresentados como **origem declarada, não verificada**. Nova gravação manual não reserva nem colide com identidade de origem comprovada. Retirar ou restringir a RPC legada requer migração aditiva, consulta de dependências e rollout fail-closed; `0315` concede a RPC legada à role `authenticated`, portanto aplicar `0315` e somente depois uma revogação em `0320` não é uma sequência segura se houver acesso entre as migrações. Não implantar o pacote até existir estratégia comprovada que impeça essa janela. Consultas devem distinguir prova de declaração sem expor outro Cliente.

## Casos de teste obrigatórios

1. Um usuário com capacidade PCM tenta inserir lote verificado Auvo via RPC manual ou RPC legada: negado, sem gravação.
2. Entrada manual com origem declarada Auvo é salva como manual e não verificada; Cliente e ator vêm do servidor. Consulta não apresenta selo de verificação.
3. Lote legado sem evidência continua não verificado, sem alterar UUID, código, conteúdo ou auditoria.
4. Mesmo requestId/entrada retorna mesmo resultado; payload diferente conflita; recepções simultâneas não duplicam; revogação impede replay.
5. Declaração manual não ocupa chave de evento comprovado. Consulta e escrita de outro Cliente negadas, com erro uniforme; anexos continuam privados.
6. Confirmar remoção do acesso direto da RPC antiga e isolamento em todos os pontos de entrada durante o rollout; testar rollback preservando os lotes.

Estes casos são critérios de desenho, não resultados. A implementação exige teste adversarial de concorrência, RLS e CI/db-tests antes de habilitação.
