# ADR-1467 — Aplicação versionada de eventos de origem de campo

Status: preparação local, gate fechado; sem homologação ou deploy. Complementa ADR-1276.

## Contexto

Eventos posteriores aceitos são registrados de forma ordenada, mas não atualizam os dados da OS. Aplicá-los sem controle pode sobrescrever correção do PCM ou alterar uma OS preexistente que foi apenas vinculada ao Auvo.

## Decisão

Preparar controle privado de revisão da OS para novas OS criadas pela importação, iniciado na mesma transação do processamento inicial. Um trigger incrementa a revisão após qualquer atualização da OS acompanhada. A aplicação de evento aceita somente o último evento aceito, com Cliente e tarefa ainda coerentes e revisão da OS igual à última aplicação de campo. Se o PCM ou outro escritor alterou qualquer campo, a operação informa pendência sem sobrescrever dados. OS preexistentes e processamentos antigos sem controle permanecem para triagem.

Uma entrada exclusiva de serviço, com gate próprio inicialmente fechado e os gates existentes, bloqueia por tarefa, OS e revisão, aplica dados declarados de título, descrição, técnico e horários e registra recibo imutável por evento. A atualização preserva vínculo, identidade, validação PCM e demais campos, não encerra OS ou Chamado e não gera chamada Auvo. O estado de campo concluído permanece sujeito à validação PCM. Eventos antigos, divergentes ou não mais atuais não são aplicados.

O registro do evento e sua aplicação são etapas idempotentes separadas; falha ou timeout exige repetir o mesmo evento e não comprova rollback. O comando não prova integridade do contrato externo nem autenticidade da tarefa: depende da verificação independente e autorização de serviço existentes. O gate deve permanecer fechado até análise dos triggers e todos os escritores, testes de concorrência, replay, revogação, RLS/FORCE, Auth e revisão adversarial. Processamentos históricos não são retroativamente confiados ao controle automático.
