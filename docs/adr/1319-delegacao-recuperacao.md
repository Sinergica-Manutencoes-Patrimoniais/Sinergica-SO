# ADR-1319 — Delegação da recuperação ao fluxo proprietário

## Decisão

A reconciliação pode preparar e encaminhar uma solicitação ao proprietário
da integração somente após consultar candidatos e aplicar a política de
recuperação. O proprietário recebe identidade, versão e requestId estáveis e
deve revalidar autorização, ausência de efeito, revisão, prazo e idempotência
na mesma fronteira em que decide executar. A reconciliação não faz POST Auvo
nem interpreta erro de rede como ausência de efeito.

Consulta incompleta exige nova consulta; candidato único exige vínculo
validado pelo proprietário; conflito exige decisão auditada; erro permanente
ou limite de tentativas exige revisão manual. Nenhum desses casos dispara
retentativa. O coordenador não registra sucesso quando o resultado delegado
é desconhecido.

## Limites e implantação

O contrato é uma composição interna, sem endpoint, agendador ou integração
real habilitada. Ainda é necessário implementar os adaptadores dos fluxos
proprietários e a persistência transacional do resultado. Validar autenticação,
permissões, concorrência entre operadores, resposta perdida, prova de ausência,
contrato externo, limites de tempo e revisão adversarial antes de habilitar.

A adaptação da busca de identidade T−24 usa a decisão conservadora existente:
busca incompleta ou inválida continua inconclusiva; correspondência individual
precisa ser informada pelo proprietário, e candidato único exige validação
adicional; múltiplos candidatos exigem decisão auditada.
O adaptador não prova que o contrato Auvo, a revisão ou a cobertura sejam reais.

A composição limita a espera pelo proprietário a 15 segundos. Expiração não
cancela a operação nem prova ausência de efeito: o resultado permanece incerto
e o mesmo requestId deve ser consultado no proprietário antes de novo efeito.
As leituras de candidatos e da tentativa também têm prazo de 15 segundos;
falha ou expiração antes da delegação impedem o encaminhamento e exigem nova
consulta. O prazo não garante cancelamento da leitura subjacente.

A composição interna de recuperação Auvo exige autorização e contrato
comprovado antes de consultar identidade. A porta proprietária continua
responsável por revalidar todos os fatos e a idempotência no comando final;
nenhuma implementação de rede é fornecida nesta etapa.

O adaptador de busca reutiliza a paginação T−24 e exige extrator de ID
fornecido pelo contrato externo. Resultados inválidos, duplicados ou sem
cobertura completa tornam a busca inconclusiva; nenhum adaptador externo real
fica habilitado por essa composição.
