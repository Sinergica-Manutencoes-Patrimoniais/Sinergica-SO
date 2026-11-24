---
name: pronto-para-aceite-2026-11-19
description: Separação entre o que pode ser homologado agora e o que segue como pendência conhecida, por story e por item do Backlog executável do Fabrício.
alwaysApply: false
---

# O que está pronto para aceite — rodada 17-19/11/2026

Resposta direta ao pedido do Fabrício: *"indicando exatamente quais histórias estão prontas para
aceite"*. A separação abaixo é por **estado real**, não por intenção.

Critério de "pronto para aceite": o código está em `main`, tem prova automatizada, e **existe um
caminho de tela** que um operador alcança depois da ativação descrita em
`runbooks/ativacao-homologacao-2026-11.md`.

---

## A. Pronto para aceite agora, sem ativação nenhuma

| Story | Item do pacote | O que aceitar na tela | Teste do caderno |
|---|---|---|---|
| `E00-S27` | **BL 006** — revogação imediata | Configurações → Capacidades → "Revogar ou reativar usuário". A sessão aberta em outra máquina perde o acesso **na próxima ação**, sem novo login | 14 |
| `E00-S26` | **BL 005** — capacidades sensíveis | Configurações → Capacidades: criar perfil, conceder por ação, provar o negado (operador não aprova, Financeiro não altera operação, Cliente não vê outro condomínio) | 13 |
| `E01-S194` | **BL 007** — Validação PCM como etapa | Kanban já mostra a etapa; retorno do Auvo "Finalizada" cai em **Validação PCM**, não em Finalizado; finalizar exige capacidade | 6, 7 |
| `E01-S192` | **BL 003** (parcial) — origem da preventiva | Drawer da OS mostra **"Plano de origem"** | — |

> `E01-S194` e `E01-S192` não têm flag: assim que a publicação do site sai, estão na tela.

---

## B. Pronto para aceite **depois da ativação** (baixo risco)

Cada linha exige o bloco correspondente do runbook. Todas são aditivas: não mudam o que já
funciona hoje.

| Story | Item | Ativação necessária | Teste |
|---|---|---|---|
| `E01-S199` | **BL 007 AC-5** — fila "Campo a conciliar" | 1 gate + 1 flag + `execucao.validar` | 4b |
| `E01-S195` | **BL 009** — deslocamento residencial × operacional | 1 gate + 2 flags | 9 |
| `E01-S196` | **BL 004** — contingência Auvo auditada | só a concessão `execucao.contingencia_auvo` | 5 |
| `E01-S197` | **BL 008** — pendências agrupadas por ativo | 3 flags (gates já existiam) | 8 |
| `E01-S193` | **BL 002** — Backlog antecede Chamado | 5 gates + 3 flags | 3 |

---

## C. Pronto, mas **não é tela** — aceite por demonstração técnica

| Story | Item | Como aceitar |
|---|---|---|
| `E01-S198` | **BL 014** — API de domínio | Chamada autenticada ao vivo: sem token recusa; sem capacidade recusa com erro nomeado; lote entra em **staging**, nunca no cadastro oficial; repetição não duplica; não existe SQL genérico exposto | 15 |
| `E02-S43` | **BL 015** — MCP controlado | Catálogo fechado de ferramentas; consulta não cruza Clientes; escrita no cadastro oficial é impossível (só leitura nesta etapa); registro de quem chamou o quê | 16 |

---

## D. Decisão do Fabrício antes de ativar

| Story | Item | Por que não foi ativado |
|---|---|---|
| `E01-S167` / `E01-S193` | **BL 001** — várias OS por Chamado | O gate é **global**: abre para todo o sistema de uma vez, não dá para limitar a um Cliente piloto. Procedimento auditado pronto (tela de Ativação de jornadas) |
| — | **BL 010** — Central de Materiais | Jornada registrada e pronta para abrir pela mesma tela; a **área única no menu** depende de BL 013 |

---

## E. Pendência conhecida — **não** entra nesta homologação

| Item do pacote | Estado | Observação |
|---|---|---|
| **BL 013** — navegação por função (Trabalho/Gestão/Administração) | **Não iniciado** | Spec e plano escritos; nenhuma tarefa executada |
| Assessment → Inspeção "Diagnóstico Inicial do Cliente" | **Não iniciado** | Faz parte de BL 013. A aba "Assessment" continua no Cliente 360 |
| PMOC → modalidade do Plano de Manutenção | **Não iniciado** | Faz parte de BL 013 |
| Área única "Materiais e Aquisições" no menu | **Não iniciado** | Depende de BL 013 |
| "Clientes e Estrutura" como jornada única | **Não iniciado** | Depende de BL 013 |
| **BL 003 AC-3** — Agenda do Técnico com as OS vinculadas | **Diagnosticado, não implementado** | Causa nomeada: a Agenda é cadastro próprio, ninguém escreve nela a partir da Visita. Depende de decidir o destino do dado manual existente |
| **BL 004 AC-11** — monitor consolidado de exceções do Auvo | **Não existe** | Visita não confirmada, falha de envio e tarefa órfã existem separadas; nada as reúne. Achado novo desta rodada |
| **BL 007 AC-7** — matriz completa de transições do Kanban | **Parcial** | Só a entrada em "Finalizado" tem trava. As demais seguem livres |
| **BL 011** — fator 1,5 e tributos configuráveis | **Implementado antes desta rodada** | Entra como conferência na homologação (teste 11), não como entrega nova |
| **BL 012** — origem única dos faturáveis | **Implementado antes desta rodada** | Garantido por constraint; gap conhecido de cobertura de teste |

---

## F. O que a equipe precisa receber para fechar o ambiente

1. **Confirmação de qual ambiente** será homologado (hoje o repositório tem `main` → produção; não
   existe branch `develop`, e é dela que o staging deployaria pela configuração atual).
2. **Janela** para a sessão de ativação, com um responsável funcional presente.
3. **Decisão sobre `chamado-multiplas-os`** (seção D) — é o único item cujo efeito não é
   reversível por Cliente.
4. **Cliente de teste** indicado, para concentrar concessões e dado de homologação.
