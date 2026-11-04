# ADR-0168 — Código provisório isolado no levantamento

## Contexto

Os cadastros oficiais não distinguem rascunho e podem sincronizar com Auvo na criação. Não é seguro inserir registro oficial nem criar ciclo vazio para simular rascunho.

## Decisão

Preparar edição versionada de candidato a código exclusivamente para linha ainda pendente de levantamento. O candidato é mantido em tabela privada ligada à origem, sem alterar o código informado na fonte, criar ativo oficial, etiqueta, vínculo a OS ou intenção Auvo. Revisão e requestId protegem concorrência e repetição; auditoria registra mudanças. O fluxo e sua leitura ficam revogados e com gate próprio desligado.

## Limites

Candidato não é código reservado: outros escritores podem usá-lo até incorporação. 0359 ainda não consome o candidato automaticamente; incorporação precisa conferir colisões e registrar marco/ciclo de modo atômico antes de ativação. Não se aplica a Grupo, que não tem modelo de código compatível; nem transforma legados em rascunhos. Faltam validação, recuperação, integração, autorização e revisão adversarial.
