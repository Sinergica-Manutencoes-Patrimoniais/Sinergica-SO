# ADR-0922 — Autorização transacional da liberação de reserva

Data: 2026-10-30 · Status: preparado, não aplicado nem homologado.

## Contexto e decisão

Liberação e conversão registram eventos em `sso_documentos_internos_liberacoes`, portanto não passam pelo trigger de inserção do documento do ADR-0921. Em fixture com autorização 0246 e triggers 0319, a liberação pôde confirmar após revogação iniciada depois da checagem anterior.

Preparar trigger aditivo antes do insert de liberação/conversão: tentar a mesma trava compartilhada dos escritores de autorização da 0319, obter Cliente do documento persistido e revalidar `faturavel.efetivar`. Trava indisponível falha imediatamente; autorização negada ou documento ausente falham fechados. Em nova conversão, a trava permanece até o fim da transação, inclusive durante a alocação. Replay de conversão já registrada não faz insert e não passa pelo trigger: exige proteção e teste próprios antes de liberar o fluxo. Não confiar em Cliente fornecido pelo cliente HTTP. Não abrir gates nem alterar documentos/eventos históricos.

## Limites e reversão

A proteção aplica-se a todos os inserts, inclusive manutenção privilegiada; avaliar compatibilidade com todos os produtores e backfills antes de qualquer rollout. Não comprova isolamento de sessão, autorização de outras tabelas financeiras nem ausência de deadlock em todo o sistema. Testar ambas as ordens, rollback, RLS real e revisão adversarial; manter gates fechados. Reverter somente por migration revisada, após fechar gates, removendo apenas trigger e função; isso reabre a corrida e não é estado seguro.
