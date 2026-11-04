# ADR-0509 — Materialização conservadora por identidade canônica

Status: preparado, gates desligados, não aplicado nem homologado. O comando processa um ciclo na janela da implementação 0337, calcula a identidade 0731 e registra uso por versão. Ocorrência anterior só é reutilizada se sua série/índice/regra/âncora/identidade coincidirem; coincidência apenas de data com outra regra é bloqueada para reconciliação. Quando não existe, usa 0337 e identifica o ciclo na mesma transação; não cria OS ou tarefa.

Registros existentes não são apagados ou reescritos. O caminho antigo 0337 permanece disponível apenas sob seus próprios controles e ainda pode ignorar a nova identidade: antes de qualquer ativação é necessário inventariar e proteger todos os escritores, solucionar fuso de referência UTC, concorrência/locks, migração de dados, testes e revisão adversarial. Visitas requerem identidade própria.
