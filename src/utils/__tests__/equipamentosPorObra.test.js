import { beforeEach, describe, expect, it } from "vitest";
import { montarEquipamentosPorObra, montarRelatorioGeralEquipamentos } from "../equipamentosPorObra";

const obra = { id: "obra-1", nome: "Millenium", construtora: "Teste" };
const atividade = (sobrescritas = {}) => ({
  id: `atividade-${Math.random()}`,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  servico: "Instalação",
  iniciaLocacao: true,
  dataLiberacao: "2026-07-01",
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  quantidade: 1,
  tamanho: "3",
  ancoragem: "Simples",
  usaContrapeso: true,
  ...sobrescritas,
});

const gerar = (atividades, registrosPatrimonio = [], equipamentosMestres = []) =>
  montarEquipamentosPorObra({ obra, atividades, registrosPatrimonio, equipamentosMestres });

beforeEach(() => {
  const dados = new Map([
    ["ajustesConfiguracaoEquipamentos", "[]"],
    ["substituicoesEquipamentos", "[]"],
  ]);
  globalThis.localStorage = {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => dados.set(chave, String(valor)),
    removeItem: (chave) => dados.delete(chave),
    clear: () => dados.clear(),
  };
});

describe("Equipamentos por Obra", () => {
  it("mostra equipamento atualmente instalado", () => {
    expect(gerar([atividade({ id: "inst-1" })]).linhas).toHaveLength(1);
  });

  it("não mostra equipamento removido", () => {
    const instalacao = atividade({ id: "inst-1" });
    const remocao = atividade({ id: "rem-1", servico: "Remoção", iniciaLocacao: false, encerraLocacao: true, dataLiberacao: "2026-08-01" });
    expect(gerar([instalacao, remocao]).linhas).toHaveLength(0);
  });

  it("considera Somente aluguel como entrada", () => {
    expect(gerar([atividade({ id: "aluguel-1", servico: "Somente aluguel" })]).linhas).toHaveLength(1);
  });

  it("Somente recolhimento retira a unidade", () => {
    const instalacao = atividade({ id: "inst-1" });
    const recolhimento = atividade({ id: "rec-1", servico: "Somente recolhimento", iniciaLocacao: false, encerraLocacao: true, dataLiberacao: "2026-08-01" });
    expect(gerar([instalacao, recolhimento]).linhas).toHaveLength(0);
  });

  it("deslocamento atualiza tamanho sem duplicar unidade", () => {
    const instalacao = atividade({ id: "inst-1" });
    const deslocamento = atividade({
      id: "desl-1",
      servico: "Deslocamento",
      iniciaLocacao: false,
      dataLiberacao: "2026-07-10",
      itensEquipamentos: [{ idItemOrigem: "legado:inst-1:0", tamanhoNovo: "6", ancoragem: "Duplo" }],
    });
    const resultado = gerar([instalacao, deslocamento]);
    expect(resultado.linhas).toHaveLength(1);
  });

  it("mostra patrimônio definido posteriormente pela Conferência", () => {
    const instalacao = atividade({ id: "inst-1", numerosPatrimonio: [""] });
    const registros = [{ idItem: "legado:inst-1:0", numeroPatrimonioAtual: "0126", historico: [] }];
    expect(gerar([instalacao], registros).linhas[0].patrimonio).toBe("0126");
  });

  it("gera uma linha para cada unidade da mesma instalação", () => {
    const resultado = gerar([atividade({ id: "inst-1", quantidade: 2, numerosPatrimonio: ["0126", "0138"] })]);
    expect(resultado.linhas.map((linha) => linha.patrimonio)).toEqual(["0126", "0138"]);
  });

  it("não duplica a mesma identidade física", () => {
    const resultado = gerar([atividade({ id: "inst-1", itensEquipamentos: [{ idItem: "item-1", numeroPatrimonio: "0126" }] })]);
    expect(new Set(resultado.linhas.map((linha) => linha.identidade)).size).toBe(resultado.linhas.length);
  });

  it("respeita o estado atual do contrapeso", () => {
    const instalacao = atividade({ id: "inst-1", usaContrapeso: true });
    const deslocamento = atividade({
      id: "desl-1",
      servico: "Deslocamento",
      iniciaLocacao: false,
      dataLiberacao: "2026-07-10",
      itensEquipamentos: [{ idItemOrigem: "legado:inst-1:0", alteracaoContrapeso: "remover" }],
    });
    expect(gerar([instalacao, deslocamento]).totalKitsContrapeso).toBe(0);
  });

  it("conta Kits Contrapeso pelas unidades que usam contrapeso", () => {
    const resultado = gerar([
      atividade({ id: "inst-1", usaContrapeso: true }),
      atividade({ id: "inst-2", usaContrapeso: false, dataLiberacao: "2026-07-02" }),
    ]);
    expect(resultado.totalKitsContrapeso).toBe(1);
  });

  it("formata Mini Grua com seu tipo", () => {
    const resultado = gerar([atividade({ id: "grua-1", equipamento: "Mini Grua", tipoMiniGrua: "500kg", usaContrapeso: false })]);
    expect(resultado.linhas[0].equipamento).toBe("Mini Grua 500 kg");
  });

  it("mostra hífen para equipamento legado sem patrimônio", () => {
    expect(gerar([atividade({ id: "inst-1", numerosPatrimonio: [""] })]).linhas[0].patrimonio).toBe("-");
  });

  it("total de equipamentos corresponde à quantidade de linhas", () => {
    const resultado = gerar([atividade({ id: "inst-1", quantidade: 3 })]);
    expect(resultado.totalEquipamentos).toBe(resultado.linhas.length);
    expect(resultado.totalEquipamentos).toBe(3);
  });
});

describe("modo Geral de Equipamentos por Obra", () => {
  const construtoras = [
    { id: "c-2", nome: "Construtora Segunda" },
    { id: "c-1", nome: "Construtora Primeira" },
  ];
  const obras = [
    { id: "obra-2", nome: "Obra Dois", construtoraId: "c-2" },
    { id: "obra-vazia", nome: "Obra Vazia", construtoraId: "c-2" },
    { id: "obra-1", nome: "Obra Um", construtoraId: "c-1" },
  ];
  const atividades = [
    atividade({ id: "e-1", obraId: "obra-2", obra: "Obra Dois", tipoBalancinho: "Eletrico", usaContrapeso: true }),
    atividade({ id: "m-1", obraId: "obra-2", obra: "Obra Dois", tipoBalancinho: "Manual", usaContrapeso: false, dataLiberacao: "2026-07-02" }),
    atividade({ id: "g500", obraId: "obra-1", obra: "Obra Um", equipamento: "Mini Grua", tipoMiniGrua: "500kg", usaContrapeso: false }),
    atividade({ id: "g1t", obraId: "obra-1", obra: "Obra Um", equipamento: "Mini Grua", tipoMiniGrua: "1T", usaContrapeso: false, dataLiberacao: "2026-07-02" }),
  ];
  const geral = () => montarRelatorioGeralEquipamentos({ construtoras, obras, atividades });

  it("inclui todas as obras que possuem equipamentos ativos", () => {
    expect(geral().grupos.flatMap((grupo) => grupo.obras).map((item) => item.obra.id)).toEqual(["obra-2", "obra-1"]);
  });

  it("preserva a ordem original das construtoras", () => {
    expect(geral().grupos.map((grupo) => grupo.construtora.id)).toEqual(["c-2", "c-1"]);
  });

  it("preserva a ordem original das obras", () => {
    const variasObras = [
      ...obras,
      { id: "obra-3", nome: "Obra Três", construtoraId: "c-2" },
    ];
    const variasAtividades = [...atividades, atividade({ id: "e-3", obraId: "obra-3", obra: "Obra Três" })];
    const resultado = montarRelatorioGeralEquipamentos({ construtoras, obras: variasObras, atividades: variasAtividades });
    expect(resultado.grupos[0].obras.map((item) => item.obra.id)).toEqual(["obra-2", "obra-3"]);
  });

  it("omite obra sem equipamento ativo", () => {
    expect(geral().grupos.flatMap((grupo) => grupo.obras).some((item) => item.obra.id === "obra-vazia")).toBe(false);
  });

  it("linhas expõem apenas identidade, equipamento, patrimônio e controle interno de kit", () => {
    expect(Object.keys(geral().grupos[0].obras[0].linhas[0]).sort()).toEqual(["equipamento", "identidade", "patrimonio", "usaContrapeso"].sort());
  });

  it("separa categorias e omite categorias zeradas por obra", () => {
    const resumo = geral().grupos[0].obras[0].resumo;
    expect(resumo.eletricos).toBe(1);
    expect(resumo.manuais).toBe(1);
    expect(resumo.miniGruas500).toBe(0);
    expect(resumo.categorias.map((item) => item.chave)).toEqual(["eletricos", "manuais", "kitsContrapeso"]);
  });

  it("Kit Contrapeso não gera linha e entra no Total Geral da obra", () => {
    const item = geral().grupos[0].obras[0];
    expect(item.linhas).toHaveLength(2);
    expect(item.totalKitsContrapeso).toBe(1);
    expect(item.totalGeral).toBe(3);
  });

  it("Resumo Geral consolida todas as obras e tipos", () => {
    const resumo = geral().resumoGeral;
    expect(resumo).toMatchObject({ eletricos: 1, manuais: 1, miniGruas500: 1, miniGruas1T: 1, kitsContrapeso: 1, totalGeral: 5 });
  });
});
