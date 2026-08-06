const obraBase = {
  id: "obra-1",
  nome: "Rio Branco",
  construtora: "JOSE ROCHA",
};

const atividade = (dados) => ({
  construtora: obraBase.construtora,
  obra: obraBase.nome,
  obraId: obraBase.id,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  quantidade: 1,
  valorTeste: 1200,
  ...dados,
});

export const fixtureJoseRochaJulho = {
  obras: [obraBase],
  atividades: [
    atividade({ id: "entrada-jose", servico: "Instalação", iniciaLocacao: true, dataLiberacao: "2026-01-01", quantidade: 6 }),
    atividade({ id: "saida-jose", servico: "Remoção", encerraLocacao: true, dataLiberacao: "2026-07-15", quantidade: 1 }),
  ],
};

export const fixtureRemocaoPendente = {
  obras: [obraBase],
  atividades: [
    atividade({ id: "entrada-pendente", servico: "Instalação", iniciaLocacao: true, dataLiberacao: "2026-06-01", quantidade: 2 }),
    atividade({ id: "saida-pendente", servico: "Remoção", encerraLocacao: true, dataLiberacao: "2026-07-10", quantidade: 1, pendenteVinculoPatrimonio: true, statusVinculoPatrimonio: "PENDENTE" }),
  ],
};

export const fixtureLegadoLifo = {
  obras: [obraBase],
  atividades: [
    atividade({ id: "legado-antigo", servico: "Instalação", iniciaLocacao: true, dataLiberacao: "2026-05-01", quantidade: 2, valorTeste: 1000 }),
    atividade({ id: "legado-novo", servico: "Instalação", iniciaLocacao: true, dataLiberacao: "2026-07-05", quantidade: 1, valorTeste: 1500 }),
    atividade({ id: "legado-saida", servico: "Remoção", encerraLocacao: true, dataLiberacao: "2026-07-20", quantidade: 1 }),
  ],
};

export const fixtureKitContrapeso = {
  obras: [obraBase],
  atividades: [
    atividade({ id: "kit-entrada", servico: "Instalação", iniciaLocacao: true, dataLiberacao: "2026-07-01", usaContrapeso: true, valorTeste: 1200, valorKitTeste: 300 }),
  ],
};

export const fixtureMes31Dias = {
  obras: [obraBase],
  atividades: [
    atividade({ id: "mes-31", servico: "Instalação", iniciaLocacao: true, dataLiberacao: "2026-07-01" }),
  ],
};

const entradaLegadaJoseRocha = (id, dataLiberacao, extras = {}) =>
  atividade({
    id,
    servico: "Instalação",
    iniciaLocacao: true,
    encerraLocacao: false,
    dataLiberacao,
    numerosPatrimonio: [""],
    ...extras,
  });

const saidaLegadaJoseRocha = (id, dataLiberacao, extras = {}) =>
  atividade({
    id,
    servico: "Remoção",
    iniciaLocacao: false,
    encerraLocacao: true,
    dataLiberacao,
    numerosPatrimonio: [""],
    usaContrapeso: false,
    alteracaoContrapeso: "nenhuma",
    ...extras,
  });

export const fixtureJoseRochaCardsDuplicados = {
  obras: [obraBase],
  atividades: [
    entradaLegadaJoseRocha("entrada-1", "2025-05-14"),
    entradaLegadaJoseRocha("entrada-2", "2025-05-21"),
    entradaLegadaJoseRocha("entrada-3", "2025-06-02"),
    entradaLegadaJoseRocha("entrada-4", "2025-06-11"),
    entradaLegadaJoseRocha("entrada-5", "2025-07-31"),
    entradaLegadaJoseRocha("entrada-6", "2026-02-13"),
    saidaLegadaJoseRocha("saida-julho", "2026-07-15"),
    saidaLegadaJoseRocha("saida-agosto-pendente", "2026-08-03", {
      pendenteVinculoPatrimonio: true,
      statusVinculoPatrimonio: "PENDENTE",
      itensEquipamentos: [
        {
          idItem: "item-pendente",
          equipamento: "Balancinho",
          tipoBalancinho: "Eletrico",
          idEquipamento: "",
          numeroPatrimonio: "",
          usaContrapeso: false,
          usaContrapesoAnterior: false,
          alteracaoContrapeso: "nenhuma",
        },
      ],
    }),
    saidaLegadaJoseRocha("saida-agosto-vinculada", "2026-08-04", {
      pendenteVinculoPatrimonio: true,
      statusVinculoPatrimonio: "PENDENTE",
      itensEquipamentos: [
        {
          idItem: "item-saida",
          idItemOrigem: "legado:entrada-1:0",
          atividadeOrigemId: "entrada-1",
          equipamento: "Balancinho",
          tipoBalancinho: "Eletrico",
          idEquipamento: "",
          numeroPatrimonio: "",
          usaContrapeso: false,
          usaContrapesoAnterior: false,
          alteracaoContrapeso: "nenhuma",
        },
      ],
    }),
  ],
};

export const fixtureKitContrapesoJulhoAgosto = {
  obras: [obraBase],
  atividades: [
    entradaLegadaJoseRocha("entrada-kit", "2026-02-13", {
      usaContrapeso: true,
      quantidadeContrapeso: 1,
      valorKitTeste: 300,
    }),
    saidaLegadaJoseRocha("saida-kit", "2026-07-15", {
      alteracaoContrapeso: "remover",
      quantidadeContrapeso: 1,
    }),
    saidaLegadaJoseRocha("saida-sem-kit", "2026-08-03", {
      alteracaoContrapeso: "nenhuma",
      quantidadeContrapeso: 1,
    }),
  ],
};
