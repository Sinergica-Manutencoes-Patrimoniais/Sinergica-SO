---
name: "docs-adr-0773-e01-s172-fonte-esforco-declarado-md"
description: "Documento Sinérgica SO: ADR-0773: fonte declarada de esforço restante"
alwaysApply: false
---

# ADR-0773: fonte declarada de esforço restante

Status: proposta experimental, gate fechado, sem homologação ou consumo consolidado.

## Contexto

Fontes atuais não distinguem HH próprios, terceirizados e acompanhamento, nem esforço restante de estimativa original. A proposta executada de continuação E01-S167 registra minutos restantes, mas não explicita tipo de mão de obra nem unidade HH. Não converter esses minutos automaticamente em capacidade, nem presumir zero em ausência.

## Decisão

Preparar fonte append-only de declarações explícitas por OS ou ocorrência preparada, com Cliente e versão. Cada declaração informa separadamente minutos-homem restantes próprios, terceirizados e acompanhamento interno. Valores desconhecidos são nulos; zero é informação explícita, mas não prova demanda completa. Os dados não afirmam execução real nem substituem a proposta imutável S167. Uma ocorrência e sua OS não são duas demandas: a agregação posterior precisa resolver identidade e divisão de esforço com vínculos e regras aprovadas. Esta etapa não implementa agregação.

Comando interno exige gate fechado por padrão, sessão, capacidade efetiva no Cliente, identidade de origem validada, revisão esperada e requestId idempotente. A autorização utiliza o protocolo 0319 e apenas READ COMMITTED. Ações são auditadas, registros imutáveis e protegidos por RLS FORCE; não há EXECUTE concedido a papéis de aplicação. Os dados legados não são alterados ou inferidos. Nenhuma integração Auvo é criada.

## Limites

A origem é uma declaração manual, não fonte automática de restante operacional. Interfaces, fluxo completo, deduplicação, aprovações, reconciliação com S167 e cálculo de saldo aguardam implementação e revisão. Precisa validar contenção, concorrência, isolamento entre Clientes e revisão adversarial antes de qualquer exposição ou abertura do gate.

## Mediação proposta

A migração 0978 prepara mediadores de leitura e escrita para `authenticated`, ambos sujeitos ao gate da 0977 e à ação atual `capacidade.gerir` no Cliente; a função original e as tabelas permanecem inacessíveis diretamente. A consulta é por uma origem específica e retorna somente sua revisão mais recente; não soma OS e ocorrência, não calcula saldo e não presume trabalho executado. A tela é adicionalmente protegida por flag desligada por padrão. Abertura operacional depende de revisão adversarial e testes integrados, não desta mediação.
