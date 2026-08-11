---
name: product
description: PRD — módulo Comercial/CRM completo (épico E03). Visão de produto, telas, personas e decisões do PO. Leia antes de implementar qualquer story E03.
alwaysApply: false
---

# Product — Módulo Comercial / CRM (épico E03)

> **Tier:** arquitetural (novo bounded context) · **Status:** aprovado pelo PO (Lucas, 2026-08-10)
> Este PRD cobre o **módulo inteiro**. Cada story tem `spec.md`/`tasks.md` próprios e
> **auto-contidos** — qualquer sessão/LLM pega uma story livre e implementa sem depender da
> conversa que originou este documento. Mesmo molde do E04 (Financeiro).

## Problema (dor L3 do `docs/ESCOPO-MESTRE.md` §6.3)

O funil de vendas não é gerido. Prospects e propostas vivem em planilha e WhatsApp, então:

- **Não se mede nada** — taxa de conversão, ciclo de venda e win/loss por motivo são desconhecidos.
- **A proposta sai lenta e sem padrão de preço.** Cada uma é montada do zero; o preço é estimado
  por experiência, sem piso calculado. Não há como saber se um desconto dado destrói a margem.
- **Não se sabe a origem dos bons clientes** — sem atribuição, o Marketing/Growth investe às cegas.
- **O lead qualificado pelo agente de WhatsApp não tem para onde ir.** A E02-S09 está em produção
  gravando `comercial.leads` com score e resumo, e **não existe nenhuma tela que consuma isso**.
  O trabalho do agente morre no banco.

Há também uma dor estrutural que este épico resolve (ver `design.md` e ADR-0020): **lead existe
hoje em dois lugares** (`pcm.clientes` com `tipo='lead'` e `comercial.leads`), sem reconciliação.

O contrato do projeto (ESCOPO-MESTRE §6.3 e exigência **3.1.1**) pede: funil, propostas com preço
padronizado, contratos e **fluxo único do lead ao contrato sem trocar de ferramenta**.

## Para quem

- **Comercial / dono (Lucas, papel `superadmin` ou `supervisor` com módulo `comercial`):** trabalha
  o funil, monta e envia proposta, negocia, fecha contrato, acompanha conversão.
- **Técnico / supervisor em campo:** faz o **levantamento** no condomínio prospecto (reusa o
  Assessment do PCM — não é tela nova para ele aprender).
- **Agente comercial de WhatsApp (E02-S09, já em produção):** qualifica contato novo e **entrega o
  lead no funil** com score e resumo, em vez de gravar numa tabela sem tela.
- **Síndico/cliente:** **não acessa o CRM**. Ele vê e aprova a proposta pelo **portal** (E09-S09,
  que já tem o fluxo de aprovação de orçamento em produção).
- **Financeiro:** consome o contrato assinado como origem da receita recorrente — não digita
  contrato de novo.

## Decisões do PO (Lucas, 2026-08-10) — vinculantes

1. **Conta única.** Lead, prospecto, cliente ativo e cliente antigo são a **mesma linha** em
   `pcm.clientes`, do primeiro contato ao encerramento. O PCM exibe os ativos; o Comercial exibe
   todos, com a mesma Visão 360 para lead, ativo e antigo. Nunca cópia na promoção. → **ADR-0020**
2. **Funil no Comercial, identidade no PCM.** O Comercial **não** adiciona coluna em `pcm.clientes`:
   cria `comercial.oportunidades` com FK. `tipo`/`status_comercial` migram do PCM para cá. → **R3 do ADR-0019**
3. **4 tipos de proposta** (ESCOPO-MESTRE §6.3, exigência contratual — prevalece sobre o
   `docs/blueprint/03-comercial.md`, que dizia 2): **levantamento · volante · residente · simples**.
4. **Motor de precificação com fórmula**, não tabela fixa de preço:
   `Custo Total (MO + Benefícios + Material + Veículo + Suporte) × (1 + Margem) ÷ (1 − Alíquota)`,
   com **piso** (custo com gross-up de imposto) e **desconto máximo** = `1 − Piso/Preço`.
5. **Custo de mão de obra vem do Financeiro.** Reusa `financeiro.custos_funcionario` (E04-S06, em
   produção, custo/hora por funcionário com vigência). Preço de venda e rentabilidade passam a
   usar a **mesma fonte** — sem divergência entre "o que vendi" e "o que custou".
6. **Levantamento reusa o Assessment do PCM** (E01-S90/S97/S98/S130): questionário, galeria de
   fotos por item, análise por IA e vínculo com o Auvo já existem. O levantamento comercial é um
   Assessment com finalidade de pré-venda sobre uma Conta em etapa de funil.
7. **Etapas do funil são configuráveis**, no mesmo padrão do Kanban de OS (E01-S84) — você ajusta
   o processo sem migration. Cada etapa declara um **tipo** (`aberta`/`ganha`/`perdida`) para que
   as métricas de conversão não quebrem quando alguém renomear uma coluna.
8. **Saída em PDF + aprovação no portal.** Reusa o pipeline de PDF com identidade visual
   (E01-S135/S139) e o fluxo de aprovação do portal do síndico (E09-S09). O aceite vira **evento no
   sistema**, não e-mail solto — o funil fecha sozinho. **DOCX fica fora do V1.**
9. **Comercial é dono do contrato; o Financeiro consome.** `comercial.contratos` guarda o acordo
   (escopo, sistemas cobertos, tipo, reajuste, vigência); `financeiro.contratos` continua sendo o
   plano de faturamento e ganha FK de origem. Contrato novo nasce no Comercial e **cria** a linha
   do Financeiro. O cron de recebíveis (E04-S04) não muda.
10. **Proposta ≠ Orçamento — duas entidades, propósitos diferentes.** **Proposta** (Comercial) é
    pré-venda para quem ainda não tem contrato: 4 tipos, motor de preço, versionamento, gera
    **contrato**. **Orçamento** (`pcm.orcamentos_servico`, já em produção pela E09-S09) é serviço
    extra-contratual para cliente ativo: valor pontual, aprovação no portal, gera **OS**. Coexistem.
11. **O passivo de fronteira é corrigido dentro deste épico** (não fica como dívida): colunas
    comerciais no PCM, `comercial.leads` escrita pelo Atendimento, `atendimento.historico_chamado_snapshots`
    criada pelo PCM e a **duplicação de satisfação** (ver decisão 13). → **ADR-0019**
12. **Nada de alíquota fixa no código.** O imposto é sempre lido de `financeiro.config_impostos`
    (fonte única, já editável na UI da E04-S10 — alíquota fixa ou faixas de RBT12). Trocar de
    Anexo III para IV é digitar as faixas, sem migration. A tela de proposta **mostra a alíquota
    aplicada e sua origem**, e avisa quando as faixas ainda estão no seed padrão (nunca editadas),
    para ninguém emitir proposta com imposto não confirmado sem perceber.
13. **As tabelas do portal permanecem em `pcm.*`.** Revisão da análise inicial: `chamados_interacoes`
    e `os_notas` têm `autor_tipo ∈ ('cliente','interno')` — são dados **sobre entidades do PCM**
    (Chamado e OS) com o portal como um dos dois canais de escrita, não dados do portal. Pelo
    próprio R1 (dono governa o ciclo de vida da entidade), o PCM é dono legítimo; mover para um
    schema `portal` só criaria FKs de volta para `pcm.chamados`/`pcm.ordens_servico` sem ganho.
    **A dívida real ali é outra:** existem **duas tabelas de satisfação sobre OS** —
    `pcm.satisfacao_respostas` (E01-S55, vinda do Auvo) e `pcm.portal_satisfacao` (E09, CSAT/NPS
    do portal). Mesmo conceito, fontes diferentes: o dashboard de qualidade reporta número
    diferente conforme a tela. É isso que a S11 resolve.

## Decisões herdadas do projeto (não rediscutir)

- **PCM é o system of record da operação** (ADR-0001). Contrato assinado gera Conta ativa e plano
  preventivo no PCM — o Comercial não executa nada.
- **Auvo é o braço de campo.** Lead **não** vai para o Auvo (Conta com `auvo_id null` não é
  sincronizada). Só quem tem contrato/OS aparece lá.
- **`pcm.clientes` é Shared Kernel** (ADR-0019) — o Comercial lê pela view `relacionamento.contas`.
- **O módulo Orçamentos do Auvo está vazio** (auditoria de 2026-07-10, `docs/AUDITORIA-AUVO-API.md`)
  — o orçamento/proposta nasce no Sinérgica SO, não no Auvo.
- **NF-e é integração futura**, nunca reconstrução. Fora deste épico.
- **`ModuloId 'comercial'` já existe** no RBAC (`features/config/domain/modulo.ts`) — permissão por
  módulo já está pronta, falta a UI.

## As telas do módulo

| # | Tela | O que faz | Story |
|---|------|-----------|-------|
| 1 | **Funil (Kanban)** | Oportunidades por etapa configurável, drag-and-drop, card com Conta/valor/score/responsável; ao mover para etapa `perdida`, exige motivo | S02 |
| 2 | **Lista de Contas** | Toda Conta (lead · prospecto · ativo · antigo) com etapa do funil, filtros e busca. É a "visão do CRM" que o PCM não dá | S01 |
| 3 | **Visão 360 da Conta (aba Comercial)** | Reusa a Visão 360 do PCM e acrescenta: oportunidades, propostas, contratos, timeline de relacionamento | S01 |
| 4 | **Levantamento** | Assessment de pré-venda sobre a Conta: disciplinas, fotos, sistemas encontrados; alimenta a proposta | S05 |
| 5 | **Proposta — editor** | Escopo, atividades, materiais, MO; cálculo ao vivo com piso e desconto máximo; versionamento por snapshot | S04 |
| 6 | **Proposta — visualizar/enviar** | PDF com identidade visual, envio ao síndico, link de aprovação no portal, status | S06 |
| 7 | **Parâmetros de precificação** | Margem alvo, overhead, veículo, benefícios, suporte; alíquota lida do Financeiro; tabela de níveis de técnico | S03 |
| 8 | **Contratos** | Gerados da proposta aceita: tipo, vigência, reajuste, escopo/sistemas cobertos; cria o plano de faturamento no Financeiro | S07 |
| 9 | **Catálogo de materiais** | Preço de referência + markup por material, usado na composição da proposta | S03 |
| 10 | **Dashboard comercial** | Conversão por etapa, ciclo de venda, ticket médio, win/loss por motivo, desconto médio × piso, origem do lead | S08 |
| 11 | **Configuração do funil** | CRUD de etapas (nome, ordem, cor, tipo aberta/ganha/perdida) e de motivos de perda | S02 |

## Resultado esperado / métrica de sucesso

| Métrica | Baseline (hoje) | Alvo |
|---------|-----------------|------|
| Taxa de conversão por etapa | não medida | medida e visível no dashboard |
| Ciclo de venda (1º contato → contrato) | não medido | medido |
| Propostas com preço pela fórmula | 0% | 100% das novas |
| Desconto abaixo do piso | invisível | bloqueado na tela |
| Lead do agente de WhatsApp chegando ao funil | 0 (sem tela) | 100% |
| Cadastro duplicado lead × cliente | existe | zero (Conta única) |

## Non-goals (fora de escopo — vinculante)

- **DOCX.** Saída é PDF no V1 (decisão 8). Se fizer falta no uso real, vira story nova.
- **Assinatura eletrônica de contrato.** O aceite é registrado no portal; integração com
  assinatura digital não entra.
- **NF-e / emissão fiscal.** É do Financeiro e continua integração futura.
- **Cobrança.** Já existe (E04-S09, Mercado Pago). O Comercial não emite boleto/PIX.
- **Substituir `pcm.orcamentos_servico`.** Orçamento extra-contratual continua no PCM/portal
  (decisão 10).
- **Marketing/Growth.** Atribuição de origem por campanha/anúncio é E06/E07. Aqui o campo `origem`
  da oportunidade é livre/lista simples, sem integração com Ads.
- **Comissionamento de vendedor.** Time comercial é de uma pessoa hoje; não modelar.
- **Multi-moeda, multi-empresa.**

## Riscos / premissas

| # | Risco / premissa | Se falso | Mitigação |
|---|------------------|----------|-----------|
| ~~R1~~ | ~~**Migration de dados em produção** converte `comercial.leads` e `tipo`/`status_comercial` em Conta + Oportunidade~~ | — | **RISCO ELIMINADO** (verificado em produção, 2026-08-10): `comercial.leads` = **0 linhas**, `tipo='lead'` = **0**, `status_comercial='prospecto'` = **0**, vínculos `comercial_lead` = **0**. **Não há dado para migrar** — a S01 cria schema novo e deprecia colunas vazias. Ver `design.md` §4 |
| R2 | **Alíquota do Simples**: ESCOPO-MESTRE §6.3 diz **Anexo IV**; a E04-S10 semeou **Anexo III** em `financeiro.config_impostos` | preço com imposto errado — erra a margem em todas as propostas | **Resolvido por configuração** (decisão 12): `config_impostos` já aceita alíquota fixa ou faixas de RBT12 editáveis na UI — trocar de anexo é digitar as faixas, sem migration. A tela de proposta exibe a alíquota vigente e avisa se as faixas ainda estão no seed padrão |
| R7 | **CPP (INSS patronal) no Anexo IV fica fora do DAS**, no Anexo III está dentro. O custo de MO vem de `financeiro.custos_funcionario` ("salário + encargos + benefícios") | se a empresa for Anexo III e os encargos cadastrados já incluírem INSS patronal, ele é contado duas vezes (no custo e no DAS) — margem subestimada | flag `mo_inclui_inss_patronal` em `comercial.parametros_preco` declarando o que o custo cadastrado representa; conferência única na S03, não a cada proposta |
| R3 | O agente comercial (E02-S09) **nunca passou por UAT real de WhatsApp** | o funil nasce sem entrada automática de lead | S02 não depende disso — funil funciona com lead manual; a integração é a S09 |
| R4 | Reusar o Assessment do PCM para levantamento acopla Comercial↔PCM | mudança no Assessment quebra o levantamento | consumo por view/RPC (R2 do ADR-0019), nunca `select` direto |
| R5 | Corrigir o passivo de fronteira mexe em produção que funciona (portal, PCM) | regressão em tela de cliente | cada correção é story própria, com migration reversível e Playwright antes/depois |
| R6 | `financeiro.custos_funcionario` pode estar **vazia** em produção | motor de preço sem custo de MO | tratar como aviso honesto na UI (mesmo padrão de `pcm.despesas` na E04-S06), nunca erro |

## Ordem de entrega sugerida

```
S01 (Conta única + fundação)  ←  bloqueia tudo
   ├─ S02 (funil + etapas configuráveis)
   │     └─ S09 (agente de WhatsApp entrega lead no funil)
   ├─ S03 (parâmetros + catálogo + motor de preço)
   │     └─ S04 (editor de proposta)  →  S05 (levantamento)  →  S06 (PDF + portal)
   │              └─ S07 (contrato → Financeiro)
   └─ S08 (dashboard)   ·   S10..S13 (correção do passivo, paralelizável)
```

## Ver também
- `design.md` (mesma pasta) — schema, fronteiras, motor de preço, plano de migração
- [ADR-0019](../../docs/adr/0019-propriedade-de-dados-r1-r2-r3.md) · [ADR-0020](../../docs/adr/0020-conta-unica-funil-no-comercial.md)
- `docs/ESCOPO-MESTRE.md` §6.3 e M3 · `docs/blueprint/03-comercial.md`
- `docs/ARCHITECTURE.md` § "Propriedade de dados" e § mapa real de schemas
