# Validar o manual

1. `pnpm --filter @sinergica/web exec vitest run src/features/guia/PcmGuia.test.tsx`.
2. `pnpm --filter @sinergica/web exec playwright test e2e/manual-pcm.spec.ts` com credenciais locais existentes. Somente leitura, sem confirmar OS nem gravar cadastro.
3. Abrir `/?guia=pcm#pcm-os`, buscar “etiqueta”, navegar por teclado/mobile.
4. Abrir ajuda em Novo Chamado/Nova OS, conferir assunto e formulário preservado.
5. `pnpm run ci:local` ao final. Sem migrations novas.

## Resultado local

Em 14/10/2026: 4 testes do manual aprovados; E2E com 3 jornadas e autenticação aprovadas; CI local completa verde. As jornadas abrem ajuda nos seis pontos previstos e verificam a preservação do formulário e a leitura por teclado/mobile. Capturas em `/tmp/sinergica-manual-desktop.png` e `/tmp/sinergica-manual-mobile.png`, inspecionadas visualmente. Não foram criados Chamados, OS ou ativos para validar o manual.
