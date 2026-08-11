---
name: apontamentos-fabricio-aline
description: Registro de pontos encontrados pelo Fabrício e Aline testando o Sinérgica SO — vira insumo para novas stories/correções.
alwaysApply: false
---

# Apontamentos — Fabrício e Aline

> Anote aqui cada ponto que encontrar usando o sistema: bug, coisa confusa, sugestão de melhoria,
> dúvida. Um item por entrada, direto ao ponto — não precisa formalizar. Isso vira a base pra
> priorizar o que corrigir/construir a seguir.

**Como colocar uma imagem:** salve o print nesta mesma pasta (`docs/Apontamentos/`) e escreva o
nome do arquivo no campo Imagem — ex.: `tela-erro-2026-07-14.png`.

---

## Modelo (copie o bloco abaixo pra cada item novo)

```
### [DATA] — [Módulo/Tela]
- Quem: Fabrício / Aline
- Tipo: bug / confuso / sugestão / dúvida
- O que encontrei:
- Imagem:
```

```
### 2026-07-24 - Inspeção
- Quem: Fabrício
- Tipo: Bug
- Erro ao fazer upload de planilha de inspeção.
- Imagem: <img width="1910" height="1021" alt="image" src="https://github.com/user-attachments/assets/a8b6b43a-887f-44ac-a72f-aa69b8e2daba" />
```
### 2026-07-24 — Ordens de Serviço
- Quem: Fabrício
- Tipo: dúvida
- Posso apagar os chamados de teste para começar a inserir os chamados reais?
- Imagem:<img width="1200" height="702" alt="image" src="https://github.com/user-attachments/assets/f482262c-6a0e-4099-ba6f-e2139f9aa96d" />
```

### 2026-07-24 — Chamado
- Quem: Fabrício
- Tipo: sugestão
- Precisamos conseguir tratar os chamados por cliente - só adicionar filtro de cliente, area de atuação (eletrica, hidraulia, ar condicionado...)
- Imagem:<img width="1903" height="990" alt="image" src="https://github.com/user-attachments/assets/ffcba342-6fea-4a45-9341-f7c1b6373391" />
```
---

## Itens

### 2026-07-14 — Exemplo (apagar depois de ler)
- Quem: 
- Tipo: 
- O que encontrei: 
- Imagem: (nenhuma)

### 2026-07-22 — Chamados / Envio para o Backlog
- Quem: Aline
- Tipo: sugestão
- O que encontrei: ao enviar um Chamado para o Backlog, o preenchimento da matriz GUT deve ser obrigatório. Sem os valores de Gravidade, Urgência e Tendência, não é possível priorizar corretamente o Chamado. O sistema deve bloquear o envio enquanto o GUT não estiver completo.
- Imagem: (nenhuma)

### 2026-07-22 — PCM / Cadastros
- Quem: Aline
- Tipo: sugestão
- O que encontrei: a aba Serviços dentro do PCM não é utilizada e deve ser removida da navegação. A integração de serviços com o Auvo deve continuar funcionando em segundo plano.
- Imagem: (nenhuma)

### 2026-07-22 — Guia SO / Financeiro
- Quem: Aline
- Tipo: confuso
- O que encontrei: o Guia SO estava desatualizado, principalmente no Financeiro, ainda apresentado como protótipo. O guia precisa explicar como usar cada opção, para que serve e qual decisão ou resultado ela apoia.
- Imagem: (nenhuma)

### 2026-07-22 — PCM / Relatórios
- Quem: Aline
- Tipo: sugestão
- O que encontrei: remover da navegação os menus Relatório Diário e Relatório Mensal, pois não possuem tela funcional e não são utilizados.
- Imagem: (nenhuma)

### 2026-07-22 — Área do Cliente
- Quem: Aline
- Tipo: bug
- O que encontrei: a Área do Cliente já foi desenvolvida, mas a aba do sistema interno ainda exibia apenas "Em construção". A aba deve mostrar o estado real do portal, orientar a criação de acesso e informar o endereço correto para testes, sem permitir que usuário interno assuma a identidade do cliente.
- Imagem: (nenhuma)

### 2026-07-24 — PCM / Cadastros (Inspeções)
- Quem: Lucas
- Tipo: bug
- O que encontrei: ao importar o XLS padrão do Auvo na tela "Importar Relatório XLS", a subida falha com "Edge Function returned a non-2xx status code". O console mostra `Failed to load resource: the server responded with a status of 502` na função `importar-relatorio-pdf`. Causa provável: a função encaminha 502 quando a chamada à OpenRouter não retorna `ok` (`supabase/functions/importar-relatorio-pdf/index.ts:42`) — checar logs da function em produção pra confirmar se é falha da OpenRouter (modelo/chave/quota) ou timeout por texto extraído grande.
- Imagem: (salvar os 2 prints anexados nesta pasta, ex. `pcm-importar-xls-erro-2026-07-24-1.png` e `-2.png`)

### 2026-08-11 — Chamados - Kanban
Quem: Fabrício
Tipo: Bug 
O que encontrei: Preventivas  de clientes diferente do selecionado no filtro 
Imagem: (<img width="1765" height="1010" alt="image" src="https://github.com/user-attachments/assets/d497cc9c-853c-406f-b9d7-e4257f10507e" />
)

### 2026-08-11 — Chamados - Kanban
Quem: Fabrício
Tipo: Bug 
O que encontrei: Chamados com OS finalizada (chek in e check out) aparecendo em solicitação
Imagem: (<img width="1765" height="1010" alt="image" src="https://github.com/user-attachments/assets/d497cc9c-853c-406f-b9d7-e4257f10507e" />
)

### 2026-08-11 — Chamados - Kanban
Quem: Fabrício
Tipo: Bug 
O que encontrei: Início e fim de visita aparecendo na coluna solicitação do kanban
Imagem: (<img width="1765" height="1010" alt="image" src="https://github.com/user-attachments/assets/d497cc9c-853c-406f-b9d7-e4257f10507e" />
)

### 2026-08-11 — Chamados - Kanban
Quem: Fabrício
Tipo: Bug 
O que encontrei: Preventivas  de clientes diferente do selecionado no filtro 
Imagem: (<img width="1765" height="1010" alt="image" src="https://github.com/user-attachments/assets/d497cc9c-853c-406f-b9d7-e4257f10507e" />
)
