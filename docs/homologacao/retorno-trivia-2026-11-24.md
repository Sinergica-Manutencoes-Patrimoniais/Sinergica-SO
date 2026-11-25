---
name: retorno-trivia-2026-11-24
description: Resposta da Trívia ao documento "SSO Homologação e retorno à Trívia" de 24/11/2026 — estado da ativação, capacidades, gates do PMOC, Chamado 1:N e preparação do Guainumbi.
alwaysApply: false
---

# Retorno da Trívia — 24 de novembro de 2026

**Para:** Fabrício · Engenharia Sinérgica
**De:** Lucas · Trívia Studio
**Referência:** *SSO Homologação e retorno à Trívia*, 24/11/2026

---

Fabrício, recebemos o documento. Abaixo o que já está feito, o que está anexado e os três pontos
em que precisamos de uma decisão sua antes de avançar.

## 1. A ativação já foi feita — os sete roteiros estão em tela

As sete jornadas do seu roteiro de aceite foram ligadas em 24/11 e estão publicadas. O commit é
`acf5f0b4` (`chore(E00-S28): liga as jornadas da rodada para a homologação`). Ligadas: Campo a
conciliar, Matriz de movimentações, Monitor Auvo T−24, Agenda do Técnico, Navegação por função,
Diagnóstico Inicial como Inspeção e Trechos de deslocamento. A Validação PCM não tem flag — está
na tela desde a publicação.

Três confirmações que achamos que o senhor vai querer por escrito:

- **Nenhuma das sete escreve no Auvo.** Conferimos arquivo por arquivo. O monitor toca a fila do
  Auvo só com `left join`, para ler o estado da falha — nunca para enfileirar.
- **A Matriz só restringe movimentação manual.** O retorno automático do Auvo continua livre por
  desenho, como o senhor pediu que se confirmasse.
- **Suíte completa reexecutada com as flags ligadas:** 3.034 testes, zero falha. Build de produção
  limpo.

Aceitamos a matriz do Kanban nos termos propostos: seletor, detalhe, ações em lote e aplicação no
banco ficam registrados como pendência documentada, não como entrega.

Uma descoberta desta rodada que vale registrar, porque muda a conta de permissões: **ser
`superadmin` não dispensa concessão** nesta base. A função `config.sso_autorizar_acao` exige linha
em `config.sso_concessoes` alcançando o usuário **naquele cliente**, independentemente do papel.
Flag ligada e gate aberto, sem concessão, resultam em tela recusando. Por isso as 25 capacidades
precisaram ser concedidas nominalmente ao administrador no mesmo dia.

## 2. As 25 capacidades e as 10 exclusivamente individuais — anexo

Está anexado o catálogo completo, reconstruído migration por migration e conferido contra o banco,
em `docs/homologacao/capacidades-sso-2026-11-24.md`. São exatamente 25 códigos, e exatamente 10
exigem concessão individual:

`anexo_os.publicar` · `backlog.promover` · `cadastro.aprovar` · `chamado.encerrar` · `custo.ler` ·
`execucao.contingencia_auvo` · `orcamento.dispensar` · `orcamento.excecao_preco` · `plano.gerir` ·
`visita.cancelar`

Quatro dessas dez — `cadastro.aprovar`, `chamado.encerrar`, `custo.ler` e `visita.cancelar` —
viraram individuais por causa do seu achado de que "quem tem escrita no módulo aprova, cancela,
exporta e vê custo". Eram herdáveis por perfil até a migration `1857`.

O **escopo é sempre por cliente**: não existe concessão implícita "para todos os clientes". Cada
cliente é uma linha.

No mesmo anexo está a sua proposta funcional de perfis — Gestor PCM, Operador PCM, Inspetor,
Financeiro e Comercial — já mapeada nas capacidades que existem, separando o que pode ser herdado
por grupo do que exige nome e cliente.

**Precisamos de volta:** os nomes por concessão nominal (pessoa + cliente, para cada uma das dez).
Sem o nome, a capacidade fica sem ninguém — e a tela recusa, que é o comportamento correto.

## 3. Um ponto que pede decisão sua: a Validação PCM

`execucao.validar` **não** é individual hoje, e isso não é descuido. É decisão de desenho anterior,
provada de propósito em teste (`E01-S170_perfis_acumulaveis.test.sql`, "usuário acumula capacidades
dos dois perfis"). O seu texto diz que "a validação de execução depende da atribuição definida para
a pessoa" — se a intenção é que seja nominal como as outras dez, isso é uma mudança de contrato
testado, e queremos fazê-la com decisão expressa, não por dedução.

Enquanto isso não se decide, o caminho reversível é **não colocar `execucao.validar` no perfil do
Operador PCM** e conceder por perfil separado a quem deve validar.

## 4. Plano PMOC — o bloqueio não é a flag

Sobre "confirme a configuração efetiva e proponha a janela de homologação":

A flag `VITE_SSO_PLANO_PMOC_MANUAL_ENABLED` está em `"false"`. Mas ligá-la sozinha não resolve. A
criação do Plano pelo PCM reusa, de propósito, a conferência da jornada PMOC mediado
(`pcm.sso_conferir_pmoc_mediado`, migration `1630` de E01-S166), que exige **dois gates
compartilhados**, ambos fechados:

- `pcm.sso_pmoc_mediado_gate`
- `pcm.sso_diagnostico_pmoc_gate`

Medimos o efeito colateral exato de abri-los, porque eles não são nossos sozinhos:

- **Passa a responder:** precondições de vínculo PMOC e proposta de mapeamento PMOC, de E01-S166.
- **Continua fechado:** a *decisão* sobre a proposta, que depende de um terceiro gate
  (`pcm.sso_decisao_pmoc_gate`), que permanece fechado e não precisa ser tocado.

Ou seja: o colateral é **leitura e rascunho de PMOC mediado**, nunca decisão. É reversível — os
gates são tabelas de uma linha — e não escreve no Auvo.

A capacidade exigida é `plano.gerir`, que é individual.

**Nossa proposta de janela:** abrir os dois gates e ligar a flag na mesma sessão de aceite, logo
após os sete roteiros, com o senhor presente. O teste é curto: um único Plano por contrato, o
contador de contratos sem Plano, e a preservação do histórico. Se algo não convencer, fechamos os
gates na hora. Aguardamos seu de acordo para abrir.

Sobre manter a entrada PMOC no menu enquanto imóveis, ARTs e laudos dependerem dela: combinado.
Só propomos retirá-la depois de as rotinas e os vínculos com o cronograma estarem prontos.

## 5. Várias OS por Chamado — estado conferido

Confirmando o que o senhor pediu ("quais caminhos de criação de OS adicional estão efetivamente
disponíveis"):

- A jornada tem **28 flags** registradas no nosso inventário de ativação.
- **Nenhuma das 28 está declarada no ambiente publicado.** Portanto, mesmo com as travas de banco
  abertas pela PR #114, **nenhum caminho de criação de OS adicional está acessível pela
  interface** hoje.
- Duas têm gate de banco nomeado e conferido: `VITE_SSO_CRIAR_OS_CHAMADO_ENABLED`
  (`pcm.sso_criacao_os_mediada_gate`) e `VITE_SSO_CONVERSAO_INTEGRAL_ENABLED`
  (`pcm.chamado_os_gate`).
- É a única jornada da rodada cujo efeito **sai do SO**: cada OS vira tarefa no Auvo quando a
  Visita é confirmada. Por isso o controle de ativação precisa ser nos três níveis — flag, gate e
  concessão —, e por isso ela fica em rodada própria, só com sua autorização expressa.

A demonstração que o senhor exige antes da liberação está aceita como critério: Chamado com duas
OS e uma tarefa Auvo para cada; envio em T−24; liberação imediata quando a confirmação ocorre
dentro das 24 horas; reprogramar OS já enviada atualizando **a mesma** tarefa; e encerrar uma OS
preservando o Chamado aberto até a conclusão do escopo. Faremos em `Sinérgica – Escritório`, com
dados de teste, antes de pedir qualquer ativação.

## 6. Clientes e Estrutura — proposta da próxima entrega

Aceitamos a direção: a próxima entrega da jornada vem pela Visão 360, com pesquisa que identifica
o tipo do resultado e visualização por local e por sistema, **preservando as entidades existentes**
e os vínculos de localização, pertencimento e histórico. Cliente, Local, Sistema, Equipamento,
Componente e Grupo quantitativo continuam separados — a unificação é de menu e de jornada, não de
modelo, como ficou acertado em 17/11.

Sobre a entrada única de Materiais e Aquisições: ela depende da mesma jornada de navegação que
acabou de ser ligada. Podemos propor prazo assim que a navegação por função passar no aceite desta
rodada — antes disso, qualquer data seria chute.

## 7. Guainumbi — concordamos em começar a preparação agora

Homologamos os fluxos em `Sinérgica – Escritório` e preparamos os dados do Guainumbi em paralelo,
como o senhor propôs. Usaremos Rimini e iHome como referências adicionais de Plano.

Do nosso lado, o que trava a preparação é o levantamento que só o PCM tem: cliente, áreas, locais e
ativos prioritários; dia fixo, equipe e horas contratadas; existência de Plano de Manutenção
vigente; e a semana e a visita representativas escolhidas para a primeira rodada.

Na implantação acompanhada, concordamos em manter o controle atual como referência durante o
primeiro ciclo e comparar agenda, execução e relatório ao final — e em começar pelo escopo que já
passou na homologação, deixando Chamado 1:N de fora até o aceite específico da integração.

## 8. O que ainda devemos ao senhor

Para a sessão de aceite, falta a Trívia entregar — e entregaremos antes da sessão:

1. endereço e versão publicada do ambiente de homologação;
2. login de teste por perfil, para os cinco perfis propostos;
3. registros de exemplo por roteiro, em especial uma OS de origem Auvo **sem Chamado válido**
   (roteiro 1) e uma OS retornada como concluída pelo Auvo (roteiro 2).

Durante a sessão, registraremos por teste o resultado, a evidência e a pendência, quando houver.

A lista de aceite no repositório já foi atualizada para refletir esta rodada:
`docs/homologacao/pronto-para-aceite-2026-11-24.md`.

## 9. Resumo do que aguardamos de decisão

| # | Decisão | Por quê |
|---|---|---|
| 1 | Nomes das 10 concessões individuais (pessoa + cliente) | Sem nome, a capacidade fica sem ninguém |
| 2 | `execucao.validar` nominal ou herdável | Mudar quebra contrato testado; queremos decisão expressa |
| 3 | De acordo para abrir os dois gates do PMOC na sessão de aceite | Colateral medido: leitura e rascunho de PMOC mediado, nunca decisão |
| 4 | Data da sessão de aceite | Para fecharmos os dados de exemplo e os logins |
| 5 | Levantamento do Guainumbi (áreas, locais, ativos, dia fixo, equipe, horas) | É o que trava a preparação em paralelo |

Chamado 1:N segue parado até sua autorização expressa, como combinado.
