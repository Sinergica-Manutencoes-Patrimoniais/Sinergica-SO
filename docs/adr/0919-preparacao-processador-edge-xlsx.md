# ADR-0919 — Preparação de processador XLSX para Edge

Data: 2026-10-30 · Status: preparação, sem integração à rota ou autorização de rollout.

## Contexto

Web Worker não existe nas Edge Functions hospedadas. O experimento local com runtime de usuário conseguiu processar Rimini e I Home diretamente, mas não prova os limites de execução, isolamento ou concorrência da plataforma real. O guard do ADR-0916 continua obrigatório.

## Decisão

Preparar componente server-side que reutiliza o parser limitado e estrito, preserva cópia dos bytes e digest, e aceita cancelamento cooperativo. Não executar rede nem gravação. O módulo não deve ser conectado à recepção operacional, nem substituir o worker ou abrir gates nesta decisão. Não assumir que AbortSignal interrompe CPU síncrona ou limita memória.

Antes de qualquer conexão operacional, nova decisão deve definir e comprovar isolamento efetivo, limite de memória/CPU/tempo, contenção distribuída por usuário e Cliente, tratamento de concorrência, parada e resultado incerto. Exigir testes adversariais com arquivos limite, Edge/Auth/RLS e Vault reais isolados, além de revisão de segurança. Se a plataforma não assegurar as propriedades necessárias, usar serviço isolado com limites controlados e contrato autenticado em vez de ativar parser inseguro.

## Rollback

Não utilizar o componente preparado. O worker e o guard existentes permanecem; nenhum dado, flag ou recurso externo é alterado.
