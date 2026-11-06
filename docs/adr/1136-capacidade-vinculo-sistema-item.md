# ADR-1136 — Capacidade no vínculo Sistema–Componente

Status: proposta local, dependente da ADR-1135, não aplicada nem homologada.

Quando a proteção de cadastros legados estiver ativa, a escrita em `pcm.sistema_itens` exige `cadastro.gerir` sobre o Cliente de cada Sistema e Equipamento/Componente envolvido. Novos vínculos devem ter as duas pontas no mesmo Cliente. Para permitir saneamento de vínculos legados divergentes, a remoção exige autorização sobre ambas as pontas, sem exigir que já coincidam; atualização confere os vínculos antigo e novo.

A guarda é aditiva, usa os gates desligados da ADR-1135, não modifica nem apaga vínculos e não cobre outras relações. Ativação requer inventário, autorização, concorrência com transferência de propriedade, ordem de locks de todos os escritores, comportamento de importação/Auvo, FORCE RLS e revisão adversarial. Serviço interno continua dependente de gate próprio e rollout coordenado.
