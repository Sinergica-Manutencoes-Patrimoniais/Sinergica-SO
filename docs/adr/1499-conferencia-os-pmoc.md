# ADR-1499 — Conferência ao abrir OS pelo PMOC

Uma ocorrência do Plano pode ser preparada antes da abertura de OS no fluxo PMOC. A conferência exclusiva no gerador do Plano não protege a criação posterior pelo PMOC.

Sob o gate de origem e protocolo de concorrência, ao inserir uma OS com vínculo PMOC (ou mudar esse vínculo), verificar as ocorrências preparadas do Cliente na data do agendamento. Para cada Plano e identidade, exigir versão única vigente e classificação humana atual: agendamento não relacionado ao Plano sem vínculo válido, ou relacionado a outra Rotina/alvo com vínculo válido nessa versão. Vínculo à mesma identidade, ausência de classificação ou fotografia alterada exige reconciliação. A validação não altera agendamento, OS histórica ou retornos Auvo; atualização de status sem mudança de vínculo não passa pela guarda.

O controle é conservador e não comprova fontes externas; manter gate desligado até validar concorrência em ambas as ordens, permissões do fluxo PMOC, replays e impacto operacional, além de revisão adversarial. Homologação e deploy seguem bloqueados.
