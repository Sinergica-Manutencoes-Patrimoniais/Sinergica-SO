# ADR-0960 — Transição privada de devolução por ciclo

Status: preparação isolada; não autoriza operação.

Preparar comando transacional que encerra um ciclo de tratamento e registra uma entrada de retorno, sem apagar o vínculo anterior ou alterar OS. O registro mantém Pendência, Cliente, Chamado, parcela, revisão de suspensão, atribuição e reconciliação declarada. O mesmo request retorna o mesmo resultado; uma Pendência não pode ter duas entradas aguardando simultaneamente. Gate próprio fechado e nenhuma execução concedida.

O primeiro caminho exige parcela pendente, Chamado suspenso, atribuição, interrupção e última reconciliação de não execução declarada, além de OS atribuída terminal. Esses sinais administrativos não provam parada remota ou equivalência de todas as fontes de execução. A implementação não cobre parcelas sem atribuição, trabalho parcialmente concluído com continuação, nem impede por si só reabertura, sincronização Auvo ou consumidores legados de tratarem a parcela antiga como ativa. Ela não deve ser habilitada até um protocolo completo de parada e migração coordenada dos leitores/escritores, tratamento do escopo efetivamente restante, revisão adversarial e testes concorrentes.

A fila nova não substitui o Backlog vigente: faltam leitura integrada, nova promoção e invalidação compatível. Não remover constraints existentes nem inferir que declaração humana seja prova de execução.
