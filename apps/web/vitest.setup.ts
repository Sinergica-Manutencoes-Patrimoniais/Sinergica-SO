// Registra os matchers do jest-dom (toBeInTheDocument, toHaveAttribute, …) globalmente.
// Não toca `document` no import — seguro mesmo nos testes de domínio que rodam em ambiente "node"
// (sem DOM). Componente que precisa de DOM real declara `// @vitest-environment jsdom` no topo.
import "@testing-library/jest-dom/vitest";
