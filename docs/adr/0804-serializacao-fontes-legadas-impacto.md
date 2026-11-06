---
name: "docs-adr-0804-serializacao-fontes-legadas-impacto-md"
description: "Documento Sinérgica SO: ADR-0804 — Serialização das fontes legadas da pré-condição de impacto"
alwaysApply: false
---

# ADR-0804 — Serialização das fontes legadas da pré-condição de impacto

Status: preparada, não homologada. A pré-condição 0785 consulta a avaliação 0778, que lê `pcm.planos_preventivos` e `pcm.sso_declaracoes_planos_legados`. A trava de 0787 não cobria escritas nessas duas tabelas. Em duas sessões na base diagnóstica, com a trava global ocupada e gate de concorrência habilitado na transação de teste, UPDATE sem linhas das duas fontes prosseguiu; o mesmo comando sobre OS foi recusado. Assim uma avaliação pode observar fonte desatualizada sob concorrência.

A migration 1001 acrescenta triggers de comando para INSERT, UPDATE e DELETE nessas fontes, reutilizando a mesma trava não bloqueante e gate existentes de 0787. Desligado, preserva comportamento legado. Ligado, conflito falha com `55P03` e exige retry. Não muda conteúdo, não aprova revisão, não aciona Auvo e não libera acesso; roll-out é deixar o gate desligado. Os gatilhos afetam comandos sem linhas e quaisquer Clientes: avaliar contenção global e estratégia de retry antes de ativação.

Este recorte não prova completude das fontes, segurança de TRUNCATE/escritores privilegiados que desabilitam triggers, transações iniciadas antes do gate, revogação concorrente nem reconciliação de impactos. A guarda 0715 permanece; revisão adversarial, inventário de escritores, teste de ativação em janela isolada e integração de decisões são necessários antes de liberar aprovação.

Verificação na base descartável `supabase_db_SSO-ordem-diagnostica`: antes da 1001, testes separados falharam com `planos_preventivos_nao_serializados` e `declaracoes_legadas_nao_serializadas`. Com 1001 instalada apenas na transação, o teste manual `supabase/manual-tests/E01-S165_fontes_legadas_concorrencia.sql` passou com trava mantida pela outra sessão. Com gate desligado, ambos os UPDATEs de zero linhas passaram. As duas transações e a migration foram revertidas; o teste verifica protocolo por statement, não uma aprovação ponta a ponta nem mutação real de registros.

## Inventário da avaliação e limites

- A avaliação 0775 lê ocorrências de calendário, ponte legada e OS (protocolo 0787), além da última decisão por ocorrência. O comando de decisão 0773 bloqueia o Plano antes de inserir; tabela de decisão é append-only para UPDATE/DELETE e sem grants diretos aos papéis da aplicação. Isso não demonstra cobertura de todo escritor privilegiado.
- A avaliação 0778 lê ocorrências de Visita e calendário, ocorrências preventivas, pontes e OS (0787), além de Planos preventivos e declarações de relação (1001). O comando de declaração 0667 bloqueia Plano e Plano legado; escrita direta privilegiada não é equivalente a esse comando.
- A prévia 0314 lê Plano, versões, Rotinas, `pcm.plano_comandos` e `audit.events`. Trava do Plano protege apenas escritores que seguem esse protocolo; na base diagnóstica não há triggers não internos em `plano_comandos` ou `audit.events`, e `service_role` tem INSERT em `audit.events`. A capacidade de adulterar a origem ou sua exploração não foi demonstrada; exige auditoria de ACL, escritores e integridade de comandos/auditoria antes de confiar na origem como prova.
- O preflight 0770 lê ainda declarações de fuso e catálogo PostgreSQL. A declaração 0760 bloqueia o Plano e grava histórico imutável, mas a fonte contratual e a segurança de todos os escritores não foram demonstradas. A autorização é consultada separadamente; sua revogação concorrente não é resolvida por 1001.

Teste adicional `supabase/manual-tests/E01-S165_impacto_legado_linha.sql` criou Plano preventivo sintético cujo Cliente aparece na contagem de 0778. Com a trava mantida por outra sessão, seu DELETE chegou a executar antes de 1001, falhando com `exclusao_alterou_fonte_impacto`; após 1001 recebeu `55P03` e a contagem permaneceu 1. Tudo foi revertido. O teste cobre uma linha e uma ordem, não executa a avaliação completa nem prova todas as operações, fontes e escalonamentos.
