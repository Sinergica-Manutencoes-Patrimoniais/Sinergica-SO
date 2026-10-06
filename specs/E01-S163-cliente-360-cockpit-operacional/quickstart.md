# Quickstart: validar E01-S163

## Prerequisites

- Dependências instaladas com pnpm.
- Ambiente local do web app configurado.
- Dois clientes de teste com dados distintos.
- Um cliente com componentes/sistemas, ferramentas ativas e devolvidas, planos preventivos e OS incluindo registros “Início visita”/“Fim visita”.

## Focused automated checks

Execute primeiro os testes alterados pela fatia em desenvolvimento:

```bash
pnpm --filter @sinergica/web test -- CampoIdentificador
pnpm --filter @sinergica/web test -- ordens-servico
pnpm --filter @sinergica/web test -- PreventivasWorkspace
pnpm --filter @sinergica/web test -- cliente-360-filtros
pnpm --filter @sinergica/web test -- VisaoClientePage
```

Antes de entregar:

```bash
pnpm run eval:spec
pnpm run ci:local
```

## Manual smoke test

1. Abra um componente sem todas as siglas, ajuste uma sugestão e aplique as recomendações.
2. Confirme que o Identificador é preenchido antes de salvar e que cancelar não persiste nada.
3. No Cliente 360, filtre Componentes e Sistemas por localização e relacionamento.
4. Em Ferramentas, combine categoria, situação e período; valide o contador e Limpar filtros.
5. Em Estrutura, busque um nó profundo e confirme que seus ancestrais permanecem visíveis.
6. Abra uma OS pelo Resumo e outra pela aba OS; feche o drawer e confirme aba, filtros, rolagem e foco.
7. Abra OS com chamado e compare dados/ações com a tela global.
8. Confirme que “Início visita” e “Fim visita” não aparecem nem contam no Cliente 360, mas permanecem na agenda/apontamento.
9. Em Preventivas, alterne Lista, Timeline e Calendário e abra a mesma ocorrência nas três.
10. Abra um plano com histórico: metadados permitidos podem ser editados; alvo/recorrência orientam pausar e criar novo plano.
11. Troque de cliente com drawer aberto e confirme fechamento imediato e ausência de dados residuais.
12. Navegue por grupos, overflow e drawers apenas com teclado.

## Performance check

- Use fixture de até 1.000 itens por aba.
- Registre o percentil 95 entre interação do filtro e atualização visual; alvo <= 300 ms.
- Se falhar, capture perfil e plano da consulta. Não adicione migration nesta story sem ADR e evidência.

## Security check

- Usuário autorizado ao cliente A não recebe entidade do cliente B ao manipular id de drawer.
- Ações ocultas por permissão também são negadas no use case/backend.
- Telemetria não contém nomes, descrições, fotos, CPF/CNPJ ou texto livre.
