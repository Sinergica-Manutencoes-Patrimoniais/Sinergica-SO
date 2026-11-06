---
name: "docs-adr-0099-lista-materiais-original-md"
description: "Documento Sinérgica SO: ADR-0099 — Lista de materiais com evidência original imutável"
alwaysApply: false
---

# ADR-0099 — Lista de materiais com evidência original imutável

## Estado

Decisão proposta para a fundação local de E01-S179. Não habilita produção, compra, despacho, alteração de OS ou envio Auvo.

## Decisão

Lista é um agregado próprio com UUID, Cliente e OS existentes, responsabilidade declarada `cliente` ou `sinergica`, texto original preservado integralmente, estado inicial `levantada`, revisão 1 e ator de criação. O banco exige vínculo composto OS/Cliente; OS ausente, excluída ou de outro Cliente não pode ser usada. A criação não reclassifica a OS nem infere itens, quantidade, unidade ou disponibilidade. Linhas organizadas continuam opcionais e são incremento separado.

A ação existente `material.gerir`, sujeita a escrita PCM e concessão, delimita acesso sem inferir direitos de `cadastro.gerir` ou conceder automaticamente a usuários; leitura inicial é restrita à mesma ação até existir política específica. O servidor valida acesso atual após adquirir os locks necessários, incluindo em retry. Tabela e comandos mantêm RLS FORCE e nenhuma escrita direta para authenticated/anon/service_role.

Comando de criação exige `requestId`, revisão esperada zero, identidade da lista, OS, responsabilidade e texto explícito. Obtém Cliente da OS, serializa o request, valida entidade e autorização, insere agregado, auditoria mínima e resultado idempotente na mesma transação. Repetição com mesma identidade, ator e payload retorna mesmo resultado; requestId divergente conflita. O texto original não é normalizado e não é copiado para payload de auditoria. Limites explícitos impedem entradas vazias ou desproporcionais.

Leitura filtrada por Cliente e OS deverá ser paginada, exigir autorização atual, devolver apenas campos necessários e distinguir erro/vazio. A criação isolada não fornece leitura de linhas, disponibilidade, exceção, integração de Chamado/Cliente360, estado de aquisição ou operação da OS. Essas tarefas e a autorização de outros perfis permanecem abertas.

## Gates

Antes de aplicação: testes pgTAP de criação, rollback, permissões atuais, escopo cruzado, OS inválida, texto preservado e idempotência; prova com duas sessões para repetição concorrente, concorrência com alteração/exclusão de OS e revogação durante espera. Revisar política e minimização de dados, custo, CI db-tests e revisão adversarial. Sem banco de teste disponível, teste escrito não é prova e migration não deve ser aplicada nem considerada homologada.
