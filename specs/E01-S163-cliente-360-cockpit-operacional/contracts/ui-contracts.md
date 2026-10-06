# UI Contracts: Cliente 360 como cockpit operacional

## 1. Identificador assistido

### Action: `Aplicar recomendações`

- Visível quando existem siglas ausentes com sugestões.
- Usa os valores atualmente editados, sem sobrescrever a intervenção humana.
- Atualiza a prévia do Identificador e o estado de validação.
- Não executa escrita remota.
- Fica desabilitada se qualquer sugestão visível for inválida; o campo correspondente informa o motivo.

### Save

- Revalida caminho, siglas e unicidade.
- Persiste por meio do use case existente de identificador; falha não fecha modal.
- Não altera identificador existente sem ação de edição explícita e aviso de QR code.

## 2. Shared contextual drawer

### Props contract

```text
open: boolean
context: ContextoDetalhe360 | null
onOpenChange(open): void
onMutationSuccess(affectedKeys): void
```

### Behavior

- Largura permite leitura de histórico sem cobrir completamente a lista em desktop.
- Cabeçalho fixa número/título, cliente e estado; corpo rola; ações permanecem alcançáveis.
- OS com `chamadoId` compõe o `ChamadoPainel` já existente.
- Fechar restaura o foco no acionador. Se o item sumiu, retorna ao título/contêiner da lista.
- Escape fecha somente a camada superior; confirmação destrutiva interna tem prioridade.
- Troca de cliente fecha o drawer imediatamente.
- Loading, not found/forbidden e error são estados explícitos; retry só repete a seção falha.

## 3. Preventive views

### View switcher

Valores: `lista`, `timeline`, `calendario`.

- Primeiro uso: `lista`.
- Mudança é salva como preferência local não sensível.
- Todas as visões recebem os mesmos `planos`, `ocorrencias`, cliente e intervalo temporal.
- Seleção de ocorrência chama `onSelectOccurrence(id)`; seleção de plano chama `onSelectPlan(id)`.

### Ordering

- Lista: vencimento ascendente por padrão, com atrasadas primeiro; histórico pode inverter para mais recente.
- Timeline: ordem cronológica e separação visual entre previsto, enviado, executado e falha.
- Calendário: preserva o comportamento atual e agrega excesso no dia com expansão acessível.

### Detail sections

- Resumo e estado.
- Planejamento/recorrência e alvo.
- Próximas ocorrências.
- Histórico de execução.
- OS associadas e link Auvo.
- Ações autorizadas, incluindo editar apenas campos permitidos e pausar/retomar.

## 4. Filter bar

### Composition

- Busca tem debounce visual curto ou cálculo imediato dentro do orçamento de 300 ms.
- Multiselect usa OR internamente; grupos diferentes usam AND.
- Chips resumem filtros ativos e podem ser removidos individualmente.
- “Limpar filtros” restaura defaults da aba.
- Contador anuncia `N visíveis de M` em região `aria-live="polite"`.

### Empty states

- `M = 0`: “Este cliente ainda não possui …”, com ação de cadastro se autorizada.
- `M > 0 && N = 0`: “Nenhum resultado com estes filtros”, com ação Limpar filtros.
- Falha de relação auxiliar não deve apresentar resultado enganoso; exibir erro local e retry.

## 5. Navigation groups

| Grupo | Áreas |
|---|---|
| Operação | Resumo, Timeline, OS, Preventivas, Inspeções, Assessment |
| Ativos | Estrutura, Componentes, Sistemas, Ferramentas, Árvore, Board |
| Gestão/Relacionamento | Financeiro, Comercial, Comunicação |

- Grupo e aba ativos têm indicação textual e visual.
- Em largura insuficiente, itens secundários vão para “Mais”; o item ativo nunca fica invisível sem o rótulo do grupo.
- Ordem das abas dentro do grupo é estável.

### Client context rail

- Substitui o card de cliente alto por uma única faixa horizontal antes da navegação.
- Ordem de leitura: nome do cliente, endereço, situação, CNPJ, contato, cidade/UF e identificador Auvo.
- Nome é a única ênfase primária; demais dados usam tamanho e peso de texto secundários, com ícones funcionais de localização, telefone/e-mail e integração.
- Status é apresentado uma única vez, em chip discreto; não repetir “cliente/ativo/ativo com contrato”.
- Ações operacionais seguem à direita ou em overflow responsivo, sem reduzir a legibilidade do contexto.
- Em viewport sem largura suficiente, preservar nome, situação e endereço e mover metadados adicionais para “Mais dados do cliente”; não ocultar dados por truncamento silencioso.

## 6. Quick actions

`Novo Chamado`, `Nova OS`, `Nova Preventiva`, `Novo Componente`.

- Cada ação herda o cliente atual e abre o fluxo existente contextualizado.
- Permissão é avaliada antes de renderizar e novamente no use case/backend.
- Concluir invalida apenas as query keys afetadas; cancelar não muda dados nem contexto.

## 7. Visit-marker exclusion

- Toda projeção de manutenção usa `ehOsRegistroVisita` antes de contar ou renderizar.
- Não implementar `titulo.includes(...)` em componente.
- Somente títulos normalizados exatamente iguais aos valores de domínio são excluídos.
