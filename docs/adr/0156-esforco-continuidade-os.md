# ADR-0156 — Esforço restante da OS de continuidade

Status: proposta, não homologada.

O modelo canônico existente contém `minutos_restantes` e `os_continuacao_id` na proposta de continuidade; a estimativa de `visita_ordens_servico` pertence ao vínculo de Visita e não equivale ao esforço global da OS. Enquanto não houver campo canônico de esforço na OS, manter a proposta aprovada como fonte rastreável do esforço da OS de continuidade, sem criar estimativa de Visita ou atribuir horas executadas à continuação. Uma única proposta pode originar cada OS; uma vez executada, proposta não pode mudar ou ser apagada. Consulta específica permite recuperar o esforço pela OS com autorização e isolamento de Cliente.

Consulta e comando de aprovação continuam fechados; nenhuma escrita legada é alterada. Integração futura de capacidade deve distinguir esforço global da alocação por Visita, tratar deduplicação e esforço executado e não somar automaticamente ambos. São necessários inventário, testes concorrentes, autorização, revisão adversarial e migração coordenada antes de ativar.
