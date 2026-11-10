---
name: "docs-adr-0810-serializacao-decisao-fuso-impacto-md"
description: "Documento Sinérgica SO: ADR-0810 — Serialização das fontes de decisão e fuso"
alwaysApply: false
---

# ADR-0810 — Serialização das fontes de decisão e fuso

Status: proposta, sem homologação. A avaliação 0775 lê a decisão mais recente em `pcm.sso_decisoes_impacto_ocorrencia`; o preflight 0770 lê o fuso mais recente em `pcm.sso_fusos_plano_declarados`. Seus comandos canônicos 0773 e 0760 bloqueiam o Plano antes de inserir, e as tabelas não concedem escrita direta aos papéis da aplicação. A pré-condição 0785 bloqueia o Plano. Portanto não se demonstrou corrida pelos comandos canônicos.

O protocolo global 0787 não abrangia INSERT direto nessas duas tabelas. Teste com escritor privilegiado e duas sessões demonstrou inserção de fuso sintético posterior enquanto a trava estava ocupada; não ocorreu alteração persistente. Um INSERT sem linhas na tabela de decisões também não tomou a trava. Isso é lacuna de defesa contra outros escritores privilegiados que não sigam o protocolo, não prova de exploração por usuário comum.

Migration 1006 acrescenta triggers de INSERT para as duas fontes, reutilizando o gate e a trava não bloqueante de 0787. As operações concorrentes falham com `55P03`, sem esperar; o gate desligado preserva comportamento. UPDATE/DELETE já são bloqueados por triggers append-only. Não alterar dados históricos nem abrir gates. O protocolo global pode causar contenção entre Clientes e exige tratamento de retry, inventário de escritores e teste de ativação em janela segura antes de uso. Não protege `TRUNCATE`, gatilhos desabilitados ou transações iniciadas antes da ativação; não resolve autorização revogada, integridade integral de impactos, aprovação ou reconciliação. Guarda 0715 permanece fechada.

Evidência: `supabase/manual-tests/E01-S165_fuso_impacto_concorrente.sql` falhou antes da migration com `fuso_impacto_alterado_sem_serializacao`. Após aplicação temporária, a inserção da segunda declaração foi recusada e a primeira permaneceu última; INSERT de zero linhas em decisões também foi recusado. A primeira inserção de fuso ocorreu com gate desligado e passou. Duas sessões em base descartável; fixture, DDL e alteração temporária do gate foram revertidas. O segundo teste não cobre uma decisão real, nem aprovação ponta a ponta. Uma tentativa intermediária de executar SQL inline falhou por escape (`invalid command`); a sessão terminou sem commit e o teste foi repetido pelo arquivo manual com sucesso.
