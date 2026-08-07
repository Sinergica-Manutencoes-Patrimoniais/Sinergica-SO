// @sinergica/ui — primitivas compartilhadas entre apps/web e apps/portal (E00-S15).
// Nenhum componente aqui conhece domínio (OS, cliente, chamado…) — isso fica na feature.
export { Badge } from "./Badge";
export type { BadgeTone } from "./Badge";
export { Button } from "./Button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button";
export { Card, CardHeader, EmptyState } from "./Card";
export { DataTable } from "./DataTable";
export type { DataTableColumn, DataTableOrdenacao, DataTableProps } from "./DataTable";
export { Field } from "./Field";
export type { FieldControlProps, FieldProps } from "./Field";
export { Input, Select, Textarea } from "./Input";
export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";
export { Skeleton } from "./Skeleton";
export { Tooltip, TooltipProvider } from "./Tooltip";
export { focarPrimeiroInvalido, useValidacaoCampo } from "./use-validacao-campo";
