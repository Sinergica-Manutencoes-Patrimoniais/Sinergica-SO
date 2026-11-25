// E02-S25 task 3 — tela de configuração do trigger de resposta automática do Zé.
//
// É a regra GLOBAL do AC-5: a configuração vive na persona de chamados, não por cliente. A tela
// mostra, por dia da semana, o horário em que HUMANOS atendem — fora dele o Zé assume sozinho —
// e os X minutos de silêncio humano dentro do horário até ele assumir.
import { Button, RecursoNaoAtivado, Skeleton } from "@sinergica/ui";
import { useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { flagLigada } from "../../../config/flags-sso";
import {
  useSalvarTriggerAutomatico,
  useTriggerAutomatico,
} from "../application/trigger-automatico-queries";
import type { PersonaItem } from "../domain/personas";
import {
  DIAS_DA_SEMANA,
  type JanelaDiaForm,
  faltaParaAtivarTrigger,
} from "../domain/trigger-automatico";
import { supabaseTriggerAutomaticoAdapter } from "../infrastructure/supabase-trigger-automatico-adapter";

export function TriggerAutomaticoForm({
  personas,
  temEscrita,
}: {
  personas: PersonaItem[];
  temEscrita: boolean;
}) {
  // Recurso desligado se ANUNCIA — some em silêncio é indistinguível de "não foi feito".
  if (!flagLigada("VITE_SSO_ZE_TRIGGER_AUTOMATICO_ENABLED")) {
    return (
      <RecursoNaoAtivado
        recurso="Resposta automática do Zé (trigger por horário e inatividade)"
        podeAdministrar={false}
        faltando={["VITE_SSO_ZE_TRIGGER_AUTOMATICO_ENABLED"]}
      />
    );
  }
  const persona = personas.find((p) => p.tipo === "chamados" && p.ativo) ?? personas[0];
  if (!persona) {
    return (
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <p className="text-body text-ink-2">
          Cadastre uma persona de Chamados na aba Personas antes de configurar a resposta automática
          — é nela que a regra global fica.
        </p>
      </section>
    );
  }
  return <Conteudo key={persona.id} persona={persona} temEscrita={temEscrita} />;
}

function Conteudo({ persona, temEscrita }: { persona: PersonaItem; temEscrita: boolean }) {
  const { user } = useAuth();
  const config = useTriggerAutomatico(supabaseTriggerAutomaticoAdapter, persona.id);
  const salvar = useSalvarTriggerAutomatico(supabaseTriggerAutomaticoAdapter, persona.id);
  const [rascunho, setRascunho] = useState<{
    ativo: boolean;
    minMinutosSemResposta: number;
    janelas: JanelaDiaForm[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  if (config.isPending) return <Skeleton className="h-40 w-full" />;
  if (config.isError) {
    return (
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <p className="text-body text-red-600">
          Não foi possível carregar a configuração da resposta automática.
        </p>
        <Button className="mt-2" onClick={() => config.refetch()}>
          Tentar novamente
        </Button>
      </section>
    );
  }

  const atual = rascunho ?? {
    ativo: config.data?.ativo ?? false,
    minMinutosSemResposta: config.data?.minMinutosSemResposta ?? 30,
    janelas: DIAS_DA_SEMANA.map((dia) => {
      const existente = config.data?.janelas.find((j) => j.dia === dia.valor);
      return { dia: dia.valor, inicio: existente?.inicio ?? "", fim: existente?.fim ?? "" };
    }),
  };

  function alterar(novo: Partial<typeof atual>) {
    setRascunho({ ...atual, ...novo });
    setSalvo(false);
  }

  function alterarJanela(dia: number, campo: "inicio" | "fim", valor: string) {
    alterar({
      janelas: atual.janelas.map((j) => (j.dia === dia ? { ...j, [campo]: valor } : j)),
    });
  }

  async function submeter() {
    if (!user) return;
    setErro(null);
    try {
      await salvar.mutateAsync({ ...atual, userId: user.id });
      setRascunho(null);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  const avisos = faltaParaAtivarTrigger(atual);

  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
      <h3 className="text-body font-semibold text-ink">Resposta automática do Zé</h3>
      <p className="mt-0.5 text-caption text-ink-3">
        Regra global, igual para todos os clientes. O horário abaixo é o do atendimento{" "}
        <strong>humano</strong>: fora dele o Zé responde sozinho, sem precisar ser mencionado.
        Dentro dele, ele só assume depois de {atual.minMinutosSemResposta} minutos sem resposta de
        uma pessoa. Quem pede para falar com alguém tira o Zé da conversa na hora.
      </p>

      <label className="mt-3 flex items-center gap-2 text-body text-ink">
        <input
          type="checkbox"
          checked={atual.ativo}
          disabled={!temEscrita}
          onChange={(e) => alterar({ ativo: e.target.checked })}
        />
        Ligar a resposta automática
      </label>

      <div className="mt-3 flex flex-col gap-2">
        {atual.janelas.map((janela) => (
          <div key={janela.dia} className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-body text-ink-2">
              {DIAS_DA_SEMANA.find((d) => d.valor === janela.dia)?.rotulo}
            </span>
            <input
              type="time"
              className="input w-32"
              value={janela.inicio}
              disabled={!temEscrita}
              aria-label={`Início do atendimento humano em ${janela.dia}`}
              onChange={(e) => alterarJanela(janela.dia, "inicio", e.target.value)}
            />
            <span className="text-caption text-ink-3">até</span>
            <input
              type="time"
              className="input w-32"
              value={janela.fim}
              disabled={!temEscrita}
              aria-label={`Fim do atendimento humano em ${janela.dia}`}
              onChange={(e) => alterarJanela(janela.dia, "fim", e.target.value)}
            />
            {!janela.inicio && !janela.fim && (
              <span className="text-caption text-ink-3">
                sem atendimento humano — o Zé cobre o dia inteiro
              </span>
            )}
          </div>
        ))}
      </div>

      <label className="mt-3 flex flex-wrap items-center gap-2 text-body text-ink">
        Minutos sem resposta humana até o Zé assumir
        <input
          type="number"
          min={1}
          max={1440}
          className="input w-24"
          value={atual.minMinutosSemResposta}
          disabled={!temEscrita}
          onChange={(e) => alterar({ minMinutosSemResposta: Number(e.target.value) })}
        />
      </label>

      {avisos.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-caption text-ink-3">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}
      {erro && <p className="mt-2 text-body text-red-600">{erro}</p>}
      {salvo && (
        <output className="mt-2 block text-body text-ink-2">
          Salvo. Vale a partir da próxima mensagem recebida.
        </output>
      )}

      {temEscrita && (
        <div className="mt-3 flex justify-end">
          <Button variant="primary" loading={salvar.isPending} onClick={submeter}>
            {salvar.isPending ? "Salvando…" : "Salvar resposta automática"}
          </Button>
        </div>
      )}
    </section>
  );
}
