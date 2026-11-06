# ADR-0856 — Serialização da ocorrência de calendário com retorno

Status: proposta implementada, gate fechado; homologação pendente.

O resolvedor de origem consultava a ocorrência sem impedir sua alteração concorrente. Em banco sintético, um escritor `service_role` alterou o vencimento e confirmou a transação enquanto a classificação de um retorno ainda estava aberta; ambas confirmaram, deixando origem incompatível.

Com o gate `sso_integridade_retorno_calendario_gate` desligado, nada muda. Com o gate ligado, a classificação e a criação de pendência bloqueiam em modo compartilhado a ocorrência legada antes de resolver a origem, exigindo READ COMMITTED. Um gatilho impede exclusão e alteração efetiva de plano ou vencimento de ocorrência que já possua retorno. Alterações sem mudança dos campos e de outros campos continuam permitidas. O bloqueio dura até o fim da transação; se o escritor chegar primeiro, a resolução reavalia o estado confirmado.

O comportamento é deliberadamente restritivo para os escritores existentes somente com o gate ligado, inclusive service_role. Alterações anteriores à existência do retorno continuam possíveis, sujeitas às demais regras. Ativação requer inventariar escritores, operação de reagendamento e tratar exceções; não apaga nem modifica registros existentes. O gate permanece fechado. A proteção não comprova concorrência de alterações em plano, versão, vínculos ou outras fontes; essas dependências ainda precisam de análise antes de homologação.
