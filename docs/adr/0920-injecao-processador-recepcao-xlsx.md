# ADR-0920 — Teste isolado da recepção atestada com processador Edge

Data: 2026-10-30 · Status: preparação, sem rollout.

## Decisão

Permitir selecionar explicitamente o processador na composição interna da recepção atestada, para testar o fluxo com `processarXlsxEdge` em runtime isolado. A composição operacional não passa essa dependência e mantém o worker anterior e o guard de indisponibilidade. A seleção é feita exclusivamente por código confiável do servidor, nunca por HTTP, configuração controlada pelo cliente ou dados do XLSX. Não conectar o processador direto à rota operacional por este ADR.

Identidade, autorização, assinatura, dados e RPC permanecem na mesma ordem; nenhuma chave, matriz ou resultado do parser é aceito do navegador. Não há prova de limites da plataforma, isolamento por requisição, autenticação real nem concorrência distribuída. Os requisitos e bloqueios do ADR-0919 permanecem.

## Rollback

Remover uso experimental da composição; rota e gates permanecem inalterados e fechados.
