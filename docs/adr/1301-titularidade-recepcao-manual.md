# ADR-1301 — Titularidade da recepção manual de levantamento

## Contexto

O cancelamento da ADR-1297 não comprova a origem de um request sem recibo. Um identificador e payload conhecidos por outro operador não bastam para reconhecer o autor.

## Decisão

Para novas recepções canceláveis, o servidor emite o request e reserva previamente ator, Cliente e payload, sem criar lote. A recepção verifica identidade e conteúdo de reservas existentes sob a trava do request. O cancelamento sem recibo só é permitido para reserva exata; pedidos legados sem reserva não podem ser cancelados por essa via e continuam sujeitos a consulta ou replay.

## Consequências

Uma reserva cuja resposta seja perdida pode ficar órfã, mas não cria cadastro. Gates nascem fechados; implantação exige ordem coordenada, autorização, concorrência, limites, RLS, compatibilidade legada e revisão adversarial. Esta decisão restringe a ADR-1297.
