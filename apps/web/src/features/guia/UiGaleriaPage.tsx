import {
  Badge,
  type BadgeTone,
  Button,
  type ButtonVariant,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Tooltip,
  useValidacaoCampo,
} from "@sinergica/ui";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

const VARIANTES: ButtonVariant[] = ["primary", "accent", "secondary", "ghost", "danger"];
const TONES: BadgeTone[] = ["neutral", "success", "warning", "danger", "info", "accent"];

const schemaNome = z.string().min(2, "Informe pelo menos 2 caracteres");

interface LinhaExemplo {
  id: string;
  nome: string;
  valor: number;
}

const ITENS_EXEMPLO: LinhaExemplo[] = [
  { id: "1", nome: "Cliente Exemplo A", valor: 1200 },
  { id: "2", nome: "Cliente Exemplo B", valor: 850 },
];

// E00-S15 AC-10 — galeria de todas as primitivas × variantes, nos dois temas (o tema é global,
// troque no seletor do menu). Gate visual humano antes de qualquer PR de UI. Só dev/superadmin.
export function UiGaleriaPage() {
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [nome, setNome] = useState("");
  const validacao = useValidacaoCampo(schemaNome);

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-title font-semibold text-ink">Galeria de UI — @sinergica/ui</h1>
        <p className="text-body-sm text-ink-3">
          E00-S15. Toda primitiva × variante, pra revisão visual antes de qualquer PR de UI.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Button</h2>
        <div className="flex flex-wrap gap-2">
          {VARIANTES.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
          <Button variant="primary" size="sm">
            small
          </Button>
          <Button variant="primary" loading>
            loading
          </Button>
          <Button variant="primary" disabled>
            disabled
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Badge</h2>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <Badge key={t} tone={t}>
              {t}
            </Badge>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Card / EmptyState</h2>
        <Card className="p-4 text-sm text-ink">Card simples</Card>
        <EmptyState titulo="Nenhum item ainda" acao={<Button variant="secondary">Criar</Button>}>
          Descrição opcional do estado vazio.
        </EmptyState>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Field + validação (E00-S15 AC-8)</h2>
        <div className="max-w-xs">
          <Field label="Nome" required error={validacao.erro}>
            {(campo) => (
              <Input
                {...campo}
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  validacao.aoDigitar(e.target.value);
                }}
                onBlur={(e) => validacao.aoSair(e.target.value)}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Tooltip</h2>
        <Tooltip content="Explicação no hover/foco">
          <Button variant="secondary">Passe o mouse</Button>
        </Tooltip>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Skeleton</h2>
        <div className="flex max-w-xs flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Modal</h2>
        <Button variant="accent" onClick={() => setModalAberto(true)}>
          Abrir modal
        </Button>
        <Modal
          open={modalAberto}
          onOpenChange={setModalAberto}
          titulo="Título do modal"
          descricao="Descrição opcional"
        >
          <p className="text-sm text-ink-2">Conteúdo de exemplo.</p>
        </Modal>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">DataTable</h2>
        <Button variant="ghost" size="sm" onClick={() => setCarregando((c) => !c)}>
          alternar carregando
        </Button>
        <DataTable
          colunas={[
            { chave: "nome", cabecalho: "Nome", render: (l: LinhaExemplo) => l.nome },
            {
              chave: "valor",
              cabecalho: "Valor",
              render: (l: LinhaExemplo) => l.valor,
              numerica: true,
            },
          ]}
          itens={ITENS_EXEMPLO}
          chaveLinha={(l) => l.id}
          vazio={
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Sem itens
            </span>
          }
          carregando={carregando}
        />
      </section>
    </div>
  );
}
