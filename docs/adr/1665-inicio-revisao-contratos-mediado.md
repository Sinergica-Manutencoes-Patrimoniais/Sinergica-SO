---
name: adr-1665-inicio-revisao-contratos-mediado
description: Define a borda autenticada para início mediado de revisão com contratos.
alwaysApply: false
---

# ADR-1665 — Início mediado de revisão com contratos

Status: proposta; gate fechado.

A interface seleciona contratos, evidências ou exigências, mas as três funções internas foram deliberadamente privadas. Uma borda autenticada única autoriza o ator e Cliente atuais, serializa revogações pelo protocolo 0319 e mantém bloqueados os gates das operações selecionadas durante toda a transação. O modo é explícito e faz parte da identidade do pedido. O gate da borda começa fechado; sua abertura depende de revisão, testes e homologação.

A transação usa READ COMMITTED, uma trava por request e o Plano do Cliente. Antes de chamar qualquer função interna, procura o mesmo request nas três tabelas imutáveis de recibos: um recibo único, do mesmo modo, ator e payload é repetido; divergência ou múltiplos recibos falham. Pedidos novos usam a implementação interna existente, preservando resposta e histórico. O replay exige acesso, gate da borda e os gates próprios do modo atuais; gates transitivos de outros modos só são exigidos para pedidos novos. Funções internas e suas permissões não são abertas.

As travas de gates usam NOWAIT, inclusive as transitivas depois do Plano, para falhar com 55P03 em contenção. O plano e as tabelas forçadas por RLS exigem proprietário de função capaz de aplicar as políticas conforme o contrato de implantação; a migration falha se seu executor não for superusuário ou BYPASSRLS. O preflight também verifica SECURITY DEFINER, BYPASSRLS e EXECUTE nas chamadas diretas dos três núcleos. Também verifica privilégios nas tabelas diretamente acessadas pelos três núcleos e as travas da borda. Não comprova triggers ou dependências transitivas, nem substitui avaliação no destino. A invocação de funções privadas por papéis privilegiados fora desta borda não participa da serialização entre modos; sua ACL deve continuar fechada. Concorrência, replays históricos e interação com alterações de gates exigem testes isolados antes de ativar. Não há deploy ou comunicação com Auvo nesta etapa.
