# ADR-0442 — escopo e revisão de Visita na triagem de funcionário

Status: proposto; não aplicado nem homologado. O novo comando vincula a anotação a uma Visita e revisão esperada, verifica vínculo vigente de funcionário na Visita e reusa a triagem 0663 em uma transação. Retentativas repetem o mesmo identificador e exigem autorização atual e vínculo vigente; histórico antigo sem Visita não é promovido automaticamente. Não altera fila ou envia ao Auvo. Gates e grants continuam fechados; concorrência e recuperação de retentativas após mudança de vínculo requerem testes.
