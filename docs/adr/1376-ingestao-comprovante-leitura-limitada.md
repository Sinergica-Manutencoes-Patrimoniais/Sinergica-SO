# ADR-1376 — Leitura limitada na confirmação de comprovante

**Estado:** proposta; não implantada nem homologada.

## Decisão

Na rota mediada de ingestão de comprovante, substituir a leitura integral antecipada do SDK por transferência autenticada em fluxo, com caminho restrito a três UUIDs, sem redirecionamento, prazo de 15 segundos e limite de 10 MiB durante a leitura. A rota continua comparando o digest dos bytes e revalidando autorização antes de confirmar. Falha ou interrupção não libera confirmação, e a reserva permanece recuperável pelo mesmo pedido.

Chamadas de autenticação, limite, RPC e envio também têm prazo de espera limitado. Esse prazo não garante cancelamento: uma gravação ou upload pode terminar após a resposta. O resultado deve permanecer incerto e ser recuperado com o mesmo identificador, nunca tratado como prova de ausência ou como autorização para novo upload.

## Limites

A leitura não garante imutabilidade do objeto após a conferência nem substitui autorização, policies ou revisão de Storage. Um bloco recebido pode exceder o limite antes de ser rejeitado. Validar Storage/Edge reais em ambiente isolado, URLs, chaves, timeout, cancelamento, arquivos grandes, concorrência, recuperação, ACL/RLS e revisão adversarial. A rota e seus gates permanecem desligados.
