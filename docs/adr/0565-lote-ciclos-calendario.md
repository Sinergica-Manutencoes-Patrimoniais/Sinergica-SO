# ADR-0565 — Lote atômico de ciclos por calendário

Status: preparado, gates fechados, não aplicado nem homologado. Processa uma Rotina de versão aprovada na janela inclusiva de hoje civil até +30 dias, com limite de 31 ciclos, utilizando 0734/0766 para identidade canônica, vigência, origem e fuso congelado. Retry usa a mesma chave; uma falha reverte o lote inteiro. Não cria OS, tarefas ou retroativos.

A lista não comprova fonte completa de feriados, e o lote não conclui integração legada ou fila oficial. Dependências, verificações de fuso/DST, concorrência, locks, fontes antigas e revisão adversarial permanecem antes de ativação.
