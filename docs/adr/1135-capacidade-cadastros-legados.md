# ADR-1135 — Capacidade na escrita de cadastros legados

Status: proposta local, gate fechado; não aplicada nem homologada.

Áreas, Locais/Sublocais, Sistemas e Equipamentos/Componentes existentes mantêm identidade e políticas legadas. Uma guarda aditiva, desligada inicialmente, exige `cadastro.gerir` no Cliente de origem e destino para escrita autenticada, inclusive chamada direta ou por função privilegiada. Para Locais, Cliente é derivado da Área travada; mudança de Área é conferida em ambos os lados. Cliente ausente é recusado enquanto a proteção estiver ativa.

O processamento interno `service_role` possui gate próprio, também fechado, pois sincronizações e importações precisam de inventário e rollout coordenado. O gate de serviço não autoriza usuários autenticados e não substitui o isolamento da credencial. A guarda não altera políticas de leitura, não atribui capacidades automaticamente e não resolve vínculos de Sistemas ou demais tabelas. Nenhuma ativação antes de inventário dos escritores, concessões, efeitos de cascata e Auvo, teste de duas sessões, locks, revogação, service role, FORCE RLS e revisão adversarial.
