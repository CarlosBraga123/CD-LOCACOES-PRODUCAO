import { describe, expect, it } from "vitest";
import { obterUnidadesEquipamentosAtivos } from "../equipamentosAtivos";
import {
  montarIdentificadoresEquipamentosAtivos,
  obterEquipamentosDisponiveis,
} from "../equipamentosPatrimonio";
import { reconciliarPatrimonioAposAtividades } from "../reconciliacaoPatrimonial";

const obraA = { id: "obra-a", nome: "Obra A", construtora: "Construtora" };
const obraB = { id: "obra-b", nome: "Obra B", construtora: "Construtora" };

const mestre = (patrimonio, situacaoAdministrativa = "NO_GALPAO") => ({
  idEquipamento: `equipamento-${patrimonio}`,
  idItemOrigem: `origem-${patrimonio}`,
  numeroPatrimonioAtual: patrimonio,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  situacaoAdministrativa,
  ativo: true,
  historicoAdministrativo: [],
});

const itemEntrada = (patrimonio, extras = {}) => ({
  idItem: `item-${patrimonio}`,
  idEquipamento: `equipamento-${patrimonio}`,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  numeroPatrimonio: patrimonio,
  tamanho: "6",
  usaContrapeso: false,
  ...extras,
});

const instalacao = ({
  id = "instalacao",
  obra = obraA,
  data = "2026-08-01",
  patrimonios = ["0140"],
  criadoEm,
  usaContrapeso = false,
} = {}) => ({
  id,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  servico: "Instalação",
  iniciaLocacao: true,
  encerraLocacao: false,
  dataLiberacao: data,
  quantidade: patrimonios.length,
  itensEquipamentos: patrimonios.map((patrimonio) =>
    itemEntrada(patrimonio, { usaContrapeso })
  ),
  numerosPatrimonio: patrimonios,
  usaContrapeso,
  ...(criadoEm ? { criadoEm } : {}),
});

const saida = ({
  id = "remocao",
  servico = "Remoção",
  obra = obraA,
  data = "2026-08-20",
  patrimonios = ["0140"],
  criadoEm,
  pendente = false,
} = {}) => ({
  id,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  servico,
  iniciaLocacao: false,
  encerraLocacao: true,
  dataLiberacao: data,
  quantidade: patrimonios.length,
  itensEquipamentos: patrimonios.map((patrimonio, indice) => ({
    idItem: `saida-${id}-${indice}`,
    idItemOrigem: patrimonio ? `item-${patrimonio}` : "",
    idEquipamento: patrimonio ? `equipamento-${patrimonio}` : "",
    equipamento: "Balancinho",
    tipoBalancinho: "Eletrico",
    numeroPatrimonio: patrimonio,
    alteracaoContrapeso: "nenhuma",
  })),
  numerosPatrimonio: patrimonios,
  pendenteVinculoPatrimonio: pendente,
  statusVinculoPatrimonio: pendente ? "PENDENTE" : "VINCULADO",
  ...(criadoEm ? { criadoEm } : {}),
});

const reconciliar = (atividades, equipamentos, obras = [obraA, obraB]) =>
  reconciliarPatrimonioAposAtividades({
    atividades,
    obras,
    equipamentos,
    registrosPatrimonio: [],
    persistir: false,
    data: "2026-08-31",
  });

const situacao = (resultado, patrimonio) =>
  resultado.equipamentos.find(
    (item) => item.numeroPatrimonioAtual === patrimonio
  )?.situacaoAdministrativa;

const disponiveis = (resultado) => {
  const identificadores = montarIdentificadoresEquipamentosAtivos(
    resultado.equipamentosAtivos
  );
  return obterEquipamentosDisponiveis(resultado.equipamentos, "Balancinho")
    .filter(
      (item) =>
        !identificadores.idsEquipamentosAtivos.has(item.idEquipamento) &&
        !identificadores.idsItensAtivos.has(item.idItemOrigem) &&
        !identificadores.patrimoniosAtivos.has(item.numeroPatrimonioAtual)
    )
    .map((item) => item.numeroPatrimonioAtual);
};

describe("reconciliação patrimonial pelo estado operacional atual", () => {
  it("Instalação individualizada deixa o patrimônio indisponível", () => {
    const resultado = reconciliar([instalacao()], [mestre("0140")]);
    expect(situacao(resultado, "0140")).toBe("LOCADO");
    expect(disponiveis(resultado)).not.toContain("0140");
  });

  it("Instalação seguida de Remoção devolve o patrimônio ao galpão", () => {
    const resultado = reconciliar(
      [instalacao(), saida()],
      [mestre("0140", "LOCADO")]
    );
    expect(situacao(resultado, "0140")).toBe("NO_GALPAO");
    expect(disponiveis(resultado)).toContain("0140");
  });

  it("Instalação seguida de Somente recolhimento devolve o patrimônio", () => {
    const resultado = reconciliar(
      [instalacao(), saida({ servico: "Somente recolhimento" })],
      [mestre("0140", "LOCADO")]
    );
    expect(disponiveis(resultado)).toContain("0140");
  });

  it("libera dois patrimônios removidos", () => {
    const resultado = reconciliar(
      [
        instalacao({ patrimonios: ["0140", "0141"] }),
        saida({ patrimonios: ["0140", "0141"] }),
      ],
      [mestre("0140", "LOCADO"), mestre("0141", "LOCADO")]
    );
    expect(disponiveis(resultado).sort()).toEqual(["0140", "0141"]);
  });

  it("libera somente o patrimônio efetivamente removido", () => {
    const resultado = reconciliar(
      [
        instalacao({ patrimonios: ["0140", "0141"] }),
        saida({ patrimonios: ["0140"] }),
      ],
      [mestre("0140", "LOCADO"), mestre("0141", "LOCADO")]
    );
    expect(situacao(resultado, "0140")).toBe("NO_GALPAO");
    expect(situacao(resultado, "0141")).toBe("LOCADO");
    expect(disponiveis(resultado)).toEqual(["0140"]);
  });

  it("Instalação posterior à Remoção volta a deixar o patrimônio LOCADO", () => {
    const resultado = reconciliar(
      [
        instalacao(),
        saida(),
        instalacao({ id: "reinstalacao", obra: obraB, data: "2026-08-25" }),
      ],
      [mestre("0140", "LOCADO")]
    );
    expect(situacao(resultado, "0140")).toBe("LOCADO");
    expect(disponiveis(resultado)).not.toContain("0140");
  });

  it("respeita a cronologia quando o array está fora de ordem", () => {
    const resultado = reconciliar(
      [
        instalacao({ id: "reinstalacao", obra: obraB, data: "2026-08-25" }),
        saida(),
        instalacao(),
      ],
      [mestre("0140", "LOCADO")]
    );
    expect(situacao(resultado, "0140")).toBe("LOCADO");
  });

  it("respeita timestamp nas movimentações do mesmo dia", () => {
    const resultado = reconciliar(
      [
        saida({ data: "2026-08-20", criadoEm: "2026-08-20T09:00:00.000Z" }),
        instalacao({ data: "2026-08-20", criadoEm: "2026-08-20T08:00:00.000Z" }),
      ],
      [mestre("0140", "LOCADO")]
    );
    expect(situacao(resultado, "0140")).toBe("NO_GALPAO");
  });

  it("localiza a Remoção por idEquipamento e idItemOrigem", () => {
    const resultado = reconciliar(
      [instalacao(), saida()],
      [mestre("0140", "LOCADO")]
    );
    expect(resultado.equipamentosAtivos).toHaveLength(0);
  });

  it("mantém fallback por patrimônio para registro incompleto", () => {
    const remocaoIncompleta = saida();
    remocaoIncompleta.itensEquipamentos = [
      {
        equipamento: "Balancinho",
        tipoBalancinho: "Eletrico",
        numeroPatrimonio: "0140",
      },
    ];
    const resultado = reconciliar(
      [instalacao(), remocaoIncompleta],
      [mestre("0140", "LOCADO")]
    );
    expect(situacao(resultado, "0140")).toBe("NO_GALPAO");
  });

  it("preserva LIFO no fluxo legado", () => {
    const entradaLegada = (id, data) => ({
      ...instalacao({ id, data }),
      quantidade: 1,
      itensEquipamentos: undefined,
      numerosPatrimonio: [""],
    });
    const remocaoLegada = {
      ...saida({ patrimonios: [""] }),
      itensEquipamentos: undefined,
      numerosPatrimonio: [""],
    };
    const ativos = obterUnidadesEquipamentosAtivos(obraA, [
      entradaLegada("entrada-antiga", "2026-08-01"),
      entradaLegada("entrada-nova", "2026-08-10"),
      remocaoLegada,
    ]);
    expect(ativos).toHaveLength(1);
    expect(ativos[0].atividadeOrigemId).toBe("entrada-antiga");
  });

  it("Remoção pendente não libera patrimônio por aproximação", () => {
    const remocaoPendente = saida({ patrimonios: [""], pendente: true });
    const resultado = reconciliar(
      [instalacao(), remocaoPendente],
      [mestre("0140", "LOCADO")]
    );
    expect(situacao(resultado, "0140")).toBe("LOCADO");
    expect(disponiveis(resultado)).not.toContain("0140");
  });

  it("edição da atividade recalcula o estado", () => {
    const remocao = saida();
    expect(
      situacao(
        reconciliar([instalacao(), remocao], [mestre("0140", "LOCADO")]),
        "0140"
      )
    ).toBe("NO_GALPAO");
    const remocaoEditada = {
      ...remocao,
      servico: "Manutenção",
      encerraLocacao: false,
    };
    expect(
      situacao(
        reconciliar(
          [instalacao(), remocaoEditada],
          [mestre("0140", "NO_GALPAO")]
        ),
        "0140"
      )
    ).toBe("LOCADO");
  });

  it("exclusão da Remoção recalcula o estado", () => {
    const resultado = reconciliar(
      [instalacao()],
      [mestre("0140", "NO_GALPAO")]
    );
    expect(situacao(resultado, "0140")).toBe("LOCADO");
  });

  it.each(["EM_MANUTENCAO", "INDISPONIVEL", "BAIXADO"])(
    "protege o estado administrativo %s",
    (estado) => {
      const semLocacao = reconciliar([], [mestre("0140", estado)]);
      expect(situacao(semLocacao, "0140")).toBe(estado);
      expect(disponiveis(semLocacao)).not.toContain("0140");

      const comLocacao = reconciliar(
        [instalacao()],
        [mestre("0140", estado)]
      );
      expect(situacao(comLocacao, "0140")).toBe(estado);
      expect(disponiveis(comLocacao)).not.toContain("0140");
    }
  );

  it("mantém o Kit Contrapeso quantitativo pela quantidade atualmente locada", () => {
    const entrada = instalacao({
      patrimonios: ["0140", "0141"],
      usaContrapeso: true,
    });
    const mestres = [mestre("0140"), mestre("0141")];
    const antes = reconciliar([entrada], mestres);
    const depois = reconciliar(
      [entrada, saida({ patrimonios: ["0140", "0141"] })],
      antes.equipamentos
    );
    const totalKits = 2;
    const locadosAntes = antes.equipamentosAtivos.filter(
      (item) => item.usaContrapeso
    ).length;
    const locadosDepois = depois.equipamentosAtivos.filter(
      (item) => item.usaContrapeso
    ).length;
    expect({ locados: locadosAntes, galpao: totalKits - locadosAntes }).toEqual({
      locados: 2,
      galpao: 0,
    });
    expect({ locados: locadosDepois, galpao: totalKits - locadosDepois }).toEqual({
      locados: 0,
      galpao: 2,
    });
  });
});
