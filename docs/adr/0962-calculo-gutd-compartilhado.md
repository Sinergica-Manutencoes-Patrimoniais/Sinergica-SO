# ADR-0962 — Cálculo GUTD para ranking e retornos

Status: preparação local; não homologada.

O domínio e a consulta legada de composições redistribuem o peso de Dor do Cliente quando ela não é informada. A consulta de ranking consistente 0661, em contraste, retorna pontuação nula nessa situação. Preparar função pura privada com o cálculo proporcional e reusar no ranking consistente; fatores ou pesos inválidos/ausentes produzem pontuação indeterminada, sem inventar prioridade.

O ranking mantém assinatura e paginação existentes e não integra ainda a fila de retornos. Não aplicar ou conceder acesso antes de testes diferenciais entre domínio, consultas antigas e nova função, testes de paginação e mudanças concorrentes de pesos, revisão adversarial e avaliação de rollout. A assinatura existente não fornece snapshot transacional entre páginas.
