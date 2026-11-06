# ADR-0473 — Guarda de identidade contratual

Status: preparada, gate desligado, não aplicado nem homologado. Um trigger opt-in serializa todas as novas origens 0313 pelo lock da série, recusa série/semana já existente e semana com supressão registrada por 0693. O próprio 0693 usa o mesmo lock e possui unicidade série/semana em seu histórico. A ativação da guarda recusa duplicatas preexistentes; com gate desligado não altera o legado.

A guarda não substitui constraint física global e não resolve corrida durante a própria ativação sem procedimento de manutenção/locks, ou escritores que desabilitem triggers. É necessário inventariar/sanear duplicatas, revisar isolamento e ordem de locks, testar geração concorrente, reconciliação de supressões e efeitos legados antes de habilitar qualquer gate. Sem acesso Auvo.
