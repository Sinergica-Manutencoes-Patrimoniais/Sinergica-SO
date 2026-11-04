# ADR-0984 — Promoção do restante declarado

Status: preparação privada, não homologada.

Preparar promoção de retorno parcial aguardando para novo Chamado, parcela e ciclo, preservando fonte e descrição/minutos restantes congelados. A parcela recebe exatamente a descrição restante, nunca a descrição integral da Pendência; recibo mantém o tempo restante sem afirmar que é capacidade reservada. A transação não cria OS ou tarefa. Repetição idêntica retorna recibo; ciclo anterior e vínculos históricos permanecem.

O comando confirma novamente proposta, vínculo, revisão humana, suspensão, interrupção, OS anterior, Cliente e permissões, sem afirmar que a execução remota parou. O comando existente de parcela aceita até 1.000 caracteres; propostas maiores são recusadas sem truncamento até a expansão coordenada desse contrato. O modelo de ciclos precisa reconhecer tanto promoções integrais quanto parciais. Antes de ativar, bloquear/conciliar criação de OS para a proposta antiga, adaptar todos os consumidores legados, unir os rankings, provar exclusividade global, autorização, locks, RLS, integridade e concorrência; executar testes e revisão adversarial. Gates e EXECUTE fechados, sem deploy ou Auvo.

Os mediadores experimentais 1128–1131 passam a usar verificador privado que aceita exatamente um recibo de promoção, integral ou parcial. Esse verificador é criado na 1137; a aplicação precisa ser sequencial e os gates permanecer fechados até todo o conjunto estar presente. Não demonstra cobertura dos demais consumidores.
