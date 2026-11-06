# ADR-0783: mediação de escopo declarado

Status: proposta; gate fechado, homologação pendente.

Preparar funções de leitura por OS e escrita mediada sobre a fonte 0983. Autorização atual `execucao.validar`, Cliente, origem e gates do comando e resolvedor permanecem obrigatórios; `authenticated` recebe EXECUTE apenas nos mediadores e não lê ou escreve tabelas diretamente. A leitura retorna revisão, descrição declarada e `execucaoComprovada=false`, sem alterar OS ou contabilizar demanda. UI fica atrás de flag própria e não sugere execução confirmada. Resultado incerto preserva tentativa e requestId por usuário, Cliente e OS durante a vida da aba.

Ainda falta prova concorrente, caminhos de Grupo Quantitativo e Visita, contabilização e revisão adversarial; nenhuma dessas funções deve ser usada para abrir gates ou homologar integração.
