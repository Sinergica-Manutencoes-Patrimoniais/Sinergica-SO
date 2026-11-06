# ADR-1395 — Triagem de origem de campo mediada

As telas de triagem, indicação, retificação e recuperação utilizam entradas autenticadas específicas, com permissão global de reconciliação, gates separados e coordenação de autorização. Seleção e alterações preservam a autorização por Cliente exigida pelos núcleos privados; retificação exige acesso aos dois Clientes. A lista de envelopes retorna o ID remoto como texto para preservar precisão.

Nenhuma indicação ou retificação aplica eventos, cria Chamado/OS ou chama Auvo. Gates iniciam fechados. Aplicação, autorização global e por Cliente, revogação concorrente, replay, paginação, RLS/FORCE, isolamento e revisão adversarial exigem validação antes da liberação.
