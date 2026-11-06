# ADR-1203 — Declaração de deslocamento da equipe própria

## Contexto

S172 precisa distinguir duração de deslocamento e horas-homem. A quantidade de participantes da Visita não comprova quem se desloca ou pertence à equipe própria. A informação digitada na simulação também não é fonte persistida.

## Decisão

Preparar histórico aditivo de declarações por Visita, com duração por pessoa e quantidade de pessoas próprias informadas explicitamente, revisão da Visita e revisão da declaração. O comando autentica o ator, exige capacidades de capacidade e de Visita para o Cliente, serializa a Visita e o requestId, recusa revisões obsoletas e registra auditoria. A consulta expõe a última declaração sob os mesmos controles. Repetição idêntica devolve recibo; conteúdo divergente é recusado. Zero é declaração explícita, não valor presumido.

A declaração é planejamento, não prova de deslocamento executado, nem identificação das pessoas. Não será somada automaticamente à demanda: é necessário estabelecer proveniência, evitar dupla contagem com estimativas existentes, adaptar consumidores e validar concorrência antes da integração. Gate fechado por padrão; não altera Visita, OS ou Auvo.

## Consequências e gates

Não aplicar ou habilitar antes de testes de permissões, RLS/FORCE, replay, revisão, troca de Cliente, concorrência, limites e revisão adversarial. Dados existentes não recebem backfill. Revogação de permissão e ordem de locks devem ser verificadas com todos os escritores reais; a fotografia da Visita não impede alteração logo após o comando. A ausência de declaração permanece desconhecida.
