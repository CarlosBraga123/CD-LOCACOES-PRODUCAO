import {
  normalizarNumeroPatrimonio,
  obterIdItemPatrimonio,
  obterPatrimonioAtual,
} from "./patrimoniosEquipamentos";

export const CHAVE_EQUIPAMENTOS_PATRIMONIO = "equipamentosPatrimonio";
export const CHAVE_SUBSTITUICOES_EQUIPAMENTOS = "substituicoesEquipamentos";
export const SITUACOES_EQUIPAMENTO = [
  "NO_GALPAO",
  "EM_MANUTENCAO",
  "INDISPONIVEL",
  "BAIXADO",
  "SEM_LOCALIZACAO_ATUAL",
];

const gerarId = (prefixo) =>
  globalThis.crypto?.randomUUID?.() ||
  `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const obterEquipamentosPatrimonio = () => {
  try {
    const dados = JSON.parse(
      localStorage.getItem(CHAVE_EQUIPAMENTOS_PATRIMONIO) || "[]"
    );
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
};

export const salvarEquipamentosPatrimonio = (equipamentos) => {
  localStorage.setItem(
    CHAVE_EQUIPAMENTOS_PATRIMONIO,
    JSON.stringify(Array.isArray(equipamentos) ? equipamentos : [])
  );
};

export const obterSubstituicoesEquipamentos = () => {
  try {
    const dados = JSON.parse(
      localStorage.getItem(CHAVE_SUBSTITUICOES_EQUIPAMENTOS) || "[]"
    );
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
};

export const salvarSubstituicoesEquipamentos = (substituicoes) => {
  localStorage.setItem(
    CHAVE_SUBSTITUICOES_EQUIPAMENTOS,
    JSON.stringify(Array.isArray(substituicoes) ? substituicoes : [])
  );
};

export const obterIdEquipamentoDoItem = (item, equipamentos = []) => {
  if (item?.idEquipamento) return String(item.idEquipamento);
  const idItem = obterIdItemPatrimonio(item);
  return String(
    equipamentos.find(
      (equipamento) => String(equipamento.idItemOrigem || "") === idItem
    )?.idEquipamento || ""
  );
};

const copiarDadosTecnicos = (item = {}) => ({
  equipamento: item.equipamento || "",
  tipoBalancinho: item.tipoBalancinho || "",
  tipoMiniGrua: item.tipoMiniGrua || "",
});

export const migrarEquipamentosConhecidos = ({
  equipamentos = [],
  registrosPatrimonio = [],
  equipamentosAtivos = [],
  data = new Date().toISOString().slice(0, 10),
}) => {
  let alterado = false;
  const resultado = equipamentos.map((item) => ({ ...item }));
  const ativosPorIdItem = new Map(
    equipamentosAtivos.map((item) => [obterIdItemPatrimonio(item), item])
  );

  registrosPatrimonio.forEach((registro) => {
    const idItemOrigem = String(registro.idItem || "");
    if (!idItemOrigem) return;
    const existente = resultado.find(
      (item) => String(item.idItemOrigem || "") === idItemOrigem
    );
    if (existente) return;
    const ativo = ativosPorIdItem.get(idItemOrigem);
    resultado.push({
      idEquipamento: gerarId("equipamento"),
      idItemOrigem,
      numeroPatrimonioAtual: normalizarNumeroPatrimonio(
        registro.numeroPatrimonioAtual
      ),
      ...copiarDadosTecnicos(ativo),
      situacaoAdministrativa: ativo ? "LOCADO" : "SEM_LOCALIZACAO_ATUAL",
      dataCadastro: data,
      observacao: "",
      ativo: true,
      historicoAdministrativo: [
        {
          id: gerarId("historico-admin"),
          tipo: "migracao",
          data,
          situacaoAnterior: "",
          situacaoNova: ativo ? "LOCADO" : "SEM_LOCALIZACAO_ATUAL",
          motivo: "Conversão segura de equipamento já conhecido",
          observacao: "",
        },
      ],
    });
    alterado = true;
  });

  equipamentosAtivos.forEach((ativo) => {
    const idItemOrigem = obterIdItemPatrimonio(ativo);
    const patrimonio = obterPatrimonioAtual(ativo, registrosPatrimonio);
    if (!idItemOrigem || !patrimonio) return;
    const existente = resultado.find(
      (item) =>
        String(item.idItemOrigem || "") === idItemOrigem ||
        normalizarNumeroPatrimonio(item.numeroPatrimonioAtual) === patrimonio
    );
    if (existente) return;
    resultado.push({
      idEquipamento: gerarId("equipamento"),
      idItemOrigem,
      numeroPatrimonioAtual: patrimonio,
      ...copiarDadosTecnicos(ativo),
      situacaoAdministrativa: "LOCADO",
      dataCadastro: data,
      observacao: "",
      ativo: true,
      historicoAdministrativo: [
        {
          id: gerarId("historico-admin"),
          tipo: "migracao",
          data,
          situacaoAnterior: "",
          situacaoNova: "LOCADO",
          motivo: "Conversão de patrimônio legado ativo",
          observacao: "",
        },
      ],
    });
    alterado = true;
  });
  return { equipamentos: resultado, alterado };
};

export const criarEquipamentoPatrimonio = (dados) => {
  const idEquipamento = gerarId("equipamento");
  return {
  idEquipamento,
  idItemOrigem: dados.idItemOrigem || idEquipamento,
  numeroPatrimonioAtual: normalizarNumeroPatrimonio(dados.numeroPatrimonioAtual),
  ...copiarDadosTecnicos(dados),
  situacaoAdministrativa: dados.situacaoAdministrativa || "NO_GALPAO",
  dataCadastro: dados.dataCadastro || new Date().toISOString().slice(0, 10),
  observacao: String(dados.observacao || "").trim(),
  ativo: true,
  historicoAdministrativo: [
    {
      id: gerarId("historico-admin"),
      tipo: "cadastro",
      data: dados.dataCadastro || new Date().toISOString().slice(0, 10),
      situacaoAnterior: "",
      situacaoNova: dados.situacaoAdministrativa || "NO_GALPAO",
      motivo: "Cadastro mestre",
      observacao: String(dados.observacao || "").trim(),
    },
  ],
  };
};

export const alterarEquipamentoPatrimonio = ({
  equipamentos,
  idEquipamento,
  alteracoes,
  data,
  motivo,
  observacao,
  tipo = "alteracao_administrativa",
}) =>
  equipamentos.map((equipamento) => {
    if (String(equipamento.idEquipamento) !== String(idEquipamento)) {
      return equipamento;
    }
    const situacaoAnterior = equipamento.situacaoAdministrativa;
    const situacaoNova =
      alteracoes.situacaoAdministrativa || situacaoAnterior;
    return {
      ...equipamento,
      ...alteracoes,
      numeroPatrimonioAtual:
        alteracoes.numeroPatrimonioAtual !== undefined
          ? normalizarNumeroPatrimonio(alteracoes.numeroPatrimonioAtual)
          : equipamento.numeroPatrimonioAtual,
      historicoAdministrativo: [
        ...(equipamento.historicoAdministrativo || []),
        {
          id: gerarId("historico-admin"),
          tipo,
          data: data || new Date().toISOString().slice(0, 10),
          situacaoAnterior,
          situacaoNova,
          motivo: String(motivo || "").trim(),
          observacao: String(observacao || "").trim(),
        },
      ],
    };
  });

export const sincronizarPatrimoniosMestres = (
  equipamentos,
  registrosPatrimonio
) =>
  equipamentos.map((equipamento) => {
    const registro = registrosPatrimonio.find(
      (item) =>
        String(item.idItem) === String(equipamento.idItemOrigem || "")
    );
    return registro?.numeroPatrimonioAtual
      ? {
          ...equipamento,
          numeroPatrimonioAtual: normalizarNumeroPatrimonio(
            registro.numeroPatrimonioAtual
          ),
        }
      : equipamento;
  });

export const reconciliarSituacoesEquipamentos = ({
  equipamentos,
  equipamentosAtivos,
  data,
  obraOrigemId = "",
}) => {
  const idsAtivos = new Set(
    equipamentosAtivos.flatMap((item) => [
      String(item.idEquipamento || ""),
      obterIdItemPatrimonio(item),
    ]).filter(Boolean)
  );
  let alterado = false;
  const atualizados = equipamentos.map((equipamento) => {
    const estaAtivo =
      idsAtivos.has(String(equipamento.idEquipamento)) ||
      idsAtivos.has(String(equipamento.idItemOrigem || ""));
    if (estaAtivo && equipamento.situacaoAdministrativa !== "LOCADO") {
      alterado = true;
      const atualizado = alterarEquipamentoPatrimonio({
        equipamentos: [equipamento],
        idEquipamento: equipamento.idEquipamento,
        alteracoes: { situacaoAdministrativa: "LOCADO" },
        data,
        motivo: "Equipamento vinculado a uma locação ativa",
        tipo: "ida_locacao",
      })[0];
      const unidadeAtiva = equipamentosAtivos.find(
        (item) =>
          String(item.idEquipamento || "") ===
            String(equipamento.idEquipamento) ||
          obterIdItemPatrimonio(item) ===
            String(equipamento.idItemOrigem || "")
      );
      const historico = atualizado.historicoAdministrativo;
      historico[historico.length - 1].obraId =
        unidadeAtiva?.obraId || "";
      return atualizado;
    }
    if (
      !estaAtivo &&
      equipamento.situacaoAdministrativa === "LOCADO"
    ) {
      alterado = true;
      const atualizado = alterarEquipamentoPatrimonio({
        equipamentos: [equipamento],
        idEquipamento: equipamento.idEquipamento,
        alteracoes: { situacaoAdministrativa: "NO_GALPAO" },
        data,
        motivo: "Retorno após encerramento da locação",
        tipo: "retorno_galpao",
      })[0];
      const historico = atualizado.historicoAdministrativo;
      historico[historico.length - 1].obraId = obraOrigemId;
      return atualizado;
    }
    return equipamento;
  });
  return { equipamentos: atualizados, alterado };
};

export const obterEquipamentosDisponiveis = (equipamentos, tipo) =>
  equipamentos.filter(
    (item) =>
      item.ativo !== false &&
      item.situacaoAdministrativa === "NO_GALPAO" &&
      (!tipo || item.equipamento === tipo)
  );

export const montarIdentificadoresEquipamentosAtivos = (
  equipamentosAtivos = []
) => ({
  idsEquipamentosAtivos: new Set(
    equipamentosAtivos
      .map((item) => String(item.idEquipamento || "").trim())
      .filter(Boolean)
  ),
  idsItensAtivos: new Set(
    equipamentosAtivos
      .flatMap((item) => [
        obterIdItemPatrimonio(item),
        String(item.idUnidade || "").trim(),
        String(item.idItemOrigem || "").trim(),
      ])
      .filter(Boolean)
  ),
  patrimoniosAtivos: new Set(
    equipamentosAtivos
      .map((item) => normalizarNumeroPatrimonio(item.numeroPatrimonio))
      .filter(Boolean)
  ),
});

export const aplicarSubstituicoesEquipamentosAtivos = (
  equipamentosAtivos = [],
  equipamentosMestres = [],
  substituicoes = obterSubstituicoesEquipamentos()
) => {
  const vinculos = new Map(
    equipamentosAtivos.map((item) => [
      String(item.idUnidade || item.idItemOrigem || ""),
      String(item.idEquipamento || ""),
    ])
  );
  substituicoes.forEach((substituicao) => {
    if (substituicao.unidadeOrigemId) {
      vinculos.set(
        String(substituicao.unidadeOrigemId),
        String(substituicao.equipamentoDestinoId)
      );
    }
    if (substituicao.unidadeDestinoId) {
      vinculos.set(
        String(substituicao.unidadeDestinoId),
        String(substituicao.equipamentoOrigemId)
      );
    }
  });
  return equipamentosAtivos.map((item) => {
    const unidadeId = String(item.idUnidade || item.idItemOrigem || "");
    const idEquipamento = vinculos.get(unidadeId) || item.idEquipamento || "";
    const mestre = equipamentosMestres.find(
      (equipamento) =>
        String(equipamento.idEquipamento) === String(idEquipamento)
    );
    return {
      ...item,
      idEquipamento,
      numeroPatrimonio:
        normalizarNumeroPatrimonio(mestre?.numeroPatrimonioAtual) ||
        item.numeroPatrimonio,
    };
  });
};

export const obterPatrimonioFisicoAtualDaUnidade = (item = {}) => {
  const unidadeId = String(
    item.idUnidade || item.idItemOrigem || item.idItem || ""
  );
  let idEquipamento = String(item.idEquipamento || "");
  obterSubstituicoesEquipamentos().forEach((substituicao) => {
    if (String(substituicao.unidadeOrigemId || "") === unidadeId) {
      idEquipamento = String(substituicao.equipamentoDestinoId || "");
    }
    if (String(substituicao.unidadeDestinoId || "") === unidadeId) {
      idEquipamento = String(substituicao.equipamentoOrigemId || "");
    }
  });
  const mestre = obterEquipamentosPatrimonio().find(
    (equipamento) =>
      String(equipamento.idEquipamento) === String(idEquipamento)
  );
  return normalizarNumeroPatrimonio(mestre?.numeroPatrimonioAtual);
};

const compativeisParaSubstituicao = (origem, destino) => {
  if (origem.equipamento !== destino.equipamento) return false;
  if (origem.equipamento === "Balancinho") {
    return (
      (origem.tipoBalancinho || "Eletrico") ===
      (destino.tipoBalancinho || "Eletrico")
    );
  }
  if (origem.equipamento === "Mini Grua") {
    return (
      String(origem.tipoMiniGrua || "") ===
      String(destino.tipoMiniGrua || "")
    );
  }
  return true;
};

export const registrarSubstituicaoEquipamento = ({
  equipamentoOrigemId,
  equipamentoDestinoId,
  equipamentosAtivos,
  data,
  motivo,
  observacao,
}) => {
  const equipamentos = obterEquipamentosPatrimonio();
  const substituicoes = obterSubstituicoesEquipamentos();
  const origem = equipamentos.find(
    (item) => String(item.idEquipamento) === String(equipamentoOrigemId)
  );
  const destino = equipamentos.find(
    (item) => String(item.idEquipamento) === String(equipamentoDestinoId)
  );
  const unidadeOrigem = equipamentosAtivos.find(
    (item) => String(item.idEquipamento) === String(equipamentoOrigemId)
  );
  const unidadeDestino = equipamentosAtivos.find(
    (item) => String(item.idEquipamento) === String(equipamentoDestinoId)
  );
  const unidadesOrigem = equipamentosAtivos.filter(
    (item) => String(item.idEquipamento) === String(equipamentoOrigemId)
  );
  const unidadesDestino = equipamentosAtivos.filter(
    (item) => String(item.idEquipamento) === String(equipamentoDestinoId)
  );

  if (!origem || !destino || !unidadeOrigem) {
    throw new Error("A localização do equipamento mudou. Atualize a tela e tente novamente.");
  }
  if (unidadesOrigem.length !== 1 || unidadesDestino.length > 1) {
    throw new Error("Existe conflito de identidade física nos equipamentos ativos.");
  }
  if (
    ["BAIXADO", "EM_MANUTENCAO", "INDISPONIVEL"].includes(
      origem.situacaoAdministrativa
    )
  ) {
    throw new Error("O equipamento de origem possui uma situação administrativa incompatível.");
  }
  if (origem.idEquipamento === destino.idEquipamento) {
    throw new Error("Selecione outro equipamento para a substituição.");
  }
  if (!compativeisParaSubstituicao(origem, destino)) {
    throw new Error("Os equipamentos selecionados não são compatíveis.");
  }
  if (
    ["BAIXADO", "EM_MANUTENCAO", "INDISPONIVEL"].includes(
      destino.situacaoAdministrativa
    ) ||
    !normalizarNumeroPatrimonio(destino.numeroPatrimonioAtual)
  ) {
    throw new Error("O equipamento substituto não está disponível para esta operação.");
  }
  const destinoLocado = Boolean(unidadeDestino);
  const patrimonioOrigem = normalizarNumeroPatrimonio(
    origem.numeroPatrimonioAtual
  );
  const patrimonioDestino = normalizarNumeroPatrimonio(
    destino.numeroPatrimonioAtual
  );
  const conflitoPatrimonio = equipamentosAtivos.find((item) => {
    const patrimonioAtivo = normalizarNumeroPatrimonio(item.numeroPatrimonio);
    if (
      patrimonioAtivo !== patrimonioOrigem &&
      patrimonioAtivo !== patrimonioDestino
    ) {
      return false;
    }
    return ![
      String(equipamentoOrigemId),
      String(equipamentoDestinoId),
    ].includes(String(item.idEquipamento || ""));
  });
  if (conflitoPatrimonio) {
    throw new Error("Existe conflito de patrimônio entre equipamentos ativos.");
  }
  if (
    !destinoLocado &&
    destino.situacaoAdministrativa !== "NO_GALPAO"
  ) {
    throw new Error("O equipamento substituto não está no galpão nem locado em outra obra.");
  }
  if (
    destinoLocado &&
    String(unidadeDestino.obraId || "") ===
      String(unidadeOrigem.obraId || "")
  ) {
    throw new Error("O substituto já está locado na mesma obra.");
  }

  const idEvento = gerarId("substituicao");
  const evento = {
    id: idEvento,
    data,
    tipo: destinoLocado ? "TROCA_DIRETA" : "SUBSTITUICAO_GALPAO",
    equipamentoOrigemId: origem.idEquipamento,
    equipamentoDestinoId: destino.idEquipamento,
    unidadeOrigemId: unidadeOrigem.idUnidade,
    unidadeDestinoId: unidadeDestino?.idUnidade || "",
    obraOrigemId: unidadeOrigem.obraId || "",
    obraDestinoId: unidadeDestino?.obraId || "",
    motivo: String(motivo || "").trim(),
    observacao: String(observacao || "").trim(),
  };
  const novosEquipamentos = equipamentos.map((item) => {
    if (
      ![origem.idEquipamento, destino.idEquipamento].includes(
        item.idEquipamento
      )
    ) {
      return item;
    }
    const saiu = item.idEquipamento === origem.idEquipamento;
    const situacaoNova =
      saiu && !destinoLocado ? "NO_GALPAO" : "LOCADO";
    const patrimonioOutro = saiu
      ? destino.numeroPatrimonioAtual
      : origem.numeroPatrimonioAtual;
    const obraAnterior = saiu ? unidadeOrigem.obraId : unidadeDestino?.obraId;
    const obraNova = saiu
      ? unidadeDestino?.obraId || ""
      : unidadeOrigem.obraId;
    return {
      ...item,
      situacaoAdministrativa: situacaoNova,
      historicoAdministrativo: [
        ...(item.historicoAdministrativo || []),
        {
          id: gerarId("historico-admin"),
          tipo: "SUBSTITUICAO",
          data,
          situacaoAnterior: item.situacaoAdministrativa,
          situacaoNova,
          motivo: String(motivo || "").trim(),
          observacao: String(observacao || "").trim(),
          patrimonioRelacionado: patrimonioOutro,
          obraAnteriorId: obraAnterior || "",
          obraNovaId: obraNova || "",
          substituicaoId: idEvento,
        },
      ],
    };
  });

  const substituicoesNovas = [...substituicoes, evento];
  const equipamentosAnteriores = localStorage.getItem(
    CHAVE_EQUIPAMENTOS_PATRIMONIO
  );
  const substituicoesAnteriores = localStorage.getItem(
    CHAVE_SUBSTITUICOES_EQUIPAMENTOS
  );
  try {
    salvarSubstituicoesEquipamentos(substituicoesNovas);
    salvarEquipamentosPatrimonio(novosEquipamentos);
  } catch (erro) {
    if (substituicoesAnteriores === null) {
      localStorage.removeItem(CHAVE_SUBSTITUICOES_EQUIPAMENTOS);
    } else {
      localStorage.setItem(
        CHAVE_SUBSTITUICOES_EQUIPAMENTOS,
        substituicoesAnteriores
      );
    }
    if (equipamentosAnteriores === null) {
      localStorage.removeItem(CHAVE_EQUIPAMENTOS_PATRIMONIO);
    } else {
      localStorage.setItem(
        CHAVE_EQUIPAMENTOS_PATRIMONIO,
        equipamentosAnteriores
      );
    }
    throw erro;
  }
  return { equipamentos: novosEquipamentos, substituicoes: substituicoesNovas };
};
