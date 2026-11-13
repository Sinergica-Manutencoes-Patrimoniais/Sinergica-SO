# Feature Specification: Ativação governada de jornada (gates, flags e grants)

**Story:** E01-S188 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-13
**Feature Branch (planejada):** `feat/E01-S188-ativacao-governada`
**Status:** Especificada — implementação não iniciada.

**Input:** Reanálise do Fabrício de 12/11/2026 (perguntas 4, 5, 6, 7 e riscos 1 e 2) e conferência do Caderno Técnico.

## Contexto — o problema que esta story resolve

O repositório tem **585 gates de banco** e **737 flags `VITE_SSO_*`**. Uma funcionalidade só fica
utilizável quando **três camadas** coincidem: `grant execute` na função, linha de gate aberta no
banco e flag de build ligada no Netlify. Faltando qualquer uma, o resultado é `42501`, `55000` ou
simplesmente um componente que não renderiza — três sintomas diferentes para a mesma causa.

Não existe hoje nenhum lugar que responda **"esta jornada está utilizável? se não, o que falta?"**.
A consequência está medida: o Fabrício classificou 70–75% de código preparado contra 35–45% de
funcionalidade utilizável, e o relatório dele de 12/11 repete a mesma observação do relatório
anterior — *"a publicação observada ainda mantém telas vazias e modelo operacional legado"*.

Cada story nova repete o problema. Sem esta story, as correções das demais voltam ao mesmo estado:
entregues no código, invisíveis na operação.

**Esta story não abre nenhum gate.** Ela torna o estado de ativação legível, diagnosticável e
reversível, para que abrir seja uma decisão informada em vez de arqueologia.

## User Scenarios & Testing

### US1 — Declarar o que uma jornada exige para funcionar (Priority: P1)

**Why this priority:** Sem o registro declarativo, o diagnóstico e o runbook não têm fonte de verdade.

**Independent Test:** Declarar a jornada "Chamado com várias OS" e verificar que o registro lista
seus gates, flags e funções; alterar o registro e ver o diagnóstico mudar junto.

**Acceptance Scenarios:**

- **AC-1:** Dada uma jornada declarada, quando consultar seu registro, então ele lista todos os gates de banco, todas as flags de build e todas as funções com grant necessário, cada item com o motivo de existir e quem é o responsável por abrir.
- **AC-2:** Dado um registro de jornada, quando ele citar um gate, flag ou função que não existe no schema ou no código, então a verificação falha com o nome do item inexistente — um registro que aponta para o vazio é pior do que nenhum registro.
- **AC-3:** Dada uma jornada, quando declarar, então ela registra também sua **ordem de abertura** e o **procedimento de retorno** de cada etapa; uma jornada sem rollback declarado não pode ser marcada como pronta para ativação.

### US2 — Diagnosticar, em produção, o que falta para a jornada funcionar (Priority: P1)

**Why this priority:** É o que transforma a pergunta do Fabrício em resposta com evidência, sem SQL manual.

**Independent Test:** Com uma jornada parcialmente ativada, consultar o diagnóstico e confirmar que
ele aponta exatamente a camada faltante, sem expor valor de segredo nem conteúdo de gate alheio.

**Acceptance Scenarios:**

- **AC-4:** Dada uma jornada declarada, quando um superadmin consultar o diagnóstico, então recebe por camada o estado real — gate aberto ou fechado, grant presente ou ausente, flag ligada ou desligada — e uma conclusão única: utilizável, ou a lista do que falta.
- **AC-5:** Dado um usuário sem papel de administração, quando consultar o diagnóstico, então é recusado; o mapa de ativação revela a superfície do sistema e não é informação pública.
- **AC-6:** Dada uma flag de build, quando diagnosticar, então o estado vem do **build publicado**, não de suposição — uma flag mudada no Netlify sem republicar aparece como divergente entre o declarado e o servido.

### US3 — Abrir e fechar uma jornada por procedimento, não por SQL avulso (Priority: P2)

**Why this priority:** Fecha o ciclo: sem o caminho de volta testado, ninguém autoriza a abertura.

**Independent Test:** Abrir a jornada piloto em ambiente de teste pelo procedimento, confirmar o
diagnóstico como utilizável, executar o retorno e confirmar que voltou ao estado anterior.

**Acceptance Scenarios:**

- **AC-7:** Dada uma jornada e um ator autorizado, quando executar a abertura, então os gates são abertos na ordem declarada, cada passo é registrado em auditoria com ator, data e motivo, e qualquer passo que falhe interrompe a sequência sem deixar a jornada meio aberta.
- **AC-8:** Dada uma jornada aberta, quando executar o retorno, então os gates voltam ao estado anterior na ordem inversa e o diagnóstico volta a apontar não utilizável; dados criados enquanto a jornada esteve aberta **não** são apagados.
- **AC-9:** Dada uma tentativa de abrir jornada cujo diagnóstico aponta camada faltante fora de gate — grant ausente ou flag não publicada — então a abertura é recusada, porque abrir gate sem as outras camadas produz erro na cara do usuário em vez de funcionalidade.

### Edge Cases

- Gate que não é ativação de feature e sim troca de mecanismo de proteção (ex.: `pcm.sso_guarda_multiplas_os_gate`, que **deve** ficar aberto depois da migration 1842) precisa ser declarado como tal e nunca entrar numa lista de "fechar tudo".
- Jornada declarada cujo gate já esteja aberto por decisão anterior: abrir de novo é no-op registrado, não erro.
- Duas jornadas que compartilham o mesmo gate: fechar uma não pode derrubar a outra sem aviso explícito.
- Diagnóstico consultado durante um deploy: estado divergente é resultado legítimo e deve ser rotulado como tal, não mascarado.

## Requirements

### Functional Requirements

- **FR-001:** Declarar, por jornada, as três camadas exigidas e a ordem de abertura, conforme AC-1, AC-2, AC-3.
- **FR-002:** Diagnosticar o estado real de ativação por jornada, restrito a papel administrativo, conforme AC-4, AC-5, AC-6.
- **FR-003:** Abrir e retornar jornada por procedimento auditado e idempotente, conforme AC-7, AC-8, AC-9.
- **FR-004:** Impedir que uma funcionalidade nova entre na `main` sem registro de ativação correspondente — verificação de CI, no mesmo espírito do gate que já exige `CREATE POLICY` com `GRANT`.
- **FR-005:** Tratar carregamento, vazio, falha e sucesso na superfície de consulta, com navegação por teclado.

### Key Entities

**Jornada** é o recorte que a operação reconhece ("Chamado com várias OS", "Central de Materiais",
"Despacho T−24") — não é story, não é tabela. **Registro de ativação** liga a jornada às três
camadas e à ordem. **Diagnóstico** é leitura do estado real, nunca do declarado. **Evento de
ativação** é append-only e registra ator, jornada, direção, etapa e motivo.

## Success Criteria

- **SC-001:** Um superadmin responde "o que falta para a jornada X funcionar?" em uma consulta, sem abrir SQL.
- **SC-002:** Abrir e fechar a jornada piloto é reproduzível por procedimento registrado, com retorno comprovado em teste.
- **SC-003:** Nenhuma jornada declarada aponta para gate, flag ou função inexistente — verificado em CI.
- **SC-004:** As perguntas 4, 5, 6 e 7 da reanálise do Fabrício passam a ter resposta por evidência consultável.

## Assumptions & Dependencies

- As 585 linhas de gate não precisam ser declaradas de uma vez. A story entrega o mecanismo e a declaração das jornadas do piloto; as demais entram conforme forem ativadas.
- Não depende de credencial Auvo nem de decisão de navegação.
- É pré-requisito prático de E01-S189, E01-S191 e E01-S192.

## Fora de escopo

- Abrir qualquer gate em produção. Esta story entrega o mecanismo e o procedimento; a decisão de ativar é operacional.
- Reduzir a quantidade de gates ou flags existentes.
- Interface de administração completa; basta a superfície de consulta exigida por AC-4.
