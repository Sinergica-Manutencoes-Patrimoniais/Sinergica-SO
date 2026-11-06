# ADR-0983 — Consulta de retornos parciais

Status: preparação privada, não homologada.

Preparar leitura paginada dos retornos parciais por Cliente, preservando identidade da Pendência, ciclo, parcela, OS e proposta e apresentando a descrição e os minutos restantes congelados no retorno. A lista permanece separada do ranking e dos retornos integrais; não comprova cobertura, parada remota ou elegibilidade para promoção. Mudanças entre páginas não são fotografia transacional.

Gate e EXECUTE ficam fechados. Antes de ativar, concluir promoção exclusiva do restante e unificação segura de fontes, isolamento de Clientes, privacidade do texto, autorização/revogação, consistência de paginação, RLS, concorrência, revisão adversarial e migração dos consumidores antigos. Nenhuma execução externa ou dado de produção deve ser alterado.
