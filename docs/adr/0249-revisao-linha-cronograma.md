# ADR-0249 — Revisão de linha de cronograma no staging

Status: proposta, não homologada.

Uma linha do lote unificado pode receber declaração humana de revisão ou rejeição, com justificativa, versão e ator. Cada declaração é imutável e a última por linha é o estado declarado atual; ela não equivale a aprovação nem altera Plano, Rotina ou ocorrência. Uma linha rejeitada pode voltar a revisão por nova declaração histórica. A autorização de gestão do Plano é verificada no Cliente e o lote serializado para revisão otimista e idempotência. Escrita e leitura ficam sem EXECUTE, dependem do gate e exigem testes e revisão antes da ativação. Rollback operacional: desligar o gate, preservando o histórico.
