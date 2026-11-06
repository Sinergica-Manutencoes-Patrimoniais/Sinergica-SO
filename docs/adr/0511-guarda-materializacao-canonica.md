# ADR-0511 — Guarda de materialização canônica

Status: preparada, gate desligado, não aplicada nem homologada. Quando habilitada, inserções de ocorrência preparada 0337 exigem token privado da transação emitido pelo caminho 0734 para o mesmo Plano, versão, Rotina e vencimento. Gate desligado preserva o comportamento anterior. Tokens não são acessíveis a clientes e são removidos na própria transação; falhas revertem tudo.

A proteção cobre inserções na tabela preparada, não outros geradores ou alterações diretas de tabelas legadas. Exige inventário, análise de locks/isolation, reconciliação de dados, testes de bypass e revisão adversarial antes de ativação. Não cria OS ou tarefa.
