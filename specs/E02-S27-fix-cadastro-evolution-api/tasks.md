---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Configurar Evolution no SO + expor webhook

> Tier pequeno-médio. Reusa o padrão de segredo em Vault de E00-S12 (não reinventar). Deno não roda
> local (validar Edge no CI/prod). Cuidado: chave é segredo — nunca em tabela comum nem no client.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Config store: URL de Conexão (metadado) + Chave (Vault write-only) — reusar `config.integracoes`/`fn_definir_segredo_integracao` (E00-S12) ou equivalente do Atendimento | AC-1 | — | lint:migrations | done (reuso E00-S12) |
| 2 | UI: seção "API" na config do Atendimento — campo URL + campo Chave (write-only, "configurado"/atualizar), gate escrita/superadmin | AC-1 | 1 | typecheck | done |
| 3 | UI: exibir endereço de webhook do SO (`.../functions/v1/pcm-whatsapp-webhook`) com botão copiar | AC-2 | — | typecheck | done |
| 4 | Edge `atendimento-evolution`/`evolution-admin`: ler URL/chave da config (Vault) com fallback pra `Deno.env` | AC-3 | 1 | (deno CI) | done (CI pendente) |
| 5 | Erro legível: propagar motivo real da Evolution + mensagem clara quando URL/chave faltam | AC-4 | 4 | vitest | done |
| 6 | Validar ponta a ponta (Lucas): configurar URL/chave reais → criar instância → QR → webhook | AC-1..AC-3 | — | manual (Lucas) | todo |

## Plano de teste
- Unidade: config salva/lida; chave nunca reexibida; mapeamento de erro Evolution → mensagem.
- Aceite: Lucas configura Evolution real, cadastra instância, lê QR, webhook registra.
- Deno: leitura de config/Vault na Edge (CI).

## Riscos
- Ler segredo do Vault dentro da Edge Function (service_role) — confirmar RPC/permissão (padrão E00-S12).
- Não vazar a chave em log/erro nem exibir após salvar.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Chave em Vault, nunca reexibida/logada
- [ ] Cadastro real validado (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
