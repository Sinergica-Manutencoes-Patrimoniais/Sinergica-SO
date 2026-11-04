# ADR-0204 — Recuperação de resolução de origem incerta

## Decisão

Preparar consulta do resultado imutável de resolução pelo requestId e ator original, exigindo autorização global e capacidade atual no Cliente, sem retornar payload externo. A tela recupera tentativas da sessão mesmo depois de o envelope sair da fila; só limpa a tentativa após validar os identificadores retornados.

## Limites

Ausência ou revogação é erro indistinguível; não prova que o comando falhou e não autoriza nova resolução. Dados de sessão podem perder-se após limpeza do navegador; suporte e retenção requerem procedimento. Função revogada e flag de resolução desligada; sem aplicação/testes.
