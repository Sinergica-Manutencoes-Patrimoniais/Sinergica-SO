# ADR-0599 — coordenação parcial de quantidade por proposta

Status: proposto; gate fechado, não aplicado nem homologado. As operações preparadas de vínculo de material, decisão de serviço e reconhecimento de linha passam a obter lock da proposta antes da verificação agregada quando o gate de coordenação estiver ligado. A soma considera vínculos de materiais e serviços declarados com decisão aceita; ultrapassar quantidade publicada bloqueia a operação. Gate desligado delega aos comandos existentes.

A coordenação exige drenagem de transações iniciadas antes da ativação, inventário dos demais escritores, auditoria da ordem de locks e validação de idempotência e isolamento. Somar quantidades não prova identidade única de execução, aceite contratual adicional ou direito de faturar; continua proibido criar candidato de serviço apenas a partir dessas declarações. Nenhum efeito externo nesta migration.
