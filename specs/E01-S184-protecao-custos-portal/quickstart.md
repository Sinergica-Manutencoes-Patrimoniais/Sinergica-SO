# Quickstart — E01-S184

Status: roteiro futuro, **não executado** nesta etapa documental.

## Pré-requisitos

Dependências Independente; correção crítica prévia à E01-S181/E01-S183. Supabase local com fixtures isoladas, contatos de duas Contas, usuário autorizado e usuário sem permissão; sem endpoints externos reais. Ler contracts/commands.md e data-model.md. Alocar/aplicar migrations novas somente durante implementação e em banco local.

## Comandos futuros

```sh
rtk pnpm --filter @sinergica/web test protecao-custos-portal
rtk proxy supabase test db
rtk pnpm --filter @sinergica/web test:e2e protecao-custos-portal.spec.ts
rtk pnpm --filter @sinergica/web typecheck
rtk pnpm arch:check
```

## Demonstração funcional

1. Semear custo sentinela no snapshot, consultar como Cliente e inspecionar JSON bruto. Resultado: AC-1 e AC-2 observados, incluindo rejeições previstas.
2. Baixar versão antiga/nova e comparar privado intacto com público sanitizado. Resultado: AC-3 e AC-4 observados, incluindo rejeições previstas.
3. Comparar usuário interno com e sem ver custos; verificar link de anexo. Resultado: AC-5 e AC-6 observados, incluindo rejeições previstas.

Repetir dez comandos iguais e duas edições concorrentes; conferir unicidade e conflito explícito. Tentar IDs e anexos da Conta B como A e sessão revogada. Quando financeiro: conciliar valor original, conferido, documentos, parcelas e estornos em centavos.

## Evidência e saída

Mapear CT-024 e CT-027 e todos AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 a teste/comando/resultado. Registrar commit, ambiente, executor, data, IDs sintéticos, logs sem dados internos, contagens/saldos antes/depois e ressalvas. Revisão adversarial arquitetural e CI incluindo db-tests precisam ficar verdes na implementação. Não confundir aceite documental com homologação.

