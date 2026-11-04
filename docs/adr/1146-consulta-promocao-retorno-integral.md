# ADR-1146 — Consulta da promoção de retorno integral

Status: proposta local, gate fechado; não aplicada nem homologada.

Permitir consulta do recibo imutável de promoção de retorno integral por Cliente e retorno, aos mesmos perfis que podem promover. Confirmar propriedade do retorno e dos Chamados anterior e novo antes de retornar o recibo. A leitura não promove, cria OS, reenvia tarefa ou comprova execução e parada remotas.

Exige validação de autorização atual, mudança de Cliente, concorrência, privacidade, RLS/FORCE e revisão adversarial antes de ativação. Ausência de recibo não prova que nenhuma ação externa ocorreu.
