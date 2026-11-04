# ADR-0187 — Capacidade explícita de cancelar Visita

Status: proposta, não homologada.

O catálogo inclui `visita.cancelar` no módulo PCM, nível escrita, gerenciável pelas concessões individuais e perfis existentes. Cadastro da ação não concede acesso a nenhum usuário ou perfil; autorização continua exigindo usuário ativo, acesso ao módulo e concessão efetiva global ou para o Cliente. Não há concessão automática a superadmin. A transição de Visita da ADR-0183 mantém gate fechado, RPC revogada e demais bloqueios.

Antes da ativação, revisar operadores e escopo das concessões, concorrência e revogação, testar toda a jornada e conciliar efeitos remotos e OS; registrar concessões apenas por fluxo administrativo autorizado e auditado.
