# ADR-0459 — diagnóstico da origem de snapshot Auvo

Status: proposto; não aplicado nem homologado. O webhook possui verificação HMAC em código, mas a própria implementação registra pendências de validação com entrega real. A tabela `pcm.auvo_task_snapshots` guarda payload bruto e metadados, sem prova persistida por evento de assinatura validada, unicidade de recepção, vínculo de reconciliação ou integridade da cadeia. Assim, não é fonte comprovadamente autenticada para resolver ocorrência ou autorizar retry.

A projeção preparada apenas informa se há snapshot local para OS e task já vinculadas, sem entregar payload ou inferir autenticidade, unicidade remota, ausência ou sucesso. Requer capacidade no Cliente e gates fechados; nenhuma consulta Auvo é realizada. Uma futura evidência autenticada requer origem comprovada, autenticação validada, imutabilidade, correlação e testes; snapshots existentes não são promovidos retroativamente.
