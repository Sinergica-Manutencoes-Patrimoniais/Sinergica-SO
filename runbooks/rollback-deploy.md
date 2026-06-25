---
name: runbook-rollback-deploy
description: Runbook de rollback de deploy (frontend, Edge Functions, migrations). Puxe quando um deploy quebrou produção.
alwaysApply: false
---

# Runbook — Rollback de deploy

> Estabilidade tem prioridade sobre features. Na dúvida, **reverta primeiro, investigue depois**.

## Cenário
Deploy recém-publicado degradou produção (frontend, Edge Function ou migration).

## Sintomas / gatilhos de rollback
Reverter **imediatamente** se qualquer um:
- Smoke test pós-deploy falhou.
- 5xx > 5% por mais de 2 min, ou Edge Function com erro em massa.
- Funcionalidade core quebrada para usuários.
- Migration causou perda/corrupção de dados.

## Autoridade e SLA
- **Executa:** `@devops` (exclusivo de push/deploy/rollback — ver `AGENTS.md`).
- **Aciona:** `@reliability` ou o piloto. Não precisa de aprovação de `@po`/`@sm` para reverter.
- **SLA:** decisão ≤ 5 min após detecção · execução ≤ 10 min · confirmação ≤ 5 min após reverter.

## Procedimento por componente

### Frontend (provedor de hosting)
- Republicar o último deploy estável pelo dashboard do provedor (rollback instantâneo), ou
  re-deployar o commit anterior. Confirmar pelo smoke test.

### Edge Functions (Supabase)
```bash
git log --oneline supabase/functions/ -5          # achar commit estável
git checkout <commit-anterior> -- supabase/functions/<nome>/
supabase functions deploy <nome>                   # re-deploy da versão anterior
```
Confirmar nos logs que os erros pararam.

### Migrations (CUIDADO — sem rollback automático)
1. **Aditiva** (só criou coluna/tabela): aplicar o **SQL reverso** documentado no topo da migration
   (ver `db/README.md`) como nova migration e `supabase db push`.
2. **Destrutiva** (alterou/removeu dados): restaurar do **backup pré-deploy**
   (Supabase → Database → Backups). Restaurar substitui dados — coordenar com o time.
3. **Parcial** (falhou no meio): `supabase migration list` e limpeza manual conforme o estado.

## Validação (resolvido?)
- [ ] Smoke test do caminho crítico passa em produção.
- [ ] 5xx voltou ao normal nos logs.
- [ ] Usuários afetados confirmados como recuperados.

## Pós-incidente
1. Comunicar o time (o quê, por quê).
2. Criar story de investigação ("Investigar falha no deploy de <data>").
3. Não re-deployar a mesma versão sem fix testado.
