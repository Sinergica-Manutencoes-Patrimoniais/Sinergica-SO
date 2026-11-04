# ADR-0273 — Proteção transversal de quantidade de Grupo

Prepara-se trigger opcional que recusa alterações de quantidade fora do comando motivado, inclusive pela edição integral ou incorporação de levantamento. O comando recebe autorização transacional privada, consumida pelo trigger e eliminada antes do retorno; aplicações não podem gravá-la. A trava não restringe criação ou atualização de outros campos e não apaga dados.

A proteção nasce desligada, independentemente do gate do comando motivado. Ativá-la antes de liberar o comando impede alterações de quantidade; a interface legada também precisa de orientação para não tentar essa alteração. Execução dos comandos novos continua revogada. Revisar privilégios, concorrência, retries e impactos em todos os consumidores antes de qualquer ativação.
