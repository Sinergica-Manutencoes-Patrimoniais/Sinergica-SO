# Quickstart — E01-S181

Status: roteiro futuro, **não executado** nesta etapa documental.

## Pré-requisitos

Dependências E01-S179 (materiais), E01-S170 (autorização) e E01-S184 (proteção de custos). Supabase local com fixtures isoladas, contatos de duas Contas, usuário autorizado e usuário sem permissão; sem endpoints externos reais. Ler contracts/commands.md e data-model.md. Alocar/aplicar migrations novas somente durante implementação e em banco local.

## Comandos futuros

```sh
rtk pnpm --filter @sinergica/web test orcamento-operacional
rtk proxy supabase test db
rtk pnpm --filter @sinergica/web test:e2e orcamentos-operacionais.spec.ts
rtk pnpm --filter @sinergica/web typecheck
rtk pnpm arch:check
```

## Demonstração funcional

1. Custo R$100 gera sugestão R$150 e cliente recebe somente descrição/preço autorizados. Resultado: AC-1 e AC-2 observados, incluindo rejeições previstas.
2. Enviar, aprovar e complementar proposta; dispensar outra com motivo. Resultado: AC-3 e AC-4 observados, incluindo rejeições previstas.
3. Decidir orçamento legado duas vezes e emitir novo pela OS existente. Resultado: AC-5 e AC-6 observados, incluindo rejeições previstas.

Repetir dez comandos iguais e duas edições concorrentes; conferir unicidade e conflito explícito. Tentar IDs e anexos da Conta B como A e sessão revogada. Quando financeiro: conciliar valor original, conferido, documentos, parcelas e estornos em centavos.

## Evidência e saída

Mapear CT-024 e CT-025 e todos AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 a teste/comando/resultado. Registrar commit, ambiente, executor, data, IDs sintéticos, logs sem dados internos, contagens/saldos antes/depois e ressalvas. Revisão adversarial arquitetural e CI incluindo db-tests precisam ficar verdes na implementação. Não confundir aceite documental com homologação.

