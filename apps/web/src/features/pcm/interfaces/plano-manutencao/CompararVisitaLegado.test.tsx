// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CompararVisitaLegado } from "./CompararVisitaLegado";
afterEach(cleanup);
it("sinaliza possível conflito para datas iguais sem presumir equivalência",()=>{render(<CompararVisitaLegado foto={{dataSso:"2026-11-06",dataLegado:"2026-11-06",indiceLegado:3}} efeitos={{legadaExistente:true}}/>);expect(screen.getByText(/Datas coincidentes: possível conflito/)).toBeTruthy();expect(screen.getByText(/Já existe ocorrência/)).toBeTruthy();expect(screen.getByText(/não comprova equivalência/)).toBeTruthy();});
it("apresenta diferenças e desconhecimento sem afirmar ausência",()=>{render(<CompararVisitaLegado foto={{dataSso:"2026-11-06",dataLegado:"2026-11-13",indiceLegado:3}} efeitos={{}}/>);expect(screen.getByText(/Datas diferentes/)).toBeTruthy();expect(screen.getByText(/Situação da ocorrência legada não determinada/)).toBeTruthy();});
