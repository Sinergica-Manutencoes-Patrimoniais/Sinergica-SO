// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MovimentarComponente } from "./MovimentarComponente";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
it("repete movimentação incerta com mesmo pedido e revisão", async () => {
  const enviar = vi.fn().mockRejectedValueOnce(new Error("conexão"));
  render(
    <MovimentarComponente
      userId="u"
      clienteId="c"
      item={{
        id: "17610000-0000-4000-8000-000000000061",
        estruturaRevisao: 3,
        areaId: null,
        localId: null,
        parentItemId: null,
      }}
      areas={[{ id: "17610000-0000-4000-8000-000000000021", nome: "Torre" }]}
      locais={[
        {
          id: "17610000-0000-4000-8000-000000000031",
          areaId: "17610000-0000-4000-8000-000000000021",
          nome: "Salão",
        },
      ]}
      pais={[]}
      enviar={enviar}
      onConcluido={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Área de destino"), {
    target: { value: "17610000-0000-4000-8000-000000000021" },
  });
  fireEvent.change(screen.getByLabelText("Local de destino"), {
    target: { value: "17610000-0000-4000-8000-000000000031" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar movimentação novamente" }));
  await waitFor(() => expect(enviar).toHaveBeenCalledTimes(2));
  expect(enviar.mock.calls[0]?.[0]).toEqual(enviar.mock.calls[1]?.[0]);
  expect(enviar.mock.calls[0]?.[0].expectedRevision).toBe(3);
});
it("exibe vínculos atuais indisponíveis sem substituí-los silenciosamente", () => {
  render(
    <MovimentarComponente
      userId="u"
      clienteId="c"
      item={{
        id: "i",
        estruturaRevisao: 1,
        areaId: "area-antiga",
        localId: "local-antigo",
        parentItemId: "pai-antigo",
      }}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={vi.fn()}
      onConcluido={() => {}}
    />,
  );
  expect((screen.getByLabelText("Área de destino") as HTMLSelectElement).value).toBe("area-antiga");
  expect((screen.getByLabelText("Local de destino") as HTMLSelectElement).value).toBe(
    "local-antigo",
  );
  expect((screen.getByLabelText("Componente pai") as HTMLSelectElement).value).toBe("pai-antigo");
});
it("não envia posição antiga com revisão nova quando o detalhe muda durante edição", () => {
  const enviar = vi.fn();
  const item = {
    id: "17610000-0000-4000-8000-000000000061",
    estruturaRevisao: 3,
    areaId: null,
    localId: null,
    parentItemId: null,
  };
  const montar = (dados: typeof item) => (
    <MovimentarComponente
      userId="u"
      clienteId="c"
      item={dados}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={() => {}}
    />
  );
  const tela = render(montar(item));
  tela.rerender(montar({ ...item, estruturaRevisao: 4 }));
  expect(
    (screen.getByRole("button", { name: "Confirmar movimentação" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByRole("alert").textContent).toMatch(/reabra/i);
  fireEvent.submit(screen.getByRole("button", { name: "Confirmar movimentação" }).closest("form")!);
  expect(enviar).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(`sso-movimento:u:c:${item.id}`)).toBeNull();
});
it("mantém retry do pedido incerto mesmo se o detalhe for atualizado", async () => {
  const enviar = vi.fn().mockRejectedValue(new Error("conexão"));
  const item = {
    id: "17610000-0000-4000-8000-000000000061",
    estruturaRevisao: 3,
    areaId: null,
    localId: null,
    parentItemId: null,
  };
  const montar = (dados: typeof item) => (
    <MovimentarComponente
      userId="u"
      clienteId="c"
      item={dados}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={() => {}}
    />
  );
  const tela = render(montar(item));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  await screen.findByRole("alert");
  tela.rerender(montar({ ...item, estruturaRevisao: 4 }));
  fireEvent.click(screen.getByRole("button", { name: "Tentar movimentação novamente" }));
  await waitFor(() => expect(enviar).toHaveBeenCalledTimes(2));
  expect(enviar.mock.calls[1]?.[0]).toEqual(enviar.mock.calls[0]?.[0]);
});
it("permite corrigir vínculo rejeitado pelo servidor", async () => {
  const enviar = vi.fn().mockRejectedValue({ code: "23514", message: "ciclo_na_hierarquia" });
  render(
    <MovimentarComponente
      userId="u"
      clienteId="c"
      item={{
        id: "17610000-0000-4000-8000-000000000061",
        estruturaRevisao: 3,
        areaId: null,
        localId: null,
        parentItemId: null,
      }}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/corrija/i);
  expect(screen.getByLabelText("Componente pai")).toBeTruthy();
});
it("não sobrescreve pedido pendente criado após abertura do formulário", async () => {
  const enviar = vi.fn();
  render(
    <MovimentarComponente
      userId="u"
      clienteId="c"
      item={{
        id: "17610000-0000-4000-8000-000000000061",
        estruturaRevisao: 3,
        areaId: null,
        localId: null,
        parentItemId: null,
      }}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={() => {}}
    />,
  );
  const chave = "sso-movimento:u:c:17610000-0000-4000-8000-000000000061";
  sessionStorage.setItem(chave, "outro pedido");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBe("outro pedido");
  expect(enviar).not.toHaveBeenCalled();
});
it("não apaga pedido diferente quando resposta antiga chega", async () => {
  let concluir!: (value: object) => void;
  const enviar = vi.fn(
    () =>
      new Promise<object>((resolve) => {
        concluir = resolve;
      }),
  );
  const onConcluido = vi.fn();
  render(
    <MovimentarComponente
      userId="u"
      clienteId="c"
      item={{
        id: "17610000-0000-4000-8000-000000000061",
        estruturaRevisao: 3,
        areaId: null,
        localId: null,
        parentItemId: null,
      }}
      areas={[]}
      locais={[]}
      pais={[]}
      enviar={enviar}
      onConcluido={onConcluido}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar movimentação" }));
  const chave = "sso-movimento:u:c:17610000-0000-4000-8000-000000000061";
  sessionStorage.setItem(chave, "outro pedido");
  concluir({});
  await screen.findByRole("alert");
  expect(sessionStorage.getItem(chave)).toBe("outro pedido");
  expect(onConcluido).not.toHaveBeenCalled();
});
