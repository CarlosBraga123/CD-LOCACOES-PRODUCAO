const texto = (valor) => String(valor ?? "").trim();

const valoresUnicosValidos = (valores) => {
  const normalizados = valores.map(texto);
  if (normalizados.some((valor) => !valor)) return null;
  if (new Set(normalizados).size !== normalizados.length) return null;
  return normalizados;
};

const obterAtividadeHistorica = (periodo, atividadesPorId) => {
  const ids = [periodo.atividadeOrigemId, periodo.atividadeInicioId]
    .map(texto)
    .filter(Boolean);

  for (const id of ids) {
    const atividade = atividadesPorId.get(id);
    if (atividade) return atividade;
  }
  return null;
};

const obterPatrimonioPorIdentidade = (periodo, atividade) => {
  const identidades = [periodo.idEquipamento, periodo.idItemOrigem]
    .map(texto)
    .filter(Boolean);
  if (!identidades.length) return "";

  const itens = Array.isArray(atividade?.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];
  const correspondentes = itens.filter((item) => {
    const idsItem = [item.idEquipamento, item.idItem, item.idItemOrigem]
      .map(texto)
      .filter(Boolean);
    return identidades.some((id) => idsItem.includes(id));
  });
  if (correspondentes.length !== 1) return "";
  return texto(correspondentes[0].numeroPatrimonio);
};

const obterListaHistoricaInequivoca = (periodo, atividade) => {
  const quantidade = Math.max(
    1,
    Number(periodo.quantidadeFinanceira ?? periodo.quantidade) || 1
  );
  if (!atividade || Math.max(1, Number(atividade.quantidade) || 1) !== quantidade) {
    return null;
  }

  const itens = Array.isArray(atividade.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];
  if (itens.length === quantidade) {
    const patrimoniosItens = valoresUnicosValidos(
      itens.map((item) => item.numeroPatrimonio)
    );
    if (patrimoniosItens) return patrimoniosItens;
  }

  const numeros = Array.isArray(atividade.numerosPatrimonio)
    ? atividade.numerosPatrimonio
    : [];
  if (numeros.length !== quantidade) return null;
  return valoresUnicosValidos(numeros);
};

const dividirValor = (valor, quantidade) => Number(valor || 0) / quantidade;

const obterDataInicioPeriodo = (periodo) =>
  texto(periodo.dataInicio || periodo.dataEntradaOriginal || periodo.dataEntrada);

const obterDataFimPeriodo = (periodo) =>
  texto(periodo.dataFim || periodo.dataSaidaEfetiva || periodo.dataSaida);

const obterPatrimonioHistoricoRegistro = ({ registro, periodo, obraId }) => {
  const eventos = (Array.isArray(registro?.historico) ? registro.historico : [])
    .filter((evento) => texto(evento.numeroNovo))
    .sort(
      (a, b) =>
        texto(a.data).localeCompare(texto(b.data)) ||
        texto(a.id).localeCompare(texto(b.id))
    );
  if (!eventos.length) return "";

  const cadastrosIniciais = eventos.filter(
    (evento) => texto(evento.tipo).toLowerCase() === "cadastro_inicial"
  );
  if (cadastrosIniciais.length !== 1) return "";

  const cadastroInicial = cadastrosIniciais[0];
  const obraCadastro = texto(cadastroInicial.obraId);
  if (obraId && obraCadastro && obraId !== obraCadastro) return "";

  let patrimonio = texto(cadastroInicial.numeroNovo);
  if (!patrimonio) return "";

  const inicioPeriodo = obterDataInicioPeriodo(periodo);
  const fimPeriodo = obterDataFimPeriodo(periodo);
  const trocas = eventos.filter(
    (evento) => texto(evento.tipo).toLowerCase() === "troca"
  );

  for (const troca of trocas) {
    const dataTroca = texto(troca.data);
    const anterior = texto(troca.numeroAnterior);
    const novo = texto(troca.numeroNovo);
    if (!dataTroca || !novo || (anterior && anterior !== patrimonio)) return "";

    if (inicioPeriodo && dataTroca <= inicioPeriodo) {
      patrimonio = novo;
      continue;
    }
    if (!fimPeriodo || dataTroca <= fimPeriodo) {
      return "";
    }
  }

  return patrimonio;
};

const obterIdentidadesHistoricas = (periodo, atividade, quantidade) => {
  const diretas = [
    periodo.idUnidade,
    periodo.idItem,
    periodo.idItemOrigem,
    periodo.idEquipamento,
    periodo.identidadeUnidade,
    periodo.vinculoBase,
  ]
    .map(texto)
    .filter(Boolean);

  if (quantidade === 1 && diretas.length) return [...new Set(diretas)];
  if (!atividade || Array.isArray(atividade.itensEquipamentos)) return [];
  if (Math.max(1, Number(atividade.quantidade) || 1) !== quantidade) return [];

  return Array.from(
    { length: quantidade },
    (_, indice) => `legado:${atividade.id ?? "sem-id"}:${indice}`
  );
};

const obterListaPatrimoniosConferencia = ({
  periodo,
  atividade,
  registrosPatrimonio,
}) => {
  const quantidade = Math.max(
    1,
    Number(periodo.quantidadeFinanceira ?? periodo.quantidade) || 1
  );
  const identidades = obterIdentidadesHistoricas(periodo, atividade, quantidade);
  if (!identidades.length) return null;

  const obraId = texto(atividade?.obraId);
  if (quantidade === 1) {
    const correspondentes = registrosPatrimonio.filter((registro) =>
      identidades.includes(texto(registro.idItem))
    );
    if (correspondentes.length !== 1) return null;
    const patrimonio = obterPatrimonioHistoricoRegistro({
      registro: correspondentes[0],
      periodo,
      obraId,
    });
    return patrimonio ? [patrimonio] : null;
  }

  const patrimonios = identidades.map((identidade) => {
    const correspondentes = registrosPatrimonio.filter(
      (registro) => texto(registro.idItem) === identidade
    );
    if (correspondentes.length !== 1) return "";
    return obterPatrimonioHistoricoRegistro({
      registro: correspondentes[0],
      periodo,
      obraId,
    });
  });

  return valoresUnicosValidos(patrimonios);
};

export const enriquecerDetalhamentoPatrimonial = ({
  periodo,
  atividadesPorId,
  registrosPatrimonio = [],
}) => {
  if (periodo.usaContrapeso) {
    return [{ ...periodo, exibirPatrimonioDetalhe: false }];
  }

  const patrimonioDoPeriodo = texto(
    periodo.numeroPatrimonio || periodo.patrimonio
  );
  if (patrimonioDoPeriodo) {
    return [{
      ...periodo,
      patrimonioDetalhe: patrimonioDoPeriodo,
      exibirPatrimonioDetalhe: true,
    }];
  }

  const atividade = obterAtividadeHistorica(periodo, atividadesPorId);
  const patrimonioIdentificado = obterPatrimonioPorIdentidade(periodo, atividade);
  if (patrimonioIdentificado) {
    return [{
      ...periodo,
      patrimonioDetalhe: patrimonioIdentificado,
      exibirPatrimonioDetalhe: true,
    }];
  }

  const patrimoniosAtividade = obterListaHistoricaInequivoca(periodo, atividade);
  const patrimonios =
    patrimoniosAtividade ||
    obterListaPatrimoniosConferencia({
      periodo,
      atividade,
      registrosPatrimonio: Array.isArray(registrosPatrimonio)
        ? registrosPatrimonio
        : [],
    });
  if (!patrimonios) {
    return [{
      ...periodo,
      patrimonioDetalhe: "",
      exibirPatrimonioDetalhe: true,
    }];
  }

  if (patrimonios.length === 1) {
    return [{
      ...periodo,
      patrimonioDetalhe: patrimonios[0],
      exibirPatrimonioDetalhe: true,
    }];
  }

  return patrimonios.map((patrimonio, indice) => ({
    ...periodo,
    identidadeCanonica: `${periodo.identidadeCanonica}:patrimonio:${indice}`,
    patrimonioDetalhe: patrimonio,
    exibirPatrimonioDetalhe: true,
    quantidadeDetalhe: 1,
    valorMensal: dividirValor(periodo.valorMensal, patrimonios.length),
    valorProporcional: dividirValor(
      periodo.valorProporcional,
      patrimonios.length
    ),
  }));
};
