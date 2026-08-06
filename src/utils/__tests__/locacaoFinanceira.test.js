import { beforeEach, describe, expect, it } from "vitest";
import {
  auditarLinhaLocacao,
  auditarPeriodosFinanceirosObra,
  calcularPeriodosFinanceirosLocacao,
  calcularValorProporcionalLocacao,
} from "../locacaoFinanceira";
import {
  fixtureJoseRochaJulho,
  fixtureJoseRochaCardsDuplicados,
  fixtureKitContrapeso,
  fixtureKitContrapesoJulhoAgosto,
  fixtureLegadoLifo,
  fixtureMes31Dias,
  fixtureRemocaoPendente,
} from "./fixtures/locacaoFixtures";

const armazenamento = new Map();
globalThis.localStorage = {
  getItem: (chave) => armazenamento.get(chave) ?? null,
  setItem: (chave, valor) => armazenamento.set(chave, String(valor)),
  removeItem: (chave) => armazenamento.delete(chave),
  clear: () => armazenamento.clear(),
};

const formatarEquipamento = (atividade) => {
  if (atividade.tipoMovimentoLocacao === "contrapeso" || atividade.usaContrapeso) return "Kit Contrapeso";
  if (atividade.equipamento === "Mini Grua") return `Mini Grua ${atividade.tipoMiniGrua || "500kg"}`;
  return atividade.tipoBalancinho === "Manual" ? "Balancinho Manual" : "Balancinho Elétrico";
};

const calcular = (fixture, mes = "2026-07") => {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const fim = new Date(ano, numeroMes, 0).getDate();
  return calcularPeriodosFinanceirosLocacao({
    atividadesBase: fixture.atividades,
    inicioMes: `${mes}-01`,
    fimMes: `${mes}-${String(fim).padStart(2, "0")}`,
    diasNoMes: fim,
    obras: fixture.obras,
    formatarEquipamento,
    obterValorMensalLocacao: (atividade) => ({
      valor:
        atividade.tipoMovimentoLocacao === "contrapeso"
          ? Number(atividade.valorKitTeste || 300) * Number(atividade.quantidade || 1)
          : Number(atividade.valorTeste || 1200) * Number(atividade.quantidade || 1),
      origem: atividade.valoresCongelados ? "Congelado" : "Fixture",
    }),
  });
};

beforeEach(() => armazenamento.clear());

describe("núcleo financeiro de locações", () => {
  it("cobra mês completo de 30 dias em 100%", () => expect(calcularValorProporcionalLocacao({ valorMensal: 1200, diasLocados: 30, mesCompleto: true })).toBe(1200));
  it("cobra mês completo de 31 dias em 100%", () => expect(calcularValorProporcionalLocacao({ valorMensal: 1200, diasLocados: 31, mesCompleto: true })).toBe(1200));
  it("usa divisor 30 em fevereiro", () => expect(calcularValorProporcionalLocacao({ valorMensal: 1200, diasLocados: 14, mesCompleto: false })).toBe(560));
  it("calcula entrada no meio do mês", () => expect(calcularValorProporcionalLocacao({ valorMensal: 1200, diasLocados: 16, mesCompleto: false })).toBe(640));
  it("calcula saída no meio do mês", () => expect(calcular(fixtureJoseRochaJulho).periodos.find((p) => p.dataSaida)?.valorProporcional).toBe(600));
  it("mantém entrada e saída no mesmo mês", () => expect(calcular(fixtureLegadoLifo).periodos.some((p) => p.dataEntrada.startsWith("2026-07") && p.dataSaida)).toBe(true));
  it("mantém unidade ativa desde mês anterior", () => expect(calcular(fixtureJoseRochaJulho).periodos.filter((p) => p.saldoFinal).reduce((s, p) => s + p.quantidade, 0)).toBe(5));
  it("deslocamento não reinicia período", () => {
    const fixture = structuredClone(fixtureRemocaoPendente); fixture.atividades.splice(1, 0, { ...fixture.atividades[0], id: "deslocamento", servico: "Deslocamento", iniciaLocacao: false, encerraLocacao: false, dataLiberacao: "2026-07-05" });
    expect(calcular(fixture).periodos.filter((p) => !p.legado).length).toBeLessThanOrEqual(2);
  });
  it("encerra remoção individualizada", () => expect(calcular(fixtureJoseRochaJulho).periodos.filter((p) => p.saidaNoMes).reduce((s, p) => s + p.quantidade, 0)).toBe(1));
  it("encerra remoção pendente", () => expect(calcular(fixtureRemocaoPendente).periodos.filter((p) => p.saidaNoMes).reduce((s, p) => s + p.quantidade, 0)).toBe(1));
  it("vínculo posterior não duplica período", () => expect(new Set(calcular(fixtureRemocaoPendente).periodos.map((p) => p.idPeriodo)).size).toBe(calcular(fixtureRemocaoPendente).periodos.length));
  it("duas remoções geram duas saídas", () => {
    const fixture = structuredClone(fixtureJoseRochaJulho); fixture.atividades.push({ ...fixture.atividades[1], id: "saida-2", dataLiberacao: "2026-07-20" });
    expect(calcular(fixture).periodos.filter((p) => p.saidaNoMes).reduce((s, p) => s + p.quantidade, 0)).toBe(2);
  });
  it("preserva LIFO legado", () => expect(calcular(fixtureLegadoLifo).periodos.find((p) => p.dataSaida)?.atividadeInicioId).toBe("legado-novo"));
  it("aceita legado sem patrimônio", () => expect(calcular(fixtureJoseRochaJulho).periodos.every((p) => p.patrimonio === null)).toBe(true));
  it("individualiza três itens", () => {
    const fixture = structuredClone(fixtureMes31Dias); fixture.atividades[0].quantidade = 3; fixture.atividades[0].itensEquipamentos = [1, 2, 3].map((n) => ({ idItem: `i${n}`, numeroPatrimonio: `00${n}` }));
    expect(calcular(fixture).periodosIndividuais.length).toBe(3);
  });
  it("abre Kit Contrapeso na instalação", () => expect(calcular(fixtureKitContrapeso).periodos.some((p) => p.categoria === "Kit Contrapeso")).toBe(true));
  it("adição de kit não duplica base", () => expect(calcular(fixtureKitContrapeso).periodos.filter((p) => p.categoria !== "Kit Contrapeso").length).toBe(1));
  it("retirada de kit preserva período base", () => expect(calcular(fixtureKitContrapeso).periodos.filter((p) => p.categoria !== "Kit Contrapeso").reduce((s, p) => s + p.valorProporcional, 0)).toBe(1200));
  it("remoção da base mantém kit separado", () => expect(calcular(fixtureKitContrapeso).periodos.map((p) => p.categoria)).toContain("Kit Contrapeso"));
  it("conferência cadastral usa período próprio do kit", () => expect(calcular(fixtureKitContrapeso).periodos.find((p) => p.categoria === "Kit Contrapeso")?.valorMensalUnitario).toBe(300));
  it("conferência futura não altera mês anterior", () => expect(calcular(fixtureKitContrapeso).periodos.reduce((s, p) => s + p.valorProporcional, 0)).toBe(1500));
  it("remoção do Balancinho com alteração nenhuma mantém o Kit ativo", () => {
    const fixture = structuredClone(fixtureKitContrapeso);
    fixture.atividades[0].itensEquipamentos = [
      { idItem: "item-kit", numeroPatrimonio: "0101", usaContrapeso: true },
    ];
    fixture.atividades.push({
      ...fixture.atividades[0],
      id: "remocao-sem-kit",
      servico: "Remoção",
      iniciaLocacao: false,
      encerraLocacao: true,
      dataLiberacao: "2026-07-15",
      usaContrapeso: false,
      alteracaoContrapeso: "nenhuma",
      itensEquipamentos: [
        { idItemOrigem: "item-kit", equipamento: "Balancinho", numeroPatrimonio: "0101", usaContrapeso: false, alteracaoContrapeso: "nenhuma" },
      ],
    });

    const kit = calcular(fixture).periodos.find((periodo) => periodo.categoria === "Kit Contrapeso");
    expect(kit?.dataSaida).toBe("");
    expect(kit?.saldoFinal).toBe(1);
  });
  it("remoção do Balancinho encerra o Kit somente com alteração remover", () => {
    const fixture = structuredClone(fixtureKitContrapeso);
    fixture.atividades[0].itensEquipamentos = [
      { idItem: "item-kit", numeroPatrimonio: "0101", usaContrapeso: true },
    ];
    fixture.atividades.push({
      ...fixture.atividades[0],
      id: "remocao-com-kit",
      servico: "Somente recolhimento",
      iniciaLocacao: false,
      encerraLocacao: true,
      dataLiberacao: "2026-07-15",
      usaContrapeso: false,
      alteracaoContrapeso: "remover",
      itensEquipamentos: [
        { idItemOrigem: "item-kit", equipamento: "Balancinho", numeroPatrimonio: "0101", usaContrapeso: false, alteracaoContrapeso: "remover" },
      ],
    });

    const kit = calcular(fixture).periodos.find((periodo) => periodo.categoria === "Kit Contrapeso");
    expect(kit?.dataSaida).toBe("2026-07-15");
    expect(kit?.saldoFinal).toBe(0);
  });
  it("permite recolher explicitamente o Kit após a remoção anterior do Balancinho", () => {
    const fixture = structuredClone(fixtureKitContrapeso);
    fixture.atividades[0].itensEquipamentos = [
      { idItem: "item-kit", numeroPatrimonio: "0101", usaContrapeso: true },
    ];
    const movimento = (id, dataLiberacao, alteracaoContrapeso) => ({
      ...fixture.atividades[0],
      id,
      servico: "Somente recolhimento",
      iniciaLocacao: false,
      encerraLocacao: true,
      dataLiberacao,
      usaContrapeso: false,
      alteracaoContrapeso,
      itensEquipamentos: [
        { idItemOrigem: "item-kit", equipamento: "Balancinho", numeroPatrimonio: "0101", usaContrapeso: false, alteracaoContrapeso },
      ],
    });
    fixture.atividades.push(
      movimento("remocao-base", "2026-07-10", "nenhuma"),
      movimento("recolhimento-kit", "2026-07-20", "remover")
    );

    const kit = calcular(fixture).periodos.find((periodo) => periodo.categoria === "Kit Contrapeso");
    expect(kit?.dataSaida).toBe("2026-07-20");
    expect(kit?.saldoFinal).toBe(0);
  });
  it("preserva valor congelado unitário", () => {
    const fixture = structuredClone(fixtureMes31Dias); fixture.atividades[0].valoresCongelados = { locacaoMensalUnitario: 987 };
    const resultado = calcularPeriodosFinanceirosLocacao({ ...criarParametros(fixture), obterValorMensalLocacao: (a) => ({ valor: Number(a.valoresCongelados?.locacaoMensalUnitario || 0), origem: "Congelado" }) });
    expect(resultado.periodos[0].valorMensalUnitario).toBe(987);
  });
  it("divide congelado agregado pela quantidade original", () => {
    const fixture = structuredClone(fixtureJoseRochaJulho);
    fixture.atividades[0].valoresCongelados = { totalLocacaoMensal: 7200 };
    const resultado = calcularPeriodosFinanceirosLocacao({
      ...criarParametros(fixture),
      obterValorMensalLocacao: (atividade) => ({
        valor: Number(atividade.valoresCongelados?.totalLocacaoMensal || 0),
        origem: "Congelado",
      }),
    });
    expect(resultado.periodos[0].valorMensalUnitario).toBe(1200);
  });
  it("preserva preços diferentes entre unidades", () => expect(calcular(fixtureLegadoLifo).periodos.some((p) => p.valorMensalUnitario === 1500)).toBe(true));
  it("troca de patrimônio não cria período adicional", () => expect(new Set(calcular(fixtureJoseRochaJulho).periodos.map((p) => p.idPeriodo)).size).toBe(calcular(fixtureJoseRochaJulho).periodos.length));
  it("reproduz José Rocha em julho", () => {
    const periodos = calcular(fixtureJoseRochaJulho).periodos;
    expect(periodos.filter((p) => p.saldoAnterior).reduce((s, p) => s + p.quantidade, 0)).toBe(6);
    expect(periodos.filter((p) => p.saidaNoMes).reduce((s, p) => s + p.quantidade, 0)).toBe(1);
    expect(periodos.reduce((s, p) => s + p.saldoFinal, 0)).toBe(5);
    expect(periodos.find((p) => p.dataSaida)?.valorMensalUnitario).toBeGreaterThan(0);
  });
  it("preserva José Rocha em agosto", () => expect(calcular(fixtureJoseRochaJulho, "2026-08").periodos.reduce((s, p) => s + p.saldoFinal, 0)).toBe(5));
  it("jose-rocha-julho mantém linha e detalhe coerentes", () => {
    const periodos = calcular(fixtureJoseRochaCardsDuplicados, "2026-07").periodos.filter(
      (periodo) => periodo.categoria === "Balancinho Elétrico"
    );
    expect(periodos.reduce((total, periodo) => total + periodo.saldoAnterior, 0)).toBe(6);
    expect(periodos.reduce((total, periodo) => total + periodo.entradaNoMes, 0)).toBe(0);
    expect(periodos.reduce((total, periodo) => total + periodo.saidaNoMes, 0)).toBe(1);
    expect(periodos.reduce((total, periodo) => total + periodo.saldoFinal, 0)).toBe(5);
    expect(periodos.reduce((total, periodo) => total + periodo.valorProporcional, 0)).toBe(6600);
  });
  it("jose-rocha-agosto-cards-duplicados resulta em três ativas e duas saídas", () => {
    const periodos = calcular(fixtureJoseRochaCardsDuplicados, "2026-08").periodos.filter(
      (periodo) => periodo.categoria === "Balancinho Elétrico"
    );
    const ativos = periodos.filter((periodo) => periodo.saldoFinal > 0);
    expect(periodos.reduce((total, periodo) => total + periodo.saldoAnterior, 0)).toBe(5);
    expect(periodos.reduce((total, periodo) => total + periodo.entradaNoMes, 0)).toBe(0);
    expect(periodos.reduce((total, periodo) => total + periodo.saidaNoMes, 0)).toBe(2);
    expect(ativos).toHaveLength(3);
    expect(new Set(ativos.map((periodo) => periodo.identidadeUnidade)).size).toBe(3);
    expect(periodos.reduce((total, periodo) => total + periodo.valorProporcional, 0)).toBe(3880);
  });
  it("kit-contrapeso-julho-agosto encerra em julho e permanece zerado em agosto", () => {
    const julho = calcular(fixtureKitContrapesoJulhoAgosto, "2026-07").periodos.filter(
      (periodo) => periodo.categoria === "Kit Contrapeso"
    );
    const agosto = calcular(fixtureKitContrapesoJulhoAgosto, "2026-08").periodos.filter(
      (periodo) => periodo.categoria === "Kit Contrapeso"
    );
    expect(julho.reduce((total, periodo) => total + periodo.saldoAnterior, 0)).toBe(1);
    expect(julho.reduce((total, periodo) => total + periodo.saidaNoMes, 0)).toBe(1);
    expect(julho.reduce((total, periodo) => total + periodo.saldoFinal, 0)).toBe(0);
    expect(agosto.reduce((total, periodo) => total + periodo.saldoAnterior, 0)).toBe(0);
    expect(agosto.reduce((total, periodo) => total + periodo.entradaNoMes, 0)).toBe(0);
    expect(agosto.reduce((total, periodo) => total + periodo.saidaNoMes, 0)).toBe(0);
    expect(agosto.reduce((total, periodo) => total + periodo.saldoFinal, 0)).toBe(0);
  });
  it("individual-e-legado-nao-duplicam no caso de vínculo posterior", () => {
    const resultado = calcular(fixtureJoseRochaCardsDuplicados, "2026-08");
    expect(new Set(resultado.periodos.map((periodo) => periodo.idPeriodo)).size).toBe(resultado.periodos.length);
    expect(resultado.periodosIndividuais.some((periodo) => periodo.atividadeOrigemId === "entrada-1")).toBe(true);
    expect(resultado.periodosLegados.some((periodo) => periodo.atividadeOrigemId === "entrada-1")).toBe(false);
  });
  it("audita saldo, valor e duplicidade", () => {
    const periodos = calcular(fixtureJoseRochaJulho).periodos;
    const valor = periodos.reduce((s, p) => s + p.valorProporcional, 0);
    expect(auditarLinhaLocacao({ saldoAnterior: 6, entradasMes: 0, saidasMes: 1, saldoFinal: 5, valorProporcionalMes: valor, periodosFinanceiros: periodos }).valido).toBe(true);
  });
  it("expõe diagnóstico nominal sem alterar períodos", () => {
    const resultado = calcular(fixtureJoseRochaJulho);
    const diagnostico = auditarPeriodosFinanceirosObra({
      periodos: resultado.periodos,
      atividadesBase: fixtureJoseRochaJulho.atividades,
      atividadesIndividualizadas: resultado.atividadesIndividualizadas,
      construtora: "JOSE ROCHA",
      obra: "Rio Branco",
      mes: 7,
      ano: 2026,
      imprimir: false,
    });
    expect(diagnostico.periodos).toHaveLength(resultado.periodos.length);
    expect(diagnostico.processadasNosDoisCaminhos).toHaveLength(0);
  });
});

function criarParametros(fixture) {
  return {
    atividadesBase: fixture.atividades,
    inicioMes: "2026-07-01",
    fimMes: "2026-07-31",
    diasNoMes: 31,
    obras: fixture.obras,
    formatarEquipamento,
  };
}
