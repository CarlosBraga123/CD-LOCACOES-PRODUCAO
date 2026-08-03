export const CHAVE_PATRIMONIOS_EQUIPAMENTOS = "patrimonioEquipamentos";

export const normalizarNumeroPatrimonio = (numero) =>
  String(numero ?? "").replace(/\s+/g, "");

export const validarNumeroPatrimonio = (numero) =>
  /^\d+$/.test(normalizarNumeroPatrimonio(numero));

export const obterIdItemPatrimonio = (item) =>
  String(item?.idItem || item?.idItemOrigem || item?.idUnidade || "").trim();

export const obterRegistrosPatrimonio = () => {
  try {
    const registros = JSON.parse(
      localStorage.getItem(CHAVE_PATRIMONIOS_EQUIPAMENTOS) || "[]"
    );
    return Array.isArray(registros) ? registros : [];
  } catch {
    return [];
  }
};

export const salvarRegistrosPatrimonio = (registros) => {
  localStorage.setItem(
    CHAVE_PATRIMONIOS_EQUIPAMENTOS,
    JSON.stringify(Array.isArray(registros) ? registros : [])
  );
};

export const obterPatrimonioAtual = (item, registros = []) => {
  const idItem = obterIdItemPatrimonio(item);
  const registro = registros.find(
    (candidato) => String(candidato.idItem) === idItem
  );
  const administrativo = normalizarNumeroPatrimonio(
    registro?.numeroPatrimonioAtual
  );
  if (administrativo) return administrativo;
  return normalizarNumeroPatrimonio(item?.numeroPatrimonio);
};

export const aplicarPatrimoniosAdministrativos = (itens, registros = []) =>
  (Array.isArray(itens) ? itens : []).map((item) => ({
    ...item,
    numeroPatrimonio: obterPatrimonioAtual(item, registros),
  }));

export const verificarPatrimonioDuplicado = (
  numero,
  idItemAtual,
  registros = [],
  equipamentosAtivos = [],
  edicoes = []
) => {
  const normalizado = normalizarNumeroPatrimonio(numero);
  const idAtual = String(idItemAtual || "");
  const registroDoProprioItem = registros.find(
    (registro) => String(registro.idItem) === idAtual
  );
  if (
    registroDoProprioItem &&
    normalizarNumeroPatrimonio(
      registroDoProprioItem.numeroPatrimonioAtual
    ) === normalizado
  ) {
    return null;
  }

  const registroAtual = registros.find(
    (registro) =>
      String(registro.idItem) !== idAtual &&
      normalizarNumeroPatrimonio(registro.numeroPatrimonioAtual) === normalizado
  );
  if (registroAtual) return { tipo: "atual", idItem: registroAtual.idItem };

  const ativoAtual = equipamentosAtivos.find(
    (item) =>
      obterIdItemPatrimonio(item) !== idAtual &&
      obterPatrimonioAtual(item, registros) === normalizado
  );
  if (ativoAtual) return { tipo: "atual", idItem: obterIdItemPatrimonio(ativoAtual) };

  const edicaoAtual = edicoes.find(
    (item) =>
      String(item.idItem) !== idAtual &&
      normalizarNumeroPatrimonio(item.numero) === normalizado
  );
  if (edicaoAtual) return { tipo: "atual", idItem: edicaoAtual.idItem };

  const historico = registros.find((registro) =>
    (registro.historico || []).some(
      (evento) =>
        normalizarNumeroPatrimonio(evento.numeroAnterior) === normalizado ||
        normalizarNumeroPatrimonio(evento.numeroNovo) === normalizado
    )
  );
  if (historico) {
    return { tipo: "historico", idItem: historico.idItem };
  }

  return null;
};

const gerarIdHistorico = () =>
  globalThis.crypto?.randomUUID?.() ||
  `historico-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const registrarCadastroInicialPatrimonio = ({
  registros,
  item,
  numeroNovo,
  data,
  obraId,
}) => {
  const idItem = obterIdItemPatrimonio(item);
  const numero = normalizarNumeroPatrimonio(numeroNovo);
  const numeroAnterior = normalizarNumeroPatrimonio(item?.numeroPatrimonio);
  const atuais = Array.isArray(registros) ? registros : [];
  const indice = atuais.findIndex((registro) => String(registro.idItem) === idItem);
  const registroAnterior = indice >= 0 ? atuais[indice] : null;
  const historico = [...(registroAnterior?.historico || [])];

  historico.push({
    id: gerarIdHistorico(),
    tipo: "cadastro_inicial",
    numeroAnterior: numeroAnterior || null,
    numeroNovo: numero,
    data,
    obraId: obraId || "",
    motivo: "",
    observacao: "",
  });

  const atualizado = {
    idItem,
    numeroPatrimonioAtual: numero,
    historico,
  };
  if (indice < 0) return [...atuais, atualizado];
  return atuais.map((registro, posicao) =>
    posicao === indice ? atualizado : registro
  );
};

export const registrarTrocaPatrimonio = ({
  registros,
  item,
  numeroNovo,
  data,
  obraId,
  motivo,
  observacao,
}) => {
  const idItem = obterIdItemPatrimonio(item);
  const numeroAnterior = obterPatrimonioAtual(item, registros);
  const numero = normalizarNumeroPatrimonio(numeroNovo);
  const atuais = Array.isArray(registros) ? registros : [];
  const indice = atuais.findIndex((registro) => String(registro.idItem) === idItem);
  const registroAnterior = indice >= 0 ? atuais[indice] : null;
  const historico = [...(registroAnterior?.historico || [])];

  historico.push({
    id: gerarIdHistorico(),
    tipo: "troca",
    numeroAnterior: numeroAnterior || null,
    numeroNovo: numero,
    data,
    obraId: obraId || "",
    motivo: String(motivo || "").trim(),
    observacao: String(observacao || "").trim(),
  });

  const atualizado = {
    idItem,
    numeroPatrimonioAtual: numero,
    historico,
  };
  if (indice < 0) return [...atuais, atualizado];
  return atuais.map((registro, posicao) =>
    posicao === indice ? atualizado : registro
  );
};

export const consultarPatrimonio = (numero, registros = []) => {
  const normalizado = normalizarNumeroPatrimonio(numero);
  if (!normalizado) return null;

  for (const registro of registros) {
    if (
      normalizarNumeroPatrimonio(registro.numeroPatrimonioAtual) === normalizado
    ) {
      return { registro, situacao: "Ativo", evento: null };
    }
    const evento = [...(registro.historico || [])]
      .reverse()
      .find(
        (item) =>
          normalizarNumeroPatrimonio(item.numeroAnterior) === normalizado ||
          (normalizarNumeroPatrimonio(item.numeroNovo) === normalizado &&
            normalizado !==
              normalizarNumeroPatrimonio(registro.numeroPatrimonioAtual))
      );
    if (evento) return { registro, situacao: "Substituído", evento };
  }
  return null;
};

const normalizarBuscaPatrimonio = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const obterConstrutoraDaObraPatrimonio = (obra, construtoras = []) =>
  construtoras.find((construtora) =>
    obra?.construtoraId && construtora?.id
      ? String(obra.construtoraId) === String(construtora.id)
      : normalizarBuscaPatrimonio(obra?.construtora) ===
        normalizarBuscaPatrimonio(construtora?.nome)
  );

const obterNumerosAnteriores = (registro) => {
  const atual = normalizarNumeroPatrimonio(registro?.numeroPatrimonioAtual);
  const numeros = [];
  (registro?.historico || []).forEach((evento) => {
    [evento.numeroAnterior, evento.numeroNovo].forEach((numero) => {
      const normalizado = normalizarNumeroPatrimonio(numero);
      if (normalizado && normalizado !== atual && !numeros.includes(normalizado)) {
        numeros.push(normalizado);
      }
    });
  });
  return numeros;
};

export const montarControleGeralPatrimonios = ({
  registrosPatrimonio = [],
  equipamentosMestres = [],
  equipamentosAtivos = [],
  construtoras = [],
  obras = [],
}) => {
  const registrosPorId = new Map(
    registrosPatrimonio.map((registro) => [String(registro.idItem), registro])
  );
  const consolidados = [];
  const idsAtivos = new Set();
  const mestresPorId = new Map(
    equipamentosMestres.map((item) => [String(item.idEquipamento), item])
  );
  const mestresPorOrigem = new Map(
    equipamentosMestres
      .filter((item) => item.idItemOrigem)
      .map((item) => [String(item.idItemOrigem), item])
  );

  equipamentosAtivos.forEach((item, indice) => {
    const idItem = obterIdItemPatrimonio(item) || `ativo-sem-id-${indice}`;
    const mestre =
      mestresPorId.get(String(item.idEquipamento || "")) ||
      mestresPorOrigem.get(idItem);
    const chaveUnica = mestre?.idEquipamento || idItem;
    if (idsAtivos.has(chaveUnica)) return;
    idsAtivos.add(chaveUnica);
    const registro = registrosPorId.get(idItem);
    const obra = obras.find(
      (candidata) => String(candidata.id || "") === String(item.obraId || "")
    );
    const construtora = obterConstrutoraDaObraPatrimonio(obra, construtoras);
    const numeroAtual = obterPatrimonioAtual(item, registrosPatrimonio);
    const historico = Array.isArray(registro?.historico) ? registro.historico : [];

    consolidados.push({
      ...(mestre || {}),
      ...item,
      idItem,
      idEquipamento: mestre?.idEquipamento || item.idEquipamento || "",
      numeroPatrimonioAtual:
        normalizarNumeroPatrimonio(mestre?.numeroPatrimonioAtual) || numeroAtual,
      situacao: "LOCADO",
      construtoraId: construtora?.id || obra?.construtoraId || "",
      construtoraNome: construtora?.nome || item.construtoraNome || obra?.construtora || "",
      obraId: obra?.id || item.obraId || "",
      obraNome: obra?.nome || item.obraNome || "",
      historico,
      numerosAnteriores: obterNumerosAnteriores(registro),
      origemPatrimonio: registro?.numeroPatrimonioAtual
        ? "Administrativo"
        : numeroAtual
          ? "Legado"
          : "Sem patrimônio",
      registroAdministrativo: registro || null,
      historicoAdministrativo: mestre?.historicoAdministrativo || [],
      dataCadastro: mestre?.dataCadastro || "",
      observacao: mestre?.observacao || "",
      ordemOriginal: indice,
    });
  });

  registrosPatrimonio.forEach((registro, indice) => {
    const idItem = String(registro.idItem || "");
    const mestre = mestresPorOrigem.get(idItem);
    if (!idItem || idsAtivos.has(mestre?.idEquipamento || idItem)) return;
    idsAtivos.add(mestre?.idEquipamento || idItem);
    consolidados.push({
      ...(mestre || {}),
      idItem,
      idEquipamento: mestre?.idEquipamento || "",
      numeroPatrimonioAtual: normalizarNumeroPatrimonio(
        registro.numeroPatrimonioAtual
      ),
      equipamento: mestre?.equipamento || "",
      tipoBalancinho: mestre?.tipoBalancinho || "",
      tipoMiniGrua: mestre?.tipoMiniGrua || "",
      tamanho: "",
      ancoragem: "",
      usaContrapeso: false,
      situacao: mestre?.situacaoAdministrativa || "SEM_LOCALIZACAO_ATUAL",
      construtoraId: "",
      construtoraNome: "",
      obraId: "",
      obraNome: "",
      historico: Array.isArray(registro.historico) ? registro.historico : [],
      numerosAnteriores: obterNumerosAnteriores(registro),
      origemPatrimonio: "Administrativo",
      registroAdministrativo: registro,
      historicoAdministrativo: mestre?.historicoAdministrativo || [],
      dataCadastro: mestre?.dataCadastro || "",
      observacao: mestre?.observacao || "",
      ordemOriginal: equipamentosAtivos.length + indice,
    });
  });

  equipamentosMestres.forEach((mestre, indice) => {
    if (idsAtivos.has(mestre.idEquipamento)) return;
    idsAtivos.add(mestre.idEquipamento);
    const registro = registrosPorId.get(String(mestre.idItemOrigem || ""));
    consolidados.push({
      ...mestre,
      idItem: mestre.idItemOrigem || "",
      numeroPatrimonioAtual: normalizarNumeroPatrimonio(
        mestre.numeroPatrimonioAtual
      ),
      situacao: mestre.situacaoAdministrativa || "SEM_LOCALIZACAO_ATUAL",
      construtoraId: "",
      construtoraNome: "",
      obraId: "",
      obraNome: "",
      tamanho: "",
      ancoragem: "",
      usaContrapeso: false,
      historico: registro?.historico || [],
      numerosAnteriores: obterNumerosAnteriores(registro),
      origemPatrimonio: "Cadastro mestre",
      registroAdministrativo: registro || null,
      historicoAdministrativo: mestre.historicoAdministrativo || [],
      ordemOriginal:
        equipamentosAtivos.length + registrosPatrimonio.length + indice,
    });
  });

  return consolidados;
};

export const obterResumoControlePatrimonios = (itens = []) => ({
  equipamentosAtivos: itens.filter(
    (item) => item.situacao === "LOCADO"
  ).length,
  comPatrimonio: itens.filter(
    (item) =>
      Boolean(item.numeroPatrimonioAtual) &&
      item.situacao === "LOCADO"
  ).length,
  semPatrimonio: itens.filter(
    (item) => item.situacao === "LOCADO" && !item.numeroPatrimonioAtual
  ).length,
  semLocalizacao: itens.filter(
    (item) =>
      item.situacao === "SEM LOCALIZAÇÃO ATUAL" ||
      item.situacao === "SEM_LOCALIZACAO_ATUAL"
  ).length,
  numerosSubstituidos: new Set(
    itens.flatMap((item) => item.numerosAnteriores || [])
  ).size,
  totalCadastrado: itens.length,
  noGalpao: itens.filter((item) => item.situacao === "NO_GALPAO").length,
  locados: itens.filter((item) => item.situacao === "LOCADO").length,
  emManutencao: itens.filter((item) => item.situacao === "EM_MANUTENCAO").length,
  indisponiveis: itens.filter((item) => item.situacao === "INDISPONIVEL").length,
  baixados: itens.filter((item) => item.situacao === "BAIXADO").length,
});
