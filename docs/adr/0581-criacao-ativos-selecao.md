# ADR-0581 — Criação selecionada de ativos

Status: proposta; gate fechado, não homologada.

O PCM seleciona até 50 Sistemas, Equipamentos ou Componentes, com retratos de linha, Local, código e sua revisão e, quando aplicável, Sistema e Equipamento pai. A função chama o comando canônico 0397 com aprovação vigente, autorização por Cliente e revisão encadeada. Atributos não suportados são recusados para não serem descartados. Falha em qualquer item reverte o lote integralmente; cada resultado é identificado e a tentativa é idempotente.

As migrations 0032 e 0095 associam a criação dos ativos à função `fn_auvo_enqueue`; sua versão 0051 retorna antes de gravar outbox ou disparar HTTP quando o GUC transacional `app.auvo_sync_write` é verdadeiro. O comando define essa salvaguarda antes de qualquer criação e a restaura ao terminar. Isto é evidência estática, não prova integrada de todos os caminhos ou do ambiente implantado: revisar gatilhos, segurança e executar testes antes de habilitar. Não há chamada direta ao Auvo. RPC e gates permanecem fechados; interface pendente.
