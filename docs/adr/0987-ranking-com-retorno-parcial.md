---
name: "docs-adr-0987-ranking-com-retorno-parcial-md"
description: "Documento Sinérgica SO: ADR-0987 — Ranking experimental com retorno parcial"
alwaysApply: false
---

# ADR-0987 — Ranking experimental com retorno parcial

Status: preparação privada, não homologada.

Preparar consulta separada que ordena composições não promovidas, retornos integrais e retornos parciais aguardando pelo GUTD herdado da composição, com desempate por tipo em collation C e UUID. Score trafega como decimal textual para não arredondar o cursor; assinatura inclui as três fontes e configuração. Retorno parcial mantém identidade própria e não vira Pendência integral. A leitura não promove nem substitui o ranking oficial, e prioridade herdada não é nova avaliação.

Assinatura detecta alterações observáveis, não é fotografia transacional; a agregação pode ter custo alto. Gates e EXECUTE fechados. Antes de ativar, testar equivalência de collation e limites numéricos, transações concorrentes, cobertura de fontes legadas, privacidade, autorização, RLS/FORCE, desempenho e revisão adversarial. Não alterar dados ou enviar tarefas.
