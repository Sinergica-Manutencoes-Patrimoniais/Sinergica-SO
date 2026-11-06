# ADR-0914 — Composição local da jornada XLSX

Data: 2026-10-30 · Status: preparação, não publicada.

Para validar a composição da prévia, recuperação e envio antes da homologação, permitir que a jornada monte os callbacks apenas quando `import.meta.env.DEV` e `VITE_SSO_ENVIO_XLSX_DEV_ENABLED=true`. Builds de produção não devem oferecer envio, independentemente da flag. A prévia continua sob sua flag própria. A ação revalida capacidade atual no cliente; autorização, gate, integridade e idempotência continuam obrigatórios no servidor. Em caso de falha, a reconciliação é explícita e não envia nem aprova automaticamente.

Essa composição exclusivamente de desenvolvimento não revoga os gates nem a restrição de uso operacional dos ADRs 0910–0913. A rota de produção não está registrada. Não abrir gates, publicar, ou considerar pronta para operação até testes reais de Auth/RLS/Edge/concorrência e revisão adversarial; rollback mantém ambas as flags desligadas.
