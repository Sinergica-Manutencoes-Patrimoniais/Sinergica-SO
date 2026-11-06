# ADR-0217 — Intervalos declarados para conferência de capacidade

Status: proposta, não homologada.

Não foi identificada fonte existente de férias/ausências ou reservas de pessoas além dos totais semanais declarados em S172; reserva de ferramentas não representa disponibilidade humana. Intervalos manuais tipados vinculam-se à declaração semanal, com fuso explícito, referência informada e autorização atual. Comando serializa pela disponibilidade, impede sobreposição entre intervalos do mesmo registro e preserva origem e auditoria. Não modifica totais nem subtrai valores automaticamente: não se sabe se o intervalo já está incluído nos totais.

Gate e funções ficam fechados. Sem integração com RH, outros Clientes, datas de expediente ou intervalos trabalháveis, não há disponibilidade comprovada nem deduplicação global por funcionário. Retificação, cancelamento, privacidade, conciliação de totais, testes e revisão adversarial seguem pendentes.
