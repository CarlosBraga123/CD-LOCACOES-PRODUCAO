import {
  normalizarNumeroPatrimonio,
  obterIdItemPatrimonio,
  obterRegistrosPatrimonio,
} from "./patrimoniosEquipamentos";
import { obterUnidadesEquipamentosAtivos } from "./equipamentosAtivos";
import { obterObraDaAtividade } from "./obras";
import { atividadeIniciaLocacao } from "./locacaoFinanceira";
import { obterEquipamentosPatrimonio } from "./equipamentosPatrimonio";
import {
  compararOrdemTemporalAtividades,
  itemPossuiVinculoPatrimonial,
  obterIdentidadeUnidadeEntrada,
} from "./unidadesEquipamentos";

export { itemPossuiVinculoPatrimonial } from "./unidadesEquipamentos";

export const SERVICOS_COM_VINCULO_POSTERIOR = [
  "Instalação",
  "Somente aluguel",
  "Deslocamento",
  "Manutenção",
  "Remoção",
  "Somente recolhimento",
  "Ascensão",
];

const gerarIdItem = () =>
  globalThis.crypto?.randomUUID?.() ||
  `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const atividadePodeAlterarPatrimonio = (atividade) =>
  ["Balancinho", "Mini Grua"].includes(atividade?.equipamento);

export const atividadePermitePatrimonioPosterior = (atividade) =>
  atividadePodeAlterarPatrimonio(atividade) && Boolean(atividade?.servico);

export const permiteVinculoPatrimonioPosterior = (servico) =>
  Boolean(String(servico || "").trim());

export const criarItensProvisoriosVinculo = (atividade, quantidadeInformada) => {
  if (!atividadePodeAlterarPatrimonio(atividade)) return [];
  const atuais = Array.isArray(atividade.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];
  const quantidade = Math.max(
    1,
    Number(quantidadeInformada ?? atividade.quantidade) || 1
  );

  return Array.from({ length: quantidade }, (_, indice) => {
    const atual = atuais[indice] || {};
    return {
      ...atual,
      idItem: atual.idItem || gerarIdItem(),
      idEquipamento: atual.idEquipamento || "",
      numeroPatrimonio: atual.numeroPatrimonio || "",
      statusVinculoPatrimonio: itemPossuiVinculoPatrimonial(atual)
        ? "VINCULADO"
        : "PENDENTE",
      equipamento: atual.equipamento || atividade.equipamento,
      tipoBalancinho:
        atual.tipoBalancinho || atividade.tipoBalancinho || "",
      tipoMiniGrua: atual.tipoMiniGrua || atividade.tipoMiniGrua || "",
      tamanho: String(atual.tamanho ?? atividade.tamanho ?? ""),
      tamanhoAnterior: String(
        atual.tamanhoAnterior ?? atividade.tamanhoAnterior ?? atividade.tamanho ?? ""
      ),
      tamanhoNovo: String(
        atual.tamanhoNovo ?? atividade.tamanhoNovo ?? atividade.tamanho ?? ""
      ),
      ancoragem: atual.ancoragem || atividade.ancoragem || "",
      ancoragemAnterior:
        atual.ancoragemAnterior || atividade.ancoragemAnterior || atividade.ancoragem || "",
      usaContrapeso:
        atual.usaContrapeso !== undefined
          ? atual.usaContrapeso === true
          : atividade.usaContrapeso === true,
      usaContrapesoAnterior:
        atual.usaContrapesoAnterior !== undefined
          ? atual.usaContrapesoAnterior === true
          : atividade.usaContrapeso === true,
      alteracaoContrapeso:
        atual.alteracaoContrapeso || atividade.alteracaoContrapeso || "nenhuma",
    };
  });
};

const obterResumoVinculoPatrimonialOriginal = (atividade) => {
  if (!atividadePodeAlterarPatrimonio(atividade)) {
    return { total: 0, vinculados: 0, pendentes: 0, status: "NAO_APLICAVEL" };
  }
  const itens = Array.isArray(atividade.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];
  const total = itens.length || Math.max(1, Number(atividade.quantidade) || 1);
  const vinculados = itens.length
    ? itens.filter(itemPossuiVinculoPatrimonial).length
    : atividade.pendenteVinculoPatrimonio === true
      ? 0
      : Math.min(
          total,
          (atividade.numerosPatrimonio || []).filter(Boolean).length ||
            (atividade.numeroPatrimonio ? 1 : 0)
        );
  const pendentes = Math.max(0, total - vinculados);
  const status =
    pendentes === 0 ? "VINCULADO" : vinculados > 0 ? "PARCIAL" : "PENDENTE";
  return { total, vinculados, pendentes, status };
};

const obterIdentidadesUnidade = (atividade, item, indice) =>
  new Set(
    [
      item?.idItem,
      item?.idItemOrigem,
      item?.idUnidade,
      obterIdentidadeUnidadeEntrada(atividade, item, indice),
    ]
      .map((valor) => String(valor || "").trim())
      .filter(Boolean)
  );

const obterIdentidadesUnidadeAtiva = (unidade) =>
  new Set(
    [
      unidade?.idItem,
      unidade?.idItemOrigem,
      unidade?.idUnidade,
    ]
      .map((valor) => String(valor || "").trim())
      .filter(Boolean)
  );

const identidadesSeInterceptam = (identidadesA, identidadesB) =>
  [...identidadesA].some((identidade) => identidadesB.has(identidade));

const obterContextoPatrimonial = (contexto = {}) => ({
  registrosPatrimonio: Array.isArray(contexto.registrosPatrimonio)
    ? contexto.registrosPatrimonio
    : obterRegistrosPatrimonio(),
  equipamentosMestres: Array.isArray(contexto.equipamentosMestres)
    ? contexto.equipamentosMestres
    : obterEquipamentosPatrimonio(),
});

const montarUnidadesDaPendencia = (atividade, registrosPatrimonio) => {
  const itens = Array.isArray(atividade?.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];
  const quantidade = itens.length || Math.max(1, Number(atividade?.quantidade) || 1);

  return Array.from({ length: quantidade }, (_, indice) => {
    const item = itens[indice] || {};
    const identidades = obterIdentidadesUnidade(atividade, item, indice);
    const registro = registrosPatrimonio.find((candidato) =>
      identidades.has(String(candidato?.idItem || "").trim())
    );
    const patrimonioAdministrativo = normalizarNumeroPatrimonio(
      registro?.numeroPatrimonioAtual
    );
    const patrimonioLegado = normalizarNumeroPatrimonio(
      atividade?.numerosPatrimonio?.[indice] ||
        (indice === 0 ? atividade?.numeroPatrimonio : "")
    );
    const vinculoOriginal = itens.length
      ? itemPossuiVinculoPatrimonial(item)
      : Boolean(patrimonioLegado) && atividade?.pendenteVinculoPatrimonio !== true;

    return {
      identidades,
      vinculado: vinculoOriginal || Boolean(patrimonioAdministrativo),
    };
  });
};

export const obterResumoVinculoPatrimonial = (atividade, contexto = {}) => {
  if (!atividadePodeAlterarPatrimonio(atividade)) {
    return { total: 0, vinculados: 0, pendentes: 0, status: "NAO_APLICAVEL" };
  }
  const { registrosPatrimonio, equipamentosMestres } =
    obterContextoPatrimonial(contexto);
  let unidades = montarUnidadesDaPendencia(atividade, registrosPatrimonio);

  if (
    atividadeIniciaLocacao(atividade) &&
    Array.isArray(contexto.atividades) &&
    Array.isArray(contexto.obras)
  ) {
    const obra = obterObraDaAtividade(atividade, contexto.obras);
    if (obra) {
      const unidadesAtivas = obterUnidadesEquipamentosAtivos(
        obra,
        contexto.atividades,
        registrosPatrimonio,
        equipamentosMestres
      ).map((unidade) => obterIdentidadesUnidadeAtiva(unidade));
      unidades = unidades.filter(({ identidades }) =>
        unidadesAtivas.some((identidadesAtivas) =>
          identidadesSeInterceptam(identidades, identidadesAtivas)
        )
      );
    }
  }

  const total = unidades.length;
  const vinculados = unidades.filter((unidade) => unidade.vinculado).length;
  const pendentes = Math.max(0, total - vinculados);
  const status =
    total === 0 || pendentes === 0
      ? "VINCULADO"
      : vinculados > 0
        ? "PARCIAL"
        : "PENDENTE";
  return { total, vinculados, pendentes, status };
};

export const obterStatusVinculoPatrimonial = (atividade, contexto) =>
  obterResumoVinculoPatrimonial(atividade, contexto).status;

export const obterQuantidadeVinculosPendentes = (atividade, contexto) =>
  obterResumoVinculoPatrimonial(atividade, contexto).pendentes;

const atividadeMarcadaComoPendente = (atividade) =>
  obterResumoVinculoPatrimonialOriginal(atividade).pendentes > 0 &&
  (atividade?.pendenteVinculoPatrimonio === true ||
    ["PENDENTE", "PARCIAL"].includes(atividade?.statusVinculoPatrimonio));

const servicoPermitePendenciaDeIdentidade = (servico) =>
  ["Deslocamento", "Manutenção", "Remoção", "Somente recolhimento"].includes(
    servico
  );

export const obterAtividadesAnterioresAoVinculo = (atividades = [], atividade) => {
  const dataReferencia = atividade?.dataLiberacao || atividade?.dataAgendamento || "";
  return atividades.filter((item) => {
    if (String(item.id) === String(atividade?.id)) return false;
    const dataItem = item.dataLiberacao || item.dataAgendamento || "";
    if (!dataItem || !dataReferencia) return false;
    return compararOrdemTemporalAtividades(item, atividade) < 0;
  });
};

const obterIdentidadesIndividuais = (unidade) =>
  [
    unidade?.idEquipamento,
    unidade?.idItemOrigem,
    unidade?.idUnidade,
    unidade?.idItem,
  ]
    .map((valor) => String(valor || "").trim())
    .filter(Boolean);

export const unidadePossuiVinculoPosteriorReal = (unidade) => {
  const identidades = obterIdentidadesIndividuais(unidade);
  const possuiIdentidadeReal = identidades.some(
    (identidade) => !identidade.startsWith("legado:")
  );
  const possuiReferenciaIndividual = Boolean(
    String(
      unidade?.numeroPatrimonio ||
        unidade?.numeroPatrimonioAtual ||
        unidade?.idEquipamento ||
        ""
    ).trim()
  );
  return possuiIdentidadeReal && possuiReferenciaIndividual;
};

export const obterCandidatosVinculoPatrimonial = ({
  atividade,
  atividades = [],
  obras = [],
  registrosPatrimonio,
  equipamentosMestres,
} = {}) => {
  if (!atividade || !servicoPermitePendenciaDeIdentidade(atividade.servico)) return [];
  const obra = obterObraDaAtividade(atividade, obras);
  if (!obra) return [];
  const anteriores = obterAtividadesAnterioresAoVinculo(atividades, atividade);
  return obterUnidadesEquipamentosAtivos(
    obra,
    anteriores,
    registrosPatrimonio,
    equipamentosMestres
  ).filter(
    (unidade) =>
      equipamentoCompativelComAtividade(unidade, atividade) &&
      unidadePossuiVinculoPosteriorReal(unidade)
  );
};

export const atividadeTemPatrimonioPendente = (atividade, contexto) => {
  if (!atividadeMarcadaComoPendente(atividade)) return false;
  if (obterResumoVinculoPatrimonial(atividade, contexto).pendentes === 0) {
    return false;
  }
  if (!servicoPermitePendenciaDeIdentidade(atividade?.servico)) return true;
  if (!contexto) return true;
  return obterCandidatosVinculoPatrimonial({ atividade, ...contexto }).length > 0;
};

export const obterPendenciasOperacionais = (atividades = [], contexto = {}) =>
  atividades.filter((atividade) =>
    atividadeTemPatrimonioPendente(atividade, { atividades, ...contexto })
  ).map((atividade) => ({
    id: `patrimonio:${atividade.id}`,
    tipo: "PATRIMONIO_PENDENTE_VINCULO",
    titulo: "Patrimônio pendente de vínculo",
    atividadeId: atividade.id,
    atividade,
    resumo: obterResumoVinculoPatrimonial(atividade, {
      atividades,
      ...contexto,
    }),
  }));

export const equipamentoCompativelComAtividade = (unidade, atividade) => {
  if (unidade?.equipamento !== atividade?.equipamento) return false;
  if (atividade.equipamento === "Balancinho") {
    return (
      (unidade.tipoBalancinho || "Eletrico") ===
      (atividade.tipoBalancinho || "Eletrico")
    );
  }
  if (atividade.equipamento === "Mini Grua") {
    return String(unidade.tipoMiniGrua || "") === String(atividade.tipoMiniGrua || "");
  }
  return true;
};

export const criarItemVinculadoDaPendencia = (atividade, unidade, itemPendente = {}) => ({
  ...itemPendente,
  idItem: itemPendente.idItem || gerarIdItem(),
  idItemOrigem: unidade.idUnidade || unidade.idItemOrigem || itemPendente.idItemOrigem,
  idEquipamento: unidade.idEquipamento || "",
  atividadeOrigemId: unidade.atividadeOrigemId || itemPendente.atividadeOrigemId,
  equipamento: unidade.equipamento || atividade.equipamento,
  tipoBalancinho: unidade.tipoBalancinho || itemPendente.tipoBalancinho || "",
  tipoMiniGrua: unidade.tipoMiniGrua || itemPendente.tipoMiniGrua || "",
  numeroPatrimonio: unidade.numeroPatrimonio || unidade.numeroPatrimonioAtual || "",
  tamanho: itemPendente.tamanho || unidade.tamanho || atividade.tamanho || "",
  tamanhoAnterior: unidade.tamanho || itemPendente.tamanhoAnterior || "",
  tamanhoNovo:
    atividade.servico === "Deslocamento"
      ? String(itemPendente.tamanhoNovo || atividade.tamanhoNovo || atividade.tamanho || unidade.tamanho || "")
      : itemPendente.tamanhoNovo || unidade.tamanho || "",
  ancoragem:
    atividade.servico === "Deslocamento"
      ? itemPendente.ancoragem || atividade.ancoragem || unidade.ancoragem || ""
      : itemPendente.ancoragem || unidade.ancoragem || "",
  ancoragemAnterior: unidade.ancoragem || itemPendente.ancoragemAnterior || "",
  alteracaoContrapeso:
    itemPendente.alteracaoContrapeso || atividade.alteracaoContrapeso || "nenhuma",
  usaContrapesoAnterior: unidade.usaContrapeso === true,
  usaContrapeso:
    (itemPendente.alteracaoContrapeso || atividade.alteracaoContrapeso) === "adicionar"
      ? true
      : (itemPendente.alteracaoContrapeso || atividade.alteracaoContrapeso) === "remover"
        ? false
        : unidade.usaContrapeso === true || itemPendente.usaContrapeso === true,
  statusVinculoPatrimonio: "VINCULADO",
});

export const aplicarVinculoPatrimonialPosterior = ({
  atividades,
  atividadeId,
  idItem,
  unidade,
  usuario = "",
  data = new Date().toISOString(),
}) => {
  const atividade = atividades.find((item) => String(item.id) === String(atividadeId));
  if (!atividade || !atividadeTemPatrimonioPendente(atividade)) {
    throw new Error("A pendência não está mais disponível.");
  }
  if (!equipamentoCompativelComAtividade(unidade, atividade)) {
    throw new Error("O equipamento selecionado não é compatível.");
  }
  if (!unidadePossuiVinculoPosteriorReal(unidade) || !obterIdItemPatrimonio(unidade)) {
    throw new Error("O equipamento não possui vínculo patrimonial válido.");
  }

  const itensAtuais = criarItensProvisoriosVinculo(atividade);
  const indicePendente = idItem
    ? itensAtuais.findIndex((item) => String(item.idItem) === String(idItem))
    : itensAtuais.findIndex((item) => !itemPossuiVinculoPatrimonial(item));
  if (indicePendente < 0) throw new Error("Nenhuma unidade pendente foi localizada.");
  const itensEquipamentos = itensAtuais.map((item, indice) =>
    indice === indicePendente
      ? criarItemVinculadoDaPendencia(atividade, unidade, item)
      : item
  );
  const resumo = obterResumoVinculoPatrimonial({ ...atividade, itensEquipamentos });

  return atividades.map((registro) =>
    String(registro.id) === String(atividadeId)
      ? {
          ...registro,
          itensEquipamentos,
          quantidade: itensEquipamentos.length,
          numerosPatrimonio: itensEquipamentos.map((item) => item.numeroPatrimonio || ""),
          numeroPatrimonio: itensEquipamentos[0]?.numeroPatrimonio || "",
          pendenteVinculoPatrimonio: resumo.pendentes > 0,
          statusVinculoPatrimonio: resumo.status,
          ...(registro.saidaPatrimonialProvisoria !== undefined
            ? { saidaPatrimonialProvisoria: resumo.pendentes > 0 }
            : {}),
          dataVinculoPatrimonio: data,
          usuarioVinculoPatrimonio: usuario,
        }
      : registro
  );
};

export const vincularPatrimonioPendente = aplicarVinculoPatrimonialPosterior;
