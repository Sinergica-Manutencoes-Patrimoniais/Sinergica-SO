# ADR-1150 — Varredura T−24 e outbox

Status: proposta local, não aplicada nem homologada.

A varredura de efeitos iniciados sem resposta também registra estado de erro conservador na mesma linha da outbox, na mesma transação que marca a tentativa incerta. Bloqueia primeiro a outbox e depois a tentativa e não faz nova chamada externa. Vínculo ausente, estado divergente ou linha disputada são contados como pendência, sem presumir que não houve efeito. O cursor não garante nova visita aos itens disputados: cada nova varredura completa precisa recomeçar sem cursor.

O gate permanece fechado, sem agendamento ou concessão. O início do efeito, produtor, reconciliação, outros escritores e ordem global de locks continuam não integrados. Validar paginação, recomeço, concorrência, replays, valores ausentes, isolamento, bloqueios, rollback e revisão adversarial antes de ativar.
