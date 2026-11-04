# ADR-1024 — Vencimentos por calendário em data declarada

Status: preparação privada, não homologada.

Preparar consulta paginada de ocorrências de Rotina por calendário cujo vencimento original coincide com uma declaração ativa do Cliente. O vencimento não é deslocado e a consulta não altera, conclui ou reprograma ocorrência. Para declaração específica de contrato, indicar que aplicabilidade precisa ser conferida, pois este recorte de Plano não comprova contrato associado.

O alerta não comprova execução ou pendência efetiva, nem cobre todas as fontes legadas. Exigir ator, autorização, gates e coordenação de feriados; função nasce privada. Validar escopo, privacidade, paginação, RLS/FORCE, concorrência e revisão adversarial antes de liberar.
