# ADR-0355 — Perguntas opcionais na conferência estrutural

Status: proposta, não homologada.

Uma pergunta sem resposta deixa de bloquear a conferência estrutural apenas quando existe exatamente um contrato congelado válido da mesma Rotina e questionário que a declara opcional. Ausência não vira resposta OK e não cria resposta. Sem contrato inequívoco, mantém-se comportamento conservador anterior: todas as perguntas exigem resposta. Respostas existentes não inspecionadas ou fora do snapshot continuam sujeitas às mesmas restrições.

Esta mudança afeta somente a conferência estrutural preparada. A guarda de aprovação 0354 segue mais restritiva e não permite aprovar com opcional ausente; alterá-la exige revisão e testes próprios. Gate de cobertura permanece fechado, sem efeito em OS ou Chamado.
