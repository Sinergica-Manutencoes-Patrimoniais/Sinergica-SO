# ADR-0891 — Conferência da origem das ocorrências no servidor

Data: 2026-10-30 · Status: preparação; gates fechados, não homologado.

## Contexto

Em PostgreSQL sintético, a 1075 retornou ocorrência cujo alvo não corresponde à Rotina aprovada. O consumidor recusaria a linha, mas outro consumidor poderia chamar a RPC diretamente. A segurança e a integridade não devem depender apenas do navegador.

## Decisão

Criar entrada aditiva que chama a 1075 com suas travas e valida cada ocorrência retornada contra índice construído da fotografia aprovada, exigindo Rotina, alvo e modo equivalentes. Qualquer inconsistência rejeita a página inteira. Revogar execução autenticada direta da 1075; adapter chama nova entrada. Não altera registros nem resolve ocorrências legadas ou cobertura parcial.

## Compatibilidade e retorno

O banco e o adapter exigem implantação coordenada; reverter consumidor primeiro com gate fechado. Preservar dados anteriores. Testar duas capacidades, duas contas, paginação, concorrência e RLS oficial; revisão adversarial e liberação seguem pendentes. A consulta continua parcial e não comprova execução.
