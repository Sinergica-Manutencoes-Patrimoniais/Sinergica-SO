# ADR-1061 — Composição local do leitor incremental XLSX

**Status:** experimental, desligada e não homologada. Complementa ADR-1060.

A entrada XLSX pode compor o processador incremental direto somente com opção experimental explícita e URL Supabase de loopback. Continua exigindo a flag geral, CORS, autenticação, limite, autorização, atestado e gates de banco. O caminho padrão permanece com Worker. A configuração não permite o modo direto com URL hospedada e não implanta serviço ou abre gates.

Essa composição permite integração local posterior, mas não isola CPU/memória, não prova equivalência nem autoriza uso com dados reais. O cancelamento é cooperativo. Antes de uma alternativa hospedada, comprovar limites e isolamento por requisição na plataforma efetiva, controle de concorrência, autenticidade de bytes/matriz e revisão adversarial. Remover a restrição de loopback exige nova decisão e testes; não basta ligar flag.
