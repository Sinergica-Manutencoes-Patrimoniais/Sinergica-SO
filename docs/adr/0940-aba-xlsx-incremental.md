# ADR-0940 — Leitura incremental experimental de aba XLSX

**Status:** preparação isolada, sem habilitação.

O DOM da aba pode exceder memória mesmo com XML limitado a 4 MiB. Preparar leitor SAX de células com mesmos limites funcionais e saída tipada existente, preservando referências, texto rico, fórmulas, estilos e erros. O resultado continua materializado para as etapas atuais; não é garantia de memória constante.

Não conectar à recepção antes de demonstrar equivalência nos arquivos originais e cenários adversariais, cancelamento, limites de CPU/memória no runtime real, tratamento de XML e revisão de segurança. As demais partes e limites distribuídos também precisam de solução. Gates permanecem fechados.
