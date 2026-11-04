# ADR-0251 — Comunicação de visita publicada ao Portal

Status: proposta; não ativar antes de revisão e testes de isolamento e concorrência.

O PCM publica texto próprio e data da visita para uma OS vinculada, sem expor observações internas. A publicação captura a revisão da visita; alteração da revisão ou encerramento do vínculo invalida automaticamente sua leitura e ciência. O contato ativo da Conta registra ciência individual e idempotente da versão publicada. Isso não é confirmação do cliente, não altera a Visita nem satisfaz a política de confirmação obrigatória ou autoriza envio ao Auvo. Os registros históricos são preservados. Gate e funções ficam fechados; publicação exige capacidade PCM. É necessária revisão do contrato de autorização e das políticas de RLS antes de habilitar.
