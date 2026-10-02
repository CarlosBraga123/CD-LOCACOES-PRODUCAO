import { beforeEach, describe, expect, it } from "vitest";
import {
  associarEquipamentoMestreAUnidade,
  avaliarReutilizacaoEquipamentoMestre,
  registrarSubstituicaoEquipamento,
} from "../equipamentosPatrimonio";
import {
  registrarReutilizacaoPatrimonio,
  registrarTrocaPatrimonio,
  verificarPatrimonioDuplicado,
} from "../patrimoniosEquipamentos";
import { enriquecerDetalhamentoPatrimonial } from "../detalhamentoPatrimonioLocacao";

const memoria = new Map();
globalThis.localStorage = {
  getItem: (chave) => (memoria.has(chave) ? memoria.get(chave) : null),
  setItem: (chave, valor) => memoria.set(chave, String(valor)),
  removeItem: (chave) => memoria.delete(chave),
  clear: () => memoria.clear(),
};

const mestre = (situacao = "NO_GALPAO", extras = {}) => ({
  idEquipamento: "mestre-0142",
  idItemOrigem: "unidade-antiga",
  numeroPatrimonioAtual: "0142",
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  situacaoAdministrativa: situacao,
  ativo: true,
  historicoAdministrativo: [],
  ...extras,
});

const eventoInicial = {
  id: "evento-julho",
  tipo: "cadastro_inicial",
  numeroAnterior: null,
  numeroNovo: "0142",
  data: "2026-07-01",
  obraId: "obra-a",
  motivo: "",
  observacao: "",
};

const registroAntigo = (atual = "") => ({
  idItem: "unidade-antiga",
  numeroPatrimonioAtual: atual,
  historico: [eventoInicial],
});

const avaliar = (alteracoes = {}) =>
  avaliarReutilizacaoEquipamentoMestre({
    numero: "0142",
    idItemAtual: "unidade-nova",
    equipamentos: [mestre()],
    registrosPatrimonio: [registroAntigo()],
    equipamentosAtivos: [],
    edicoes: [{ idItem: "unidade-nova", numero: "0142" }],
    ...alteracoes,
  });

describe("reutilização segura de patrimônio na Conferência", () => {
  beforeEach(() => memoria.clear());

  it("permite patrimônio mestre nunca usado e no galpão", () => {
    expect(avaliar({ registrosPatrimonio: [] }).permitido).toBe(true);
  });

  it("permite patrimônio presente apenas no histórico e no galpão", () => {
    expect(avaliar().permitido).toBe(true);
  });

  it("permite patrimônio reparado que voltou ao galpão", () => {
    const reparado = mestre("NO_GALPAO", {
      historicoAdministrativo: [
        { tipo: "manutencao", situacaoNova: "EM_MANUTENCAO" },
        { tipo: "reparo", situacaoNova: "NO_GALPAO" },
      ],
    });
    expect(avaliar({ equipamentos: [reparado] }).permitido).toBe(true);
  });

  it("bloqueia patrimônio utilizado por outra unidade ativa", () => {
    const resultado = avaliar({
      equipamentosAtivos: [{ idItem: "outra", numeroPatrimonio: "0142" }],
    });
    expect(resultado).toMatchObject({ permitido: false, motivo: "unidade_ativa" });
  });

  it("bloqueia outro vínculo atual incompatível", () => {
    const resultado = avaliar({
      registrosPatrimonio: [
        registroAntigo(),
        { idItem: "terceira", numeroPatrimonioAtual: "0142", historico: [] },
      ],
    });
    expect(resultado).toMatchObject({ permitido: false, motivo: "vinculo_atual" });
  });

  it("bloqueia edição simultânea com o mesmo patrimônio", () => {
    const resultado = avaliar({
      edicoes: [
        { idItem: "unidade-nova", numero: "0142" },
        { idItem: "outra", numero: "0142" },
      ],
    });
    expect(resultado).toMatchObject({ permitido: false, motivo: "edicao_simultanea" });
  });

  it("bloqueia equipamento em manutenção", () => {
    expect(avaliar({ equipamentos: [mestre("EM_MANUTENCAO")] }).motivo).toBe("em_manutencao");
  });

  it("bloqueia equipamento indisponível", () => {
    expect(avaliar({ equipamentos: [mestre("INDISPONIVEL")] }).motivo).toBe("indisponivel");
  });

  it("bloqueia equipamento baixado", () => {
    expect(avaliar({ equipamentos: [mestre("BAIXADO")] }).motivo).toBe("baixado");
  });

  it("bloqueia equipamento mestre inativo", () => {
    expect(avaliar({ equipamentos: [mestre("NO_GALPAO", { ativo: false })] }).motivo).toBe("inativo");
  });

  it("bloqueia mestre marcado como locado em outra unidade", () => {
    expect(avaliar({ equipamentos: [mestre("LOCADO")] }).motivo).toBe("locado");
  });

  it("reutiliza o mestre 0142 sem criar outro mestre", () => {
    const resultado = associarEquipamentoMestreAUnidade({
      equipamentos: [mestre()],
      idEquipamento: "mestre-0142",
      idItemDestino: "unidade-nova",
      data: "2026-09-01",
      obraId: "obra-b",
    });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      idEquipamento: "mestre-0142",
      idItemOrigem: "unidade-nova",
      numeroPatrimonioAtual: "0142",
      situacaoAdministrativa: "LOCADO",
    });
  });

  it("mantém o cadastro de mestre rígido contra número histórico", () => {
    const duplicidade = verificarPatrimonioDuplicado(
      "0142",
      "novo-mestre",
      [registroAntigo()],
      [],
      [],
      { bloquearHistorico: true }
    );
    expect(duplicidade?.tipo).toBe("historico");
  });

  it("preserva integralmente os eventos históricos anteriores", () => {
    const anterior = registroAntigo("0142");
    const eventosAnteriores = structuredClone(anterior.historico);
    const resultado = registrarReutilizacaoPatrimonio({
      registros: [anterior],
      item: { idItem: "unidade-nova" },
      numeroNovo: "0142",
      data: "2026-09-01",
      obraId: "obra-b",
      idsRegistrosOrigem: ["unidade-antiga"],
    });
    expect(resultado[0].historico.slice(0, eventosAnteriores.length)).toEqual(eventosAnteriores);
  });

  it("cria o novo vínculo atual na unidade de destino", () => {
    const resultado = registrarReutilizacaoPatrimonio({
      registros: [registroAntigo("0142")],
      item: { idItem: "unidade-nova" },
      numeroNovo: "0142",
      data: "2026-09-01",
      obraId: "obra-b",
      idsRegistrosOrigem: ["unidade-antiga"],
    });
    expect(resultado.find((item) => item.idItem === "unidade-nova")?.numeroPatrimonioAtual).toBe("0142");
    expect(resultado.find((item) => item.idItem === "unidade-antiga")?.numeroPatrimonioAtual).toBe("");
  });

  it("não mantém duas unidades com o mesmo vínculo atual", () => {
    const resultado = registrarReutilizacaoPatrimonio({
      registros: [registroAntigo("0142")],
      item: { idItem: "unidade-nova" },
      numeroNovo: "0142",
      data: "2026-09-01",
      obraId: "obra-b",
      idsRegistrosOrigem: ["unidade-antiga"],
    });
    expect(resultado.filter((item) => item.numeroPatrimonioAtual === "0142")).toHaveLength(1);
  });

  it("troca 0142 por 0159 preservando o histórico anterior", () => {
    const anterior = registroAntigo("0142");
    const resultado = registrarTrocaPatrimonio({
      registros: [anterior],
      item: { idItem: "unidade-antiga" },
      numeroNovo: "0159",
      data: "2026-08-01",
      obraId: "obra-a",
      motivo: "Reparo",
      observacao: "",
    });
    expect(resultado[0].historico[0]).toEqual(eventoInicial);
    expect(resultado[0].historico[1]).toMatchObject({ numeroAnterior: "0142", numeroNovo: "0159" });
  });

  it("permite reutilizar 0142 após troca e liberação", () => {
    const registroTrocado = registrarTrocaPatrimonio({
      registros: [registroAntigo("0142")],
      item: { idItem: "unidade-antiga" },
      numeroNovo: "0159",
      data: "2026-08-01",
      obraId: "obra-a",
      motivo: "Reparo",
      observacao: "",
    });
    expect(avaliar({ registrosPatrimonio: registroTrocado }).permitido).toBe(true);
  });

  it("mantém a substituição física existente funcionando", () => {
    const equipamentos = [
      mestre("LOCADO"),
      mestre("NO_GALPAO", { idEquipamento: "mestre-0159", idItemOrigem: "origem-0159", numeroPatrimonioAtual: "0159" }),
    ];
    localStorage.setItem("equipamentosPatrimonio", JSON.stringify(equipamentos));
    localStorage.setItem("substituicoesEquipamentos", "[]");
    const resultado = registrarSubstituicaoEquipamento({
      equipamentoOrigemId: "mestre-0142",
      equipamentoDestinoId: "mestre-0159",
      equipamentosAtivos: [{ idEquipamento: "mestre-0142", idUnidade: "unidade-antiga", obraId: "obra-a", numeroPatrimonio: "0142" }],
      data: "2026-08-10",
      motivo: "Substituição",
      observacao: "",
    });
    expect(resultado.substituicoes).toHaveLength(1);
  });

  it("continua permitindo patrimônio informado posteriormente", () => {
    expect(
      avaliar({ registrosPatrimonio: [], equipamentos: [] })
    ).toMatchObject({ permitido: true, motivo: "novo" });
  });

  it("mantém o patrimônio histórico de julho após a reutilização", () => {
    const registros = registrarReutilizacaoPatrimonio({
      registros: [registroAntigo("0142")],
      item: { idItem: "unidade-nova" },
      numeroNovo: "0142",
      data: "2026-09-01",
      obraId: "obra-b",
      idsRegistrosOrigem: ["unidade-antiga"],
    });
    const detalhe = enriquecerDetalhamentoPatrimonial({
      periodo: { identidadeCanonica: "julho", idItemOrigem: "unidade-antiga", atividadeOrigemId: "atividade-julho", dataInicio: "2026-07-01", dataFim: "2026-07-31", quantidade: 1 },
      atividadesPorId: new Map([["atividade-julho", { id: "atividade-julho", obraId: "obra-a", quantidade: 1 }]]),
      registrosPatrimonio: registros,
    });
    expect(detalhe[0].patrimonioDetalhe).toBe("0142");
  });

  it("não altera obra nem competência do período histórico anterior", () => {
    const periodo = { identidadeCanonica: "julho", idItemOrigem: "unidade-antiga", atividadeOrigemId: "atividade-julho", dataInicio: "2026-07-01", dataFim: "2026-07-31", obraId: "obra-a", competencia: "2026-07", quantidade: 1 };
    const detalhe = enriquecerDetalhamentoPatrimonial({
      periodo,
      atividadesPorId: new Map([["atividade-julho", { id: "atividade-julho", obraId: "obra-a", quantidade: 1 }]]),
      registrosPatrimonio: registrarReutilizacaoPatrimonio({ registros: [registroAntigo("0142")], item: { idItem: "unidade-nova" }, numeroNovo: "0142", data: "2026-09-01", obraId: "obra-b", idsRegistrosOrigem: ["unidade-antiga"] }),
    });
    expect(detalhe[0]).toMatchObject({ obraId: "obra-a", competencia: "2026-07", patrimonioDetalhe: "0142" });
  });

  it("aceita mestre LOCADO quando já pertence à própria unidade", () => {
    const resultado = avaliar({
      equipamentos: [mestre("LOCADO", { idItemOrigem: "unidade-nova" })],
      registrosPatrimonio: [],
    });
    expect(resultado.permitido).toBe(true);
  });
});
