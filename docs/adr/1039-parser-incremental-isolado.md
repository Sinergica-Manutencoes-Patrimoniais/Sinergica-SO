# ADR-1039 — Parser incremental em worker dedicado

Status: preparação experimental, sem integração operacional ou testes desta alteração.

Preparar execução do parser incremental em worker terminável, conservando o mesmo contrato externo de processamento e o isolamento de cancelamento já utilizado pelo leitor DOM. O parser continua materializando matrizes e partes extraídas; worker não impõe limite próprio de memória nem prova isolamento em ambiente hospedado. O runtime Edge já observado sem `Worker` permanece incompatível e a rota operacional não passa a usar esta alternativa.

Antes de qualquer integração, demonstrar equivalência de matrizes, fórmulas, estilos, erros e limites com as fontes originais e entradas adversas; testar memória, CPU, timeout, pacote de módulos e concorrência no runtime de destino. Manter gates fechados e realizar revisão adversarial. Não inferir segurança apenas de um parser SAX.

O comparador experimental executa leitores isolados sequencialmente e relata diferenças de hash, matriz, prévia e evidências sem devolver dados. Dupla recusa não prova equivalência das causas; comparação textual pode apontar diferenças de representação. O diagnóstico não está ligado à rota e não demonstra segurança ou abrangência de XLSX.
