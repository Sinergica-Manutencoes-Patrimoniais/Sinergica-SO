# ADR-0939 — Leitura incremental experimental de strings XLSX

**Status:** preparação isolada, sem ativação.

O processador XLSX ainda constrói DOM completo para strings compartilhadas. Preparar interpretação incremental via SAX com os limites funcionais já existentes, preservando ordem, texto rico e rejeição de estruturas ambíguas. A implementação não é conectada ao processador nem à recepção neste estágio.

A mudança não resolve memória das abas ou demais partes, nem isolamento de CPU, concorrência ou disponibilidade Edge. Antes de substituição é necessário comparar com o leitor existente nos arquivos originais e em casos adversariais, medir memória/tempo sob limites reais e revisar segurança, abortos e compatibilidade. Gates permanecem fechados. Não se reduz o limite de 100 mil strings; não inferir que documentos no limite funcionam em todos os runtimes.
