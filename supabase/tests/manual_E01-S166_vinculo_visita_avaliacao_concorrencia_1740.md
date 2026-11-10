---
name: "supabase-tests-manual-e01-s166-vinculo-visita-avaliacao-concorrencia-1740-md"
description: "Documento Sinérgica SO: Avaliação concorrente ao vínculo de Visita"
alwaysApply: false
---

# Avaliação concorrente ao vínculo de Visita

Usar clone isolado com migrations até 1740. Preparar `manual_E01-S166_vinculo_visita_avaliacao_1740.sql` até imediatamente antes da inserção da avaliação, mantendo e confirmando apenas a preparação sintética. Usar claims do ator da fixture e chamar a RPC autenticada `pcm.sso_materializar_visita_legada_mediada` com request terminado em 147, preparada 161, plano legado 145 e relação 146.

Na sessão A, inserir avaliação da ocorrência legada terminada em 939 e manter transação aberta. A chamada de materialização na sessão B deve receber `55P03`: no ensaio, a contenção ocorreu no protocolo de reserva 1724 antes de alcançar o núcleo. Reverter ambas. Na ordem inversa, manter a materialização aberta: inserção de avaliação deve aguardar ou atingir `lock_timeout`. Reverter ambas.

O arquivo SQL comprova recusa de avaliação preexistente, caminho positivo e replay idêntico após avaliação tardia. Os dois sentidos concorrentes passaram em clone. Descartar o clone; ensaio não testa serviços externos nem todos os escritores.
