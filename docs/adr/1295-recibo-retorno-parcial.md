# ADR 1295 — Recibo de devolução parcial

## Contexto

Um retorno parcial pode ser registrado apesar de a resposta não chegar à interface. Repetir o comando é idempotente, mas a consulta do resultado deve ser possível sem nova escrita.

## Decisão

Expor consulta restrita ao ator original e Cliente autorizado, comparando integralmente o pedido com o comando imutável e conferindo o vínculo com o ciclo e retorno atuais. Reutilizar gates e capacidades da devolução. Retornar somente o recibo anterior; não alterar ciclo, OS, Chamado ou Auvo. Recibo ausente não prova falha.

## Implantação e retorno

Migration aditiva e flag de interface desligada. Testar canonicalização, autorização/revogação, transferência de Cliente, commit concorrente, replay, privacidade, RLS/FORCE e revisão adversarial antes de ativar. Desligar a flag reverte a interface sem apagar recibos.
