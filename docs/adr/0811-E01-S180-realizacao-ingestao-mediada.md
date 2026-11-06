# ADR-0811 — Realização com comprovante de ingestão mediada

Status: preparado sob gates fechados; não homologado.

O comando legado exige `owner_id` igual ao usuário, incompatível com objeto criado pelo serviço. Não alterar nem afrouxar o legado. Criar comando específico que exige ator e Cliente atuais, reserva imutável e confirmação do mesmo request, despesa e objeto, além do objeto privado no caminho reservado. Manter locks, revisão, payload idempotente e auditoria; não criar lançamento financeiro.

A confirmação representa o vínculo declarado pelo serviço, não prova de imutabilidade dos bytes: o serviço calcula e confere hash antes de confirmar, e a leitura deve conferir novamente. O comando depende dos gates existentes S180 desligados e da segurança da credencial de serviço. Testes com concorrência, autorização, isolamento, integração Edge/Storage e revisão adversarial são necessários antes de ativar ou implantar.
