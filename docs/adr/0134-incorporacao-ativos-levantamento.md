# ADR-0134 — Incorporação de ativos do levantamento

## Estado

Proposta para E01-S178, não aplicada nem homologada. Complementa ADR-0127.

## Decisão

Preparar comando transacional privado para incorporar uma linha de Sistema, Equipamento, Componente ou Grupo Quantitativo. O PCM informa explicitamente Local, classificação, vínculo funcional e código definitivo; referências devem pertencer ao Cliente do lote e estar ativas. O código informado no levantamento, se presente, deve ser preservado exatamente; não atualizar ou substituir códigos existentes. Usar tabelas oficiais, com auditoria e vínculo imutável à linha, revisão e requestId. Linha rejeitada ou já incorporada não pode ser reaprovada. Uma linha por transação permite aprovação parcial explícita.

## Limites e gates

O comando fica revogado para papéis da aplicação, sem conexão à interface, e protegido por gate de banco privado iniciado desligado. Se existir referênciaPai no staging, esta precisa estar incorporada no mesmo lote e corresponder à Área, Local ou Equipamento selecionado. Triggers legadas podem criar intenções de sincronização Auvo; não ligar o gate nem executar comando até revisar sua compatibilidade, políticas de ativação e efeitos externos. A proteção E01-S177 ainda não prova reserva de códigos contra todos escritores legados. A detecção de duplicidade por nome é apenas conservadora e não substitui conferência humana nem vincula cadastros existentes. Faltam edição de linhas, incorporação de atualizações e vínculos a registros existentes, resolução completa de duplicidades, aprovação em lote, reversão lógica, integração de interface e provas de autorização, concorrência e idempotência. Não aplicar nem conceder acesso antes de testes e revisão adversarial.
