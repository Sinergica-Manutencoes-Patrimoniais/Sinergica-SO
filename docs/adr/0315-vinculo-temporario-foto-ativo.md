# ADR-0315 — Vínculo temporário de foto de levantamento a ativo

Prepara-se associação privada de proveniência para foto aceita por humano e linha já incorporada em Sistema ou Componente do mesmo Cliente. A associação não copia o objeto, não modifica `url_imagem`/`uri_anexos`, não altera o cadastro legado e não publica automaticamente. Exige capacidades de aprovação e gestão, revisão da decisão e request id idempotente.

Este vínculo é **temporário e não é fonte canônica** para fotos dos ativos. Antes de ativá-lo, é necessário definir e implementar reconciliação com modelo oficial e consumidores existentes, retenção, tratamento de decisões posteriores, leitura mediada autorizada e migração compatível. Gate e execução fechados; testes e revisão adversarial obrigatórios.
