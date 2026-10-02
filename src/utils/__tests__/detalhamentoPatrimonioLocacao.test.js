import { describe, expect, it } from "vitest";
import { enriquecerDetalhamentoPatrimonial } from "../detalhamentoPatrimonioLocacao";

const periodoBase = (sobrescritas = {}) => ({
  identidadeCanonica: "periodo-1",
  atividadeInicioId: "atividade-1",
  quantidade: 1,
  quantidadeDetalhe: 1,
  valorMensal: 100,
  valorProporcional: 50,
  equipamento: "Balancinho Elétrico",
  ...sobrescritas,
});

const enriquecer = (periodo, atividades = [], registrosPatrimonio = []) =>
  enriquecerDetalhamentoPatrimonial({
    periodo,
    atividadesPorId: new Map(
      atividades.map((atividade) => [String(atividade.id), atividade])
    ),
    registrosPatrimonio,
  });

const registroConferencia = (idItem, patrimonio, sobrescritas = {}) => ({
  idItem,
  numeroPatrimonioAtual: patrimonio,
  historico: [
    {
      id: `cadastro-${idItem}`,
      tipo: "cadastro_inicial",
      numeroAnterior: null,
      numeroNovo: patrimonio,
      data: "2026-07-15",
      obraId: "obra-a",
    },
  ],
  ...sobrescritas,
});

describe("detalhamento patrimonial histórico da locação", () => {
  it("mantém o patrimônio de instalação individualizada recente", () => {
    expect(enriquecer(periodoBase({ numeroPatrimonio: "0140" }))[0].patrimonioDetalhe).toBe("0140");
  });

  it("prioriza numeroPatrimonio do próprio período", () => {
    expect(enriquecer(periodoBase({ numeroPatrimonio: "0010", patrimonio: "0099" }))[0].patrimonioDetalhe).toBe("0010");
  });

  it("aceita o alias patrimonio do período", () => {
    expect(enriquecer(periodoBase({ patrimonio: "0099" }))[0].patrimonioDetalhe).toBe("0099");
  });

  it("recupera numerosPatrimonio legado quando quantidade é compatível", () => {
    const atividade = { id: "atividade-1", quantidade: 1, numerosPatrimonio: ["0140"] };
    expect(enriquecer(periodoBase(), [atividade])[0].patrimonioDetalhe).toBe("0140");
  });

  it("cria duas representações visuais para dois patrimônios legados", () => {
    const atividade = { id: "atividade-1", quantidade: 2, numerosPatrimonio: ["0140", "0141"] };
    const detalhes = enriquecer(periodoBase({ quantidade: 2, quantidadeDetalhe: 2 }), [atividade]);
    expect(detalhes.map((item) => item.patrimonioDetalhe)).toEqual(["0140", "0141"]);
    expect(detalhes.every((item) => item.quantidadeDetalhe === 1)).toBe(true);
  });

  it("não associa lista cuja quantidade é incompatível", () => {
    const atividade = { id: "atividade-1", quantidade: 2, numerosPatrimonio: ["0140"] };
    expect(enriquecer(periodoBase({ quantidade: 2 }), [atividade])[0].patrimonioDetalhe).toBe("");
  });

  it("mantém vazio registro sem informação patrimonial", () => {
    expect(enriquecer(periodoBase(), [{ id: "atividade-1", quantidade: 1 }])[0].patrimonioDetalhe).toBe("");
  });

  it("aproveita itens adicionados por vínculo patrimonial posterior", () => {
    const atividade = {
      id: "atividade-1",
      quantidade: 1,
      itensEquipamentos: [{ idItem: "item-1", numeroPatrimonio: "0140" }],
      numerosPatrimonio: ["0140"],
    };
    expect(enriquecer(periodoBase({ idItemOrigem: "item-1" }), [atividade])[0].patrimonioDetalhe).toBe("0140");
  });

  it("usa a identidade da unidade em uma remoção vinculada", () => {
    const atividade = {
      id: "atividade-1",
      quantidade: 2,
      itensEquipamentos: [
        { idEquipamento: "eq-1", numeroPatrimonio: "0140" },
        { idEquipamento: "eq-2", numeroPatrimonio: "0141" },
      ],
    };
    expect(enriquecer(periodoBase({ idEquipamento: "eq-2" }), [atividade])[0].patrimonioDetalhe).toBe("0141");
  });

  it("não troca o histórico quando o patrimônio é reutilizado depois", () => {
    const agosto = { id: "atividade-1", quantidade: 1, numerosPatrimonio: ["0140"] };
    const setembro = { id: "atividade-2", quantidade: 1, numerosPatrimonio: ["0140"] };
    expect(enriquecer(periodoBase(), [agosto, setembro])[0].patrimonioDetalhe).toBe("0140");
  });

  it("não consulta nem depende do cadastro mestre atual", () => {
    const atividade = { id: "atividade-1", quantidade: 1, numerosPatrimonio: ["0140"] };
    globalThis.localStorage?.setItem?.("patrimoniosEquipamentos", JSON.stringify([{ numeroPatrimonio: "9999" }]));
    expect(enriquecer(periodoBase(), [atividade])[0].patrimonioDetalhe).toBe("0140");
  });

  it("preserva a pendência sem inventar patrimônio", () => {
    const detalhe = enriquecer(periodoBase({ saidaPatrimonialPendente: true }))[0];
    expect(detalhe.saidaPatrimonialPendente).toBe(true);
    expect(detalhe.patrimonioDetalhe).toBe("");
  });

  it("não altera o comportamento visual do Kit Contrapeso", () => {
    const detalhe = enriquecer(periodoBase({ usaContrapeso: true, patrimonio: "0140" }))[0];
    expect(detalhe.exibirPatrimonioDetalhe).toBe(false);
    expect(detalhe.patrimonioDetalhe).toBeUndefined();
  });

  it("preserva exatamente os totais ao dividir apenas a representação visual", () => {
    const atividade = { id: "atividade-1", quantidade: 2, numerosPatrimonio: ["0140", "0141"] };
    const detalhes = enriquecer(periodoBase({ quantidade: 2, valorMensal: 300, valorProporcional: 175 }), [atividade]);
    expect(detalhes.reduce((total, item) => total + item.valorMensal, 0)).toBe(300);
    expect(detalhes.reduce((total, item) => total + item.valorProporcional, 0)).toBe(175);
  });

  it("bloqueia patrimônio duplicado em período agregado ambíguo", () => {
    const atividade = { id: "atividade-1", quantidade: 2, numerosPatrimonio: ["0140", "0140"] };
    const detalhes = enriquecer(periodoBase({ quantidade: 2 }), [atividade]);
    expect(detalhes).toHaveLength(1);
    expect(detalhes[0].patrimonioDetalhe).toBe("");
  });
});

describe("patrimônio informado pela Conferência da obra", () => {
  const atividadeLegada = {
    id: "atividade-123",
    obraId: "obra-a",
    quantidade: 1,
    numerosPatrimonio: [""],
  };
  const periodoLegado = periodoBase({
    atividadeInicioId: "atividade-123",
    dataEntradaOriginal: "2026-07-01",
    dataInicio: "2026-07-01",
    dataFim: "2026-07-31",
  });

  it("recupera cadastro inicial pela identidade legado da atividade", () => {
    const detalhes = enriquecer(periodoLegado, [atividadeLegada], [
      registroConferencia("legado:atividade-123:0", "0140"),
    ]);
    expect(detalhes[0].patrimonioDetalhe).toBe("0140");
  });

  it("usa exatamente o idItem legado correspondente", () => {
    const detalhes = enriquecer(periodoLegado, [atividadeLegada], [
      registroConferencia("legado:outra-atividade:0", "9999"),
      registroConferencia("legado:atividade-123:0", "0140"),
    ]);
    expect(detalhes[0].patrimonioDetalhe).toBe("0140");
  });

  it("individualiza visualmente dois patrimônios conferidos", () => {
    const atividade = { ...atividadeLegada, quantidade: 2, numerosPatrimonio: ["", ""] };
    const detalhes = enriquecer(
      { ...periodoLegado, quantidade: 2, quantidadeDetalhe: 2 },
      [atividade],
      [
        registroConferencia("legado:atividade-123:0", "0140"),
        registroConferencia("legado:atividade-123:1", "0141"),
      ]
    );
    expect(detalhes.map((item) => item.patrimonioDetalhe)).toEqual(["0140", "0141"]);
  });

  it("não altera a data inicial quando a Conferência é posterior", () => {
    const detalhe = enriquecer(periodoLegado, [atividadeLegada], [
      registroConferencia("legado:atividade-123:0", "0140"),
    ])[0];
    expect(detalhe.dataEntradaOriginal).toBe("2026-07-01");
  });

  it("não usa reutilização posterior de mesmo patrimônio em outra identidade", () => {
    const detalhes = enriquecer(periodoLegado, [atividadeLegada], [
      registroConferencia("legado:atividade-123:0", "0140"),
      registroConferencia("legado:atividade-999:0", "0140", {
        historico: [{ tipo: "cadastro_inicial", numeroNovo: "0140", data: "2026-09-10", obraId: "obra-b" }],
      }),
    ]);
    expect(detalhes[0].patrimonioDetalhe).toBe("0140");
  });

  it("troca posterior não reescreve período anterior", () => {
    const registro = registroConferencia("legado:atividade-123:0", "0140");
    registro.numeroPatrimonioAtual = "0150";
    registro.historico.push({ tipo: "troca", numeroAnterior: "0140", numeroNovo: "0150", data: "2026-08-20", obraId: "obra-a" });
    expect(enriquecer(periodoLegado, [atividadeLegada], [registro])[0].patrimonioDetalhe).toBe("0140");
  });

  it("aplica troca ocorrida antes do período consultado", () => {
    const registro = registroConferencia("legado:atividade-123:0", "0140");
    registro.numeroPatrimonioAtual = "0150";
    registro.historico.push({ tipo: "troca", numeroAnterior: "0140", numeroNovo: "0150", data: "2026-08-20", obraId: "obra-a" });
    const setembro = { ...periodoLegado, dataInicio: "2026-09-01", dataFim: "2026-09-30" };
    expect(enriquecer(setembro, [atividadeLegada], [registro])[0].patrimonioDetalhe).toBe("0150");
  });

  it("mantém associação conservadora quando a troca ocorre dentro do período", () => {
    const registro = registroConferencia("legado:atividade-123:0", "0140");
    registro.numeroPatrimonioAtual = "0150";
    registro.historico.push({ tipo: "troca", numeroAnterior: "0140", numeroNovo: "0150", data: "2026-07-20", obraId: "obra-a" });
    expect(enriquecer(periodoLegado, [atividadeLegada], [registro])[0].patrimonioDetalhe).toBe("");
  });

  it("ignora registro sem idItem", () => {
    expect(enriquecer(periodoLegado, [atividadeLegada], [registroConferencia("", "0140")])[0].patrimonioDetalhe).toBe("");
  });

  it("mantém vazio quando a identidade não corresponde", () => {
    expect(enriquecer(periodoLegado, [atividadeLegada], [registroConferencia("legado:outra:0", "0140")])[0].patrimonioDetalhe).toBe("");
  });

  it("bloqueia múltiplos registros para a mesma identidade", () => {
    const registro = registroConferencia("legado:atividade-123:0", "0140");
    expect(enriquecer(periodoLegado, [atividadeLegada], [registro, { ...registro }])[0].patrimonioDetalhe).toBe("");
  });

  it("bloqueia conflito entre a obra histórica e a atividade", () => {
    const registro = registroConferencia("legado:atividade-123:0", "0140");
    registro.historico[0].obraId = "obra-b";
    expect(enriquecer(periodoLegado, [atividadeLegada], [registro])[0].patrimonioDetalhe).toBe("");
  });

  it("preserva Patrimônio pendente", () => {
    const detalhe = enriquecer(
      { ...periodoLegado, saidaPatrimonialPendente: true },
      [atividadeLegada],
      [registroConferencia("legado:atividade-123:0", "0140")]
    )[0];
    expect(detalhe.saidaPatrimonialPendente).toBe(true);
  });

  it("mantém prioridade do patrimônio explícito de instalações recentes", () => {
    const detalhe = enriquecer(
      { ...periodoLegado, numeroPatrimonio: "0200" },
      [atividadeLegada],
      [registroConferencia("legado:atividade-123:0", "0140")]
    )[0];
    expect(detalhe.patrimonioDetalhe).toBe("0200");
  });

  it("mantém Kit Contrapeso fora do enriquecimento", () => {
    const detalhe = enriquecer(
      { ...periodoLegado, usaContrapeso: true },
      [atividadeLegada],
      [registroConferencia("legado:atividade-123:0", "0140")]
    )[0];
    expect(detalhe.exibirPatrimonioDetalhe).toBe(false);
  });

  it("preserva os totais financeiros ao expandir dois registros conferidos", () => {
    const atividade = { ...atividadeLegada, quantidade: 2, numerosPatrimonio: ["", ""] };
    const detalhes = enriquecer(
      { ...periodoLegado, quantidade: 2, quantidadeDetalhe: 2, valorMensal: 300, valorProporcional: 175 },
      [atividade],
      [
        registroConferencia("legado:atividade-123:0", "0140"),
        registroConferencia("legado:atividade-123:1", "0141"),
      ]
    );
    expect(detalhes.reduce((soma, item) => soma + item.valorMensal, 0)).toBe(300);
    expect(detalhes.reduce((soma, item) => soma + item.valorProporcional, 0)).toBe(175);
  });
});
