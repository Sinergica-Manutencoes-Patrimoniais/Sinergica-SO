# ADR-0795: prova limitada de finalização de OS no snapshot

Status: proposta em gates fechados, sem homologação.

A finalização individual registrada por PCM em `sso_finalizacoes_os_validadas` é imutável e vincula OS, retorno e atestação. Pode indicar que existe um registro de finalização para aquela OS, mas não comprova que toda a ocorrência, Chamado ou trabalho restante terminou. O status atual da OS é evidência distinta e pode divergir do histórico.

O snapshot v3 reutiliza 0992 e acrescenta a cada OS de Visita apenas `finalizacao_pcm_registrada`, `nao_registrada` ou `indisponivel`. Só consulta o histórico se o gate de mediação de finalização estiver aberto e o ator tiver `execucao.validar` no Cliente; caso contrário informa indisponibilidade. Associação exige OS, Cliente, retorno e payload de finalização coerentes; registros históricos não alteram a OS. A leitura acontece no mesmo snapshot de instrução. Não expõe conteúdo de retorno nem dados de terceiros além dos já autorizados.

Na interface OS com status terminal ou desconhecido são excluídas do subtotal e seguem pendentes, mesmo com registro de finalização: estado de OS não determina conclusão da ocorrência. Origem sem status comprovado, qualificação, disponibilidade, ausência de vínculos ou saldo não é inferida. Gates permanecem fechados; concorrência, caminhos Visit/Grupo, cobertura e revisão adversarial ainda impedem homologação ou saldo completo.
