# ADR-1177 — Adaptador privado da orquestração T−24

Status: proposta local, não conectada nem homologada.

Preparar adaptador para os comandos privados de reserva, início e registro de resultado. O início só autoriza efeito na primeira resposta positiva; erro ou resposta repetida não deve produzir chamada remota. O registro de confirmação recebe a leitura já comparada pelo orquestrador e normaliza somente o instante equivalente; bloqueio, incerteza ou divergência usam registro conservador. Falha de persistência após início pode gerar observação tardia, sem reativar a tentativa.

O adaptador recebe porta RPC injetada, não cria cliente de produção, não tem credenciais, agendamento ou concessão. IDs de pedido permanecem estáveis somente durante a instância; retomada entre processos requer protocolo persistente e validação adicional. A busca, o contrato do fornecedor e a origem da leitura permanecem não comprovados. Validar as transações, ambiguidade de resposta, perda/reinício, concorrência, payloads, RLS/FORCE e revisão adversarial antes de integrar ou ativar.
