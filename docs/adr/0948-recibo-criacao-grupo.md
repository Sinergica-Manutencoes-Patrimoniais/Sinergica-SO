---
name: "docs-adr-0948-recibo-criacao-grupo-md"
description: "Documento Sinérgica SO: ADR-0948 — Recibo transacional para criação de grupo"
alwaysApply: false
---

# ADR-0948 — Recibo transacional para criação de grupo

Status: preparação local, não homologada; complementa ADR-0947.

## Decisão

Usar o UUID escolhido para o grupo como identidade da tentativa. A criação e um recibo privado e imutável são gravados na mesma transação. Repetição do mesmo ator e conteúdo devolve o resultado registrado sem recriar ou reescrever o grupo; mesmo ID com conteúdo ou ator diferente é conflito. A aplicação conserva a tentativa durante resposta incerta e só a remove após confirmação da mesma sessão.

A função passa a `SECURITY DEFINER` porque o recibo não pode ser forjado pelo chamador. Ela valida sessão, papel atual ativo, claim compatível e campos, toma a trava de autorização e não concede acesso direto ao recibo. Execução para papéis da aplicação permanece revogada. Nenhum segredo ou senha entra no recibo.

## Limites

É necessário verificar o papel proprietário e FORCE RLS, toda a matriz de autorização, transações concorrentes/revogação, replay após edição do grupo, payload divergente, rollback, privacidade, falhas de rede e coordenação entre abas. Consultar o mesmo recibo não é autorização para alterar dados. Criar o grupo em outra aba com outro ID é outra tentativa; a unicidade de nome existente não substitui coordenação distribuída. Não habilitar antes de testes e revisão adversarial.
