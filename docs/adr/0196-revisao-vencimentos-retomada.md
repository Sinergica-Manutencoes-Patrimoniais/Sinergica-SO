# ADR-0196 — Decisões preliminares sobre vencimentos na retomada

Status: proposta, não homologada.

Gestor pode consultar ciclos por calendário do snapshot aprovado, em janela explícita de até 366 dias, e registrar decisão preliminar `avaliar` ou `tratar_manualmente` por Rotina/ciclo/data. O comando reconfirma versão e data com o projetor oficial, requer histórico de retomada e autorização individual, serializa no Plano e preserva todas as decisões anteriores. Não cria, cancela ou conclui obrigação, Chamado ou OS; nenhuma decisão é interpretada como dispensa.

Sem reconciliação com execução histórica, PMOC, versões e ocorrências canceladas, os ciclos são candidatos e não prova de obrigação pendente. A decisão não materializa nem agenda serviços. Gate permanece fechado; tratamento efetivo, identificação estável de ciclos entre versões, interface, testes e revisão adversarial são obrigatórios antes de uso.
