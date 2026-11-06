# ADR-0401 — geração monotônica da composição da Visita

Status: proposto; gate fechado, sem aplicação ou homologação.

Cada mutação de vínculo de OS ou equipe incrementa uma geração privada por Visita. Mudanças no status ou exclusão de OS e na situação ou exclusão de funcionário incrementam a geração das Visitas associadas. O snapshot passa a conter essa geração, de modo que uma alteração seguida de reversão não seja considerada equivalente. Conferências anteriores sem geração ficam divergentes e permanecem intactas.

Com gate fechado os gatilhos retornam sem escrever ou bloquear linhas de contador. Cada mudança de estado do gate renova uma época incluída no snapshot: conferências feitas antes de desativar não voltam a ser equivalentes ao reativar. A geração não reconstrói alterações ocorridas com gate fechado. A ativação exige janela de quiescência e drenagem das transações anteriores, pois uma transação iniciada antes da ativação pode observar o gate antigo. A instalação e os bloqueios concorrentes quando habilitado, inclusive múltiplas Visitas por funcionário, exigem testes de integração e revisão adversarial antes de liberar. O mecanismo não comprova conteúdo integral, não autoriza envio e não modifica dados operacionais.
