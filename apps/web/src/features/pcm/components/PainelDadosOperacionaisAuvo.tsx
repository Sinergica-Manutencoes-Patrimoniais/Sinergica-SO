import { Battery, ClipboardCheck, DollarSign, MapPin, Smile } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase-client";

type Estado =
  | { fase: "carregando" }
  | { fase: "indisponivel" }
  | { fase: "erro" }
  | {
      fase: "pronto";
      gps: number;
      despesas: number;
      custoCentavos: number;
      satisfacoes: number;
      questionarios: number;
      ultimaPosicao: string | null;
    };

const JANELA_DESPESAS_DIAS = 31; // mesma janela do pull em pcm-auvo-support-pull

function tabelaIndisponivel(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205" || code === "PGRST204";
}

function dinheiro(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}

/** Painel tolerante a rollout: só mostra dados depois que as migrations/pulls de E01-S52/S54–S56
 * existirem; ausência de tabela não derruba o dashboard e não é apresentada como zero. */
export function PainelDadosOperacionaisAuvo() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  useEffect(() => {
    void (async () => {
      const pcm = supabase.schema("pcm");
      const corteDespesas = new Date(Date.now() - JANELA_DESPESAS_DIAS * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const [gps, despesas, satisfacoes, questionarios] = await Promise.all([
        pcm
          .from("gps_posicoes")
          .select("position_date", { count: "exact", head: false })
          .order("position_date", { ascending: false })
          .limit(1),
        pcm.from("despesas").select("valor_centavos").gte("data", corteDespesas),
        pcm.from("satisfacao_respostas").select("id", { count: "exact", head: true }),
        pcm.from("questionarios").select("id", { count: "exact", head: true }),
      ]);
      const erro = gps.error ?? despesas.error ?? satisfacoes.error ?? questionarios.error;
      if (erro) {
        setEstado(tabelaIndisponivel(erro) ? { fase: "indisponivel" } : { fase: "erro" });
        return;
      }
      const custoCentavos = (despesas.data ?? []).reduce(
        (total: number, despesa: { valor_centavos?: number | null }) =>
          total + (despesa.valor_centavos ?? 0),
        0,
      );
      setEstado({
        fase: "pronto",
        gps: gps.count ?? 0,
        despesas: despesas.data?.length ?? 0,
        custoCentavos,
        satisfacoes: satisfacoes.count ?? 0,
        questionarios: questionarios.count ?? 0,
        ultimaPosicao: gps.data?.[0]?.position_date ?? null,
      });
    })();
  }, []);
  if (estado.fase === "carregando")
    return (
      <section className="rounded-[10px] border border-line bg-card p-4 text-sm text-ink-3">
        Carregando dados operacionais Auvo…
      </section>
    );
  if (estado.fase === "indisponivel")
    return (
      <section className="rounded-[10px] border border-[#F0D4B0] bg-orange-soft p-4 text-sm text-[#7A3F00]">
        <strong>Dados operacionais aguardando sincronização.</strong> GPS, despesas, satisfação e
        questionários aparecerão aqui depois que as migrations e os pulls do Auvo estiverem ativos.
      </section>
    );
  if (estado.fase === "erro")
    return (
      <section className="rounded-[10px] border border-[#F0C2BD] bg-[#FFF4F2] p-4 text-sm text-[#A12D24]">
        <strong>Não foi possível carregar os dados operacionais.</strong> Erro ao consultar o banco
        (não é ausência de sincronização) — recarregue a página ou verifique sua permissão no módulo
        PCM.
      </section>
    );
  const cards = [
    {
      Icon: MapPin,
      label: "Equipe agora",
      valor: estado.ultimaPosicao
        ? new Date(estado.ultimaPosicao).toLocaleString("pt-BR")
        : "Sem posição",
      sub: `${estado.gps} posição(ões) registradas`,
    },
    {
      Icon: DollarSign,
      label: "Despesas (31 dias)",
      valor: dinheiro(estado.custoCentavos),
      sub: `${estado.despesas} lançamento(s)`,
    },
    {
      Icon: Smile,
      label: "Satisfação",
      valor: String(estado.satisfacoes),
      sub: "resposta(s) sincronizada(s)",
    },
    {
      Icon: ClipboardCheck,
      label: "Questionários",
      valor: String(estado.questionarios),
      sub: "checklist(s) disponíveis",
    },
  ];
  return (
    <section className="rounded-[10px] border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Battery className="h-4 w-4 text-orange" />
        <div>
          <h3 className="text-sm font-semibold text-ink">Operação de campo</h3>
          <p className="text-xs text-ink-3">Sinais recebidos do Auvo</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ Icon, label, valor, sub }) => (
          <div key={label} className="rounded-[8px] border border-line-soft p-3">
            <Icon className="h-4 w-4 text-ink-3" />
            <p className="mt-2 text-xs font-semibold text-ink-3">{label}</p>
            <p className="mt-1 text-lg font-bold text-ink">{valor}</p>
            <p className="mt-1 text-[11px] text-ink-3">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
