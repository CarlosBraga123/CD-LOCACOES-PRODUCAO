// Atividades.jsx - Versão corrigida sem erro de fechamento de JSX
import { useEffect, useState, useRef, useMemo } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { obterChaveObra, obterObraDaAtividade, normalizarTexto } from "../utils/obras";
import { obterOperacoes, obterRegraOperacao } from "../utils/regrasOperacao";
import OrdemServico from "./OrdemServico";
import Contrato from "./documentos/Contrato";
import { obterTipoContrato } from "../utils/contrato";
import { gerarProximoNumeroOS } from "../utils/ordemServico";
import { normalizarAlteracaoContrapeso, obterQuantidadeContrapeso } from "../utils/locacaoFinanceira";
import { obterUnidadesEquipamentosAtivos } from "../utils/equipamentosAtivos";

const filtrosListaIniciais = {
  busca: "",
  construtora: "",
  obraId: "",
  dataInicial: "",
  dataFinal: "",
  equipamento: "",
  servico: "",
  status: "todas",
};

const normalizarBusca = (valor) =>
  normalizarTexto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const obterQuantidadePatrimonio = (quantidade) => Math.max(1, Number(quantidade) || 1);

const ajustarNumerosPatrimonio = (numerosPatrimonio, quantidade) => {
  const quantidadeFinal = obterQuantidadePatrimonio(quantidade);
  const valores = Array.isArray(numerosPatrimonio) ? numerosPatrimonio : [];
  return Array.from({ length: quantidadeFinal }, (_, indice) => valores[indice] ?? "");
};

const normalizarNumerosPatrimonio = (numerosPatrimonio, quantidade) =>
  ajustarNumerosPatrimonio(numerosPatrimonio, quantidade).map((valor) => String(valor ?? "").trim());

const converterValorParaNumero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor).trim();
  if (!texto) return 0;

  const limpo = texto.replace(/[^\d,.-]/g, "");
  const valorNormalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(\.\d{3})+$/.test(limpo)
      ? limpo.replace(/\./g, "")
      : limpo;
  const numero = Number(valorNormalizado);

  return Number.isFinite(numero) ? numero : 0;
};

const servicoPermiteAlteracaoContrapeso = (servico) =>
  ["Deslocamento", "Remoção", "Somente recolhimento"].includes(servico);

const servicoEntradaLocacaoInicial = (servico) => ["Instalação", "Somente aluguel"].includes(servico);

const obterQuantidadeContrapesoFormulario = (valor, quantidadePadrao = 1) => {
  const quantidade = Number(valor);
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    return Math.max(1, Number(quantidadePadrao) || 1);
  }
  return quantidade;
};

const gerarIdItemEquipamento = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const permiteItensEquipamentos = (equipamento, servico) =>
  (equipamento === "Balancinho" &&
    ["Instalação", "Somente aluguel"].includes(servico)) ||
  (equipamento === "Mini Grua" && servico === "Instalação");

const servicoSelecionaUnidadesAtivas = (servico) =>
  [
    "Manutenção",
    "Deslocamento",
    "Remoção",
    "Somente recolhimento",
    "Ascensão",
  ].includes(servico);

const criarItemEquipamentoDosCamposLegados = (atividade, indice = 0) => ({
  idItem: gerarIdItemEquipamento(),
  equipamento: atividade.equipamento,
  ...(atividade.equipamento === "Balancinho"
    ? {
        tipoBalancinho: atividade.tipoBalancinho || "Eletrico",
        tamanho: String(atividade.tamanho ?? ""),
        ancoragem: atividade.ancoragem || "",
        usaContrapeso: Boolean(atividade.usaContrapeso),
      }
    : {
        tipoMiniGrua: atividade.tipoMiniGrua || "500kg",
      }),
  numeroPatrimonio: String(
    atividade.numerosPatrimonio?.[indice] ?? ""
  ),
});

const ajustarItensEquipamentos = (atividade, quantidade) => {
  const quantidadeFinal = obterQuantidadePatrimonio(quantidade);
  const itensAtuais = Array.isArray(atividade.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];

  return Array.from({ length: quantidadeFinal }, (_, indice) =>
    itensAtuais[indice]
      ? { ...itensAtuais[indice] }
      : criarItemEquipamentoDosCamposLegados(atividade, indice)
  );
};

const criarItemMovimentacao = (unidade) => ({
  idItem: gerarIdItemEquipamento(),
  idItemOrigem: unidade.idUnidade,
  atividadeOrigemId: unidade.atividadeOrigemId,
  equipamento: unidade.equipamento,
  tipoBalancinho: unidade.tipoBalancinho || "",
  tipoMiniGrua: unidade.tipoMiniGrua || "",
  numeroPatrimonio: unidade.numeroPatrimonio || "",
  tamanho: unidade.tamanho || "",
  tamanhoAnterior: unidade.tamanho || "",
  tamanhoNovo: unidade.tamanho || "",
  ancoragem: unidade.ancoragem || "",
  ancoragemAnterior: unidade.ancoragem || "",
  alteracaoContrapeso: "nenhuma",
  usaContrapesoAnterior: unidade.usaContrapeso === true,
  usaContrapeso: unidade.usaContrapeso === true,
});

export default function Atividades({ contextoNavegacao, limparContextoNavegacao }) {
  const topoRef = useRef(null);
  const atividadeRefs = useRef({});
  const filtrosAntesLocalizacaoRef = useRef(null);
  const contextoConsumidoRef = useRef(false);
  const [construtoras, setConstrutoras] = useState([]);
  const [obras, setObras] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [mostrarMateriaisId, setMostrarMateriaisId] = useState(null);
  const [filtrosLista, setFiltrosLista] = useState(filtrosListaIniciais);
  const [documentosAbertoId, setDocumentosAbertoId] = useState(null);
  const [atividadeOrdemServico, setAtividadeOrdemServico] = useState(null);
  const [atividadeContrato, setAtividadeContrato] = useState(null);
  const [atividadeParaLocalizarId, setAtividadeParaLocalizarId] = useState(null);
  const [atividadeDestacadaId, setAtividadeDestacadaId] = useState(null);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const camposValor = [
    "valorUnitarioServico",
    "adicionalServicoContrapeso",
    "valorTotalServico",
    "valorMensalLocacao",
    "adicionalMensalContrapeso",
    "valorTotalMensalLocacao",
  ];
  const camposValorLimpos = camposValor.reduce((acc, campo) => ({ ...acc, [campo]: false }), {});
  const [valoresEditadosManual, setValoresEditadosManual] = useState(camposValorLimpos);

  const [form, setForm] = useState({
    id: null,
    construtora: "",
    obra: "",
    obraId: "",
    equipamento: "",
    servico: "",
    tamanho: "",
    tamanhoAnterior: "",
    tamanhoNovo: "",
    ancoragem: "",
    tipoBalancinho: "Eletrico",
    usaContrapeso: false,
    alteracaoContrapeso: "nenhuma",
    quantidadeContrapeso: 1,
    tipoMiniGrua: "500kg",
    quantidade: 1,
    numerosPatrimonio: [""],
    dataAgendamento: "",
    dataLiberacao: "",
    equipeResponsavel: "",
    observacoes: "",
    valorUnitarioServico: "",
    adicionalServicoContrapeso: "",
    valorTotalServico: "",
    valorMensalLocacao: "",
    adicionalMensalContrapeso: "",
    valorTotalMensalLocacao: "",
  });

  useEffect(() => {
    const dadosSalvos = JSON.parse(localStorage.getItem("atividades")) || [];
    setAtividades(dadosSalvos);

    const construtorasSalvas = JSON.parse(localStorage.getItem("construtoras")) || [];
    setConstrutoras(construtorasSalvas);

    const obrasSalvas = JSON.parse(localStorage.getItem("obras")) || [];
    setObras(obrasSalvas);
    setDadosCarregados(true);

    const atividadeParaLocalizar = localStorage.getItem("atividadeParaLocalizar");
    if (atividadeParaLocalizar) {
      setAtividadeParaLocalizarId(atividadeParaLocalizar);
      localStorage.removeItem("atividadeParaLocalizar");
      localStorage.removeItem("atividadeParaEditar");
    } else {
      const atividadeParaEditar = localStorage.getItem("atividadeParaEditar");
      if (atividadeParaEditar) {
        const encontrada = dadosSalvos.find((a) => String(a.id) === atividadeParaEditar);
        if (encontrada) {
          const atividadeComValores = aplicarValoresCongeladosNoFormulario(encontrada);
          const quantidadeEdicao = Array.isArray(
            atividadeComValores.itensEquipamentos
          )
            ? atividadeComValores.itensEquipamentos.length
            : atividadeComValores.quantidade || 1;
          setValoresEditadosManual(marcarCamposValorPreenchidos(atividadeComValores));
          setForm({
            ...atividadeComValores,
            ...(Array.isArray(atividadeComValores.itensEquipamentos)
              ? {
                  itensEquipamentos: atividadeComValores.itensEquipamentos.map(
                    (item) => ({ ...item })
                  ),
                }
              : {}),
            quantidade: quantidadeEdicao,
            numerosPatrimonio: ajustarNumerosPatrimonio(
              atividadeComValores.numerosPatrimonio || [],
              quantidadeEdicao
            ),
            tipoBalancinho: atividadeComValores.tipoBalancinho || "",
            usaContrapeso: atividadeComValores.usaContrapeso || false,
            alteracaoContrapeso: normalizarAlteracaoContrapeso(atividadeComValores),
            quantidadeContrapeso: atividadeComValores.quantidadeContrapeso || 1,
            tipoMiniGrua: atividadeComValores.tipoMiniGrua || "",
          });
          setTimeout(() => {
            topoRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 50);
        }
        localStorage.removeItem("atividadeParaEditar");
      }
    }
  }, []);

  useEffect(() => {
    if (
      !dadosCarregados ||
      contextoConsumidoRef.current ||
      contextoNavegacao?.destino !== "atividades"
    ) {
      return;
    }

    if (contextoNavegacao.acao === "localizar-atividade") {
      contextoConsumidoRef.current = true;
      setAtividadeParaLocalizarId(contextoNavegacao.atividadeId || null);
      limparContextoNavegacao?.();
      return;
    }

    if (
      contextoNavegacao.origem !== "construtoras-obras" ||
      contextoNavegacao.acao !== "nova-atividade"
    ) {
      return;
    }

    const obraId = contextoNavegacao.obraId;
    let obra = obraId
      ? obras.find((item) => String(item.id) === String(obraId)) || null
      : null;

    if (!obra && !obraId && contextoNavegacao.obraNome) {
      obra =
        obras.find(
          (item) =>
            normalizarTexto(item.nome) === normalizarTexto(contextoNavegacao.obraNome) &&
            (!contextoNavegacao.construtoraNome ||
              normalizarTexto(item.construtora) ===
                normalizarTexto(contextoNavegacao.construtoraNome))
        ) || null;
    }

    const construtora =
      (obra?.construtoraId &&
        construtoras.find(
          (item) => String(item.id) === String(obra.construtoraId)
        )) ||
      construtoras.find(
        (item) =>
          normalizarTexto(item.nome) ===
          normalizarTexto(obra?.construtora || contextoNavegacao.construtoraNome)
      ) ||
      (!obra &&
        contextoNavegacao.construtoraId &&
        construtoras.find(
          (item) => String(item.id) === String(contextoNavegacao.construtoraId)
        )) ||
      null;

    contextoConsumidoRef.current = true;

    if (obra) {
      setForm((formularioAtual) => ({
        ...formularioAtual,
        construtora: construtora?.nome || obra.construtora || contextoNavegacao.construtoraNome || "",
        obra: obra.nome || contextoNavegacao.obraNome || "",
        obraId: obra.id || "",
      }));

      requestAnimationFrame(() => {
        topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    limparContextoNavegacao?.();
  }, [
    contextoNavegacao,
    construtoras,
    dadosCarregados,
    limparContextoNavegacao,
    obras,
  ]);

  const obterRegrasOperacionais = (servico, equipamento = form.equipamento) => {
    const regra = obterRegraOperacao(equipamento, servico);

    if (!regra) {
      return {
        cobraServico: true,
        iniciaLocacao: false,
        encerraLocacao: false,
      };
    }

    return {
      cobraServico: regra.cobraServico,
      iniciaLocacao: regra.iniciaLocacao,
      encerraLocacao: regra.encerraLocacao,
    };
  };

  const obterServicosPermitidos = (equipamento) => {
    return obterOperacoes(equipamento).map((operacao) => operacao.nome);
  };

  const obterServicoValidoParaEquipamento = (equipamento, servico) => {
    if (!servico) return "";
    return obterRegraOperacao(equipamento, servico) ? servico : "";
  };

  const obterRegraOperacionalSegura = (equipamento, servico) => {
    const regra = obterRegraOperacao(equipamento, servico);

    if (!regra) {
      return {
        cobraServico: true,
        iniciaLocacao: false,
        encerraLocacao: false,
      };
    }

    return {
      cobraServico: regra.cobraServico,
      iniciaLocacao: regra.iniciaLocacao,
      encerraLocacao: regra.encerraLocacao,
    };
  };

  const obterTabelaComercialDaObra = () => {
    const obraSelecionada = obterObraDaAtividade(form, obras);
    const construtoraSelecionada = construtoras.find((c) => c.nome === form.construtora);
    const tabelaPadrao = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null") || {
      servicos: {},
      locacoes: {},
    };

    return obraSelecionada?.tabelaComercial || construtoraSelecionada?.tabelaComercial || tabelaPadrao;
  };

  const obterTabelaOrigemDaAtividade = (atividade) => {
    const obraSelecionada = obterObraDaAtividade(atividade, obras);
    const construtoraSelecionada = construtoras.find((c) => c.nome === atividade.construtora);

    if (obraSelecionada?.tabelaComercial) return "obra";
    if (construtoraSelecionada?.tabelaComercial) return "construtora";
    return "padrao";
  };

  const obterChaveServico = () => {
    if (form.equipamento === "Balancinho") {
      const tipo = form.tipoBalancinho === "Manual" ? "Manual" : "Eletrico";
      return `Balancinho-${tipo}-${form.servico}`;
    }

    if (form.equipamento === "Mini Grua") {
      const tipo = form.tipoMiniGrua || "500kg";
      return `Mini Grua-${tipo}-${form.servico}`;
    }

    return `${form.equipamento}-${form.servico}`;
  };

  const obterChaveLocacao = () => {
    if (form.equipamento === "Balancinho") {
      const tipo = form.tipoBalancinho === "Manual" ? "Manual" : "Eletrico";
      return `Balancinho-${tipo}`;
    }

    if (form.equipamento === "Mini Grua") {
      const tipo = form.tipoMiniGrua || "500kg";
      return `Mini Grua-${tipo}`;
    }

    return form.equipamento;
  };

  const obterFallbackServicoAntigo = () => {
    try {
      const valoresServicos = JSON.parse(localStorage.getItem("valoresServicos") || "{}");
      const valoresPadrao = JSON.parse(localStorage.getItem("valoresPadrao") || "{}");
      const chaveAntiga = `${form.equipamento}-${form.servico}`;

      if (valoresServicos[chaveAntiga] !== undefined) return Number(valoresServicos[chaveAntiga] || 0);
      if (valoresPadrao[chaveAntiga] !== undefined) return Number(valoresPadrao[chaveAntiga] || 0);
    } catch {
      console.warn("Erro ao ler fallback antigo de valores");
    }

    return 0;
  };

  const obterPrecoServicoDaTabela = (tabela) => {
    const chaveServico = obterChaveServico();
    if (tabela.servicos?.[chaveServico] !== undefined) {
      return Number(tabela.servicos[chaveServico] || 0);
    }

    return obterFallbackServicoAntigo();
  };

  const obterPrecoAdicionalContrapesoServico = (tabela) => {
    const chaveContrapeso = `Balancinho-Contrapeso-${form.servico}`;
    if (tabela.servicos?.[chaveContrapeso] !== undefined) {
      return Number(tabela.servicos[chaveContrapeso] || 0);
    }

    return 0;
  };

  const obterPrecoLocacaoDaTabela = (tabela) => {
    const chaveLocacao = obterChaveLocacao();
    if (tabela.locacoes?.[chaveLocacao] !== undefined) {
      return Number(tabela.locacoes[chaveLocacao] || 0);
    }

    return 0;
  };

  const obterPrecoAdicionalContrapesoLocacao = (tabela) => {
    if (tabela.locacoes?.["Balancinho-Contrapeso"] !== undefined) {
      return Number(tabela.locacoes["Balancinho-Contrapeso"] || 0);
    }

    return 0;
  };

  const atualizarCampoValor = (campo, valor) => {
    setValoresEditadosManual((atuais) => ({
      ...atuais,
      [campo]: true,
      ...(campo === "valorUnitarioServico" || campo === "adicionalServicoContrapeso"
        ? { valorTotalServico: false }
        : {}),
      ...(campo === "valorMensalLocacao" || campo === "adicionalMensalContrapeso"
        ? { valorTotalMensalLocacao: false }
        : {}),
    }));
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarQuantidade = (valor) => {
    const novaQuantidade = obterQuantidadePatrimonio(valor);
    const quantidadeAtual = obterQuantidadePatrimonio(form.quantidade);
    const patrimoniosAtuais = Array.isArray(form.itensEquipamentos)
      ? form.itensEquipamentos.map((item) => item.numeroPatrimonio || "")
      : form.numerosPatrimonio || [];

    if (novaQuantidade < quantidadeAtual && patrimoniosAtuais.length > novaQuantidade) {
      const excedentes = patrimoniosAtuais.slice(novaQuantidade).filter((item) => String(item || "").trim());
      const mensagem = excedentes.length
        ? "A nova quantidade remove números de patrimônio já preenchidos. Deseja continuar?"
        : "A nova quantidade removerá campos de patrimônio excedentes. Deseja continuar?";

      if (!window.confirm(mensagem)) return;
    }

    setForm((atual) => ({
      ...atual,
      quantidade: valor,
      numerosPatrimonio: ajustarNumerosPatrimonio(atual.numerosPatrimonio || [], novaQuantidade),
      ...((Array.isArray(atual.itensEquipamentos) ||
        (novaQuantidade > 1 &&
          permiteItensEquipamentos(atual.equipamento, atual.servico)))
        ? { itensEquipamentos: ajustarItensEquipamentos(atual, novaQuantidade) }
        : {}),
    }));
    setValoresEditadosManual((atuais) => ({
      ...atuais,
      valorTotalServico: false,
      valorTotalMensalLocacao: false,
    }));
  };

  const atualizarNumeroPatrimonio = (indice, valor) => {
    setForm((atual) => {
      const numerosPatrimonio = ajustarNumerosPatrimonio(
        atual.numerosPatrimonio || [],
        atual.quantidade || 1
      );
      numerosPatrimonio[indice] = valor;
      return { ...atual, numerosPatrimonio };
    });
  };

  const atualizarItemEquipamento = (idItem, campo, valor) => {
    setForm((atual) => {
      if (!Array.isArray(atual.itensEquipamentos)) return atual;

      const itensEquipamentos = atual.itensEquipamentos.map((item) => {
        if (item.idItem !== idItem) return { ...item };

        if (campo === "alteracaoContrapeso") {
          return {
            ...item,
            alteracaoContrapeso: valor,
            usaContrapeso:
              valor === "adicionar"
                ? true
                : valor === "remover"
                  ? false
                  : item.usaContrapesoAnterior === true,
          };
        }

        return { ...item, [campo]: valor };
      });
      const atualizacoesLegadas = {};

      if (campo === "tipoBalancinho") {
        atualizacoesLegadas.tipoBalancinho = valor;
        itensEquipamentos.forEach((item) => {
          item.tipoBalancinho = valor;
        });
      }

      if (campo === "tipoMiniGrua") {
        atualizacoesLegadas.tipoMiniGrua = valor;
        itensEquipamentos.forEach((item) => {
          item.tipoMiniGrua = valor;
        });
      }

      if (campo === "usaContrapeso") {
        atualizacoesLegadas.usaContrapeso = itensEquipamentos.some(
          (item) => item.usaContrapeso === true
        );
      }

      return {
        ...atual,
        ...(servicoSelecionaUnidadesAtivas(atual.servico)
          ? sincronizarCamposMovimentacao(itensEquipamentos)
          : atualizacoesLegadas),
        itensEquipamentos,
      };
    });
  };

  const sincronizarCamposMovimentacao = (itensEquipamentos) => {
    const primeiroItem = itensEquipamentos[0] || {};
    const quantidadeAdicionada = itensEquipamentos.filter(
      (item) =>
        String(item.alteracaoContrapeso || "nenhuma").toLowerCase() ===
        "adicionar"
    ).length;
    const quantidadeRemovida = itensEquipamentos.filter(
      (item) =>
        String(item.alteracaoContrapeso || "nenhuma").toLowerCase() ===
        "remover"
    ).length;
    const saldoContrapeso = quantidadeAdicionada - quantidadeRemovida;
    const alteracaoContrapeso =
      saldoContrapeso > 0
        ? "adicionar"
        : saldoContrapeso < 0
          ? "remover"
          : "nenhuma";

    return {
      quantidade: itensEquipamentos.length,
      numerosPatrimonio: itensEquipamentos.map(
        (item) => item.numeroPatrimonio || ""
      ),
      tipoBalancinho: primeiroItem.tipoBalancinho || "",
      tipoMiniGrua: primeiroItem.tipoMiniGrua || "",
      tamanho: primeiroItem.tamanho || "",
      tamanhoAnterior:
        primeiroItem.tamanhoAnterior || primeiroItem.tamanho || "",
      tamanhoNovo: primeiroItem.tamanhoNovo || primeiroItem.tamanho || "",
      ancoragem: primeiroItem.ancoragem || "",
      alteracaoContrapeso,
      quantidadeContrapeso: Math.abs(saldoContrapeso),
      usaContrapeso: itensEquipamentos.some(
        (item) => item.usaContrapeso === true
      ),
    };
  };

  const alternarSelecaoUnidadeAtiva = (unidade) => {
    setForm((atual) => {
      const itensAtuais = Array.isArray(atual.itensEquipamentos)
        ? atual.itensEquipamentos
        : [];
      const selecionada = itensAtuais.some(
        (item) => item.idItemOrigem === unidade.idUnidade
      );
      const itensEquipamentos = selecionada
        ? itensAtuais
            .filter((item) => item.idItemOrigem !== unidade.idUnidade)
            .map((item) => ({ ...item }))
        : [
            ...itensAtuais.map((item) => ({ ...item })),
            {
              ...criarItemMovimentacao(unidade),
              ...(["Remoção", "Somente recolhimento"].includes(atual.servico) &&
              unidade.usaContrapeso
                ? { alteracaoContrapeso: "remover" }
                : {}),
            },
          ];

      return {
        ...atual,
        ...sincronizarCamposMovimentacao(itensEquipamentos),
        itensEquipamentos,
      };
    });
    setValoresEditadosManual((atuais) => ({
      ...atuais,
      valorTotalServico: false,
      valorTotalMensalLocacao: false,
    }));
  };

  const marcarCamposValorPreenchidos = (atividade) => {
    return camposValor.reduce((acc, campo) => {
      acc[campo] = atividade[campo] !== undefined && atividade[campo] !== "";
      return acc;
    }, {});
  };

  useEffect(() => {
    if (!form.equipamento || !form.servico || !form.obra) return;

    const regras = obterRegrasOperacionais(form.servico);
    const tabela = obterTabelaComercialDaObra();
    const quantidade = Number(form.quantidade) || 1;
    const quantidadeContrapeso = obterQuantidadeContrapesoFormulario(form.quantidadeContrapeso, quantidade);
    const entradaContrapesoAvulsa =
      form.equipamento === "Balancinho" && normalizarAlteracaoContrapeso(form) === "adicionar";
    const usandoValoresCongelados = Boolean(form.dataLiberacao && form.valoresCongelados);
    const valorUnitarioServico = regras.cobraServico
      ? obterPrecoServicoDaTabela(tabela)
      : "";
    const adicionalServicoContrapeso =
      regras.cobraServico && form.equipamento === "Balancinho" && form.usaContrapeso
        ? obterPrecoAdicionalContrapesoServico(tabela)
        : 0;
    const valorMensalLocacao = regras.iniciaLocacao
      ? obterPrecoLocacaoDaTabela(tabela)
      : "";
    const adicionalMensalContrapeso =
      form.equipamento === "Balancinho" && (regras.iniciaLocacao && form.usaContrapeso || entradaContrapesoAvulsa)
        ? obterPrecoAdicionalContrapesoLocacao(tabela)
        : 0;

    setForm((atual) => {
      const unitarioServicoFinal = usandoValoresCongelados || valoresEditadosManual.valorUnitarioServico
        ? atual.valorUnitarioServico
        : valorUnitarioServico;
      const adicionalServicoFinal = form.usaContrapeso
        ? usandoValoresCongelados || valoresEditadosManual.adicionalServicoContrapeso
          ? atual.adicionalServicoContrapeso
          : adicionalServicoContrapeso
        : 0;
      const totalServicoCalculado = regras.cobraServico
        ? (converterValorParaNumero(unitarioServicoFinal) + converterValorParaNumero(adicionalServicoFinal)) *
          quantidade
        : "";
      const mensalLocacaoFinal = usandoValoresCongelados || valoresEditadosManual.valorMensalLocacao
        ? atual.valorMensalLocacao
        : valorMensalLocacao;
      const adicionalLocacaoFinal = form.usaContrapeso || entradaContrapesoAvulsa
        ? usandoValoresCongelados || valoresEditadosManual.adicionalMensalContrapeso
          ? atual.adicionalMensalContrapeso
          : adicionalMensalContrapeso
        : 0;
      const totalLocacaoCalculado = regras.iniciaLocacao || entradaContrapesoAvulsa
        ? regras.iniciaLocacao
          ? (converterValorParaNumero(mensalLocacaoFinal) + converterValorParaNumero(adicionalLocacaoFinal)) *
            quantidade
          : converterValorParaNumero(adicionalLocacaoFinal) * quantidadeContrapeso
        : "";

      return {
        ...atual,
        valorUnitarioServico: usandoValoresCongelados || valoresEditadosManual.valorUnitarioServico
          ? atual.valorUnitarioServico
          : valorUnitarioServico,
        adicionalServicoContrapeso: form.usaContrapeso ? adicionalServicoFinal : 0,
        valorTotalServico: valoresEditadosManual.valorTotalServico
          ? atual.valorTotalServico
          : totalServicoCalculado,
        valorMensalLocacao: usandoValoresCongelados || valoresEditadosManual.valorMensalLocacao
          ? atual.valorMensalLocacao
          : valorMensalLocacao,
        adicionalMensalContrapeso: form.usaContrapeso || entradaContrapesoAvulsa ? adicionalLocacaoFinal : 0,
        valorTotalMensalLocacao: valoresEditadosManual.valorTotalMensalLocacao
          ? atual.valorTotalMensalLocacao
          : totalLocacaoCalculado,
      };
    });
  }, [
    form.construtora,
    form.obra,
    form.equipamento,
    form.servico,
    form.tipoBalancinho,
    form.tipoMiniGrua,
    form.usaContrapeso,
    form.alteracaoContrapeso,
    form.quantidadeContrapeso,
    form.quantidade,
    form.dataLiberacao,
    form.valoresCongelados,
    obras,
    valoresEditadosManual,
  ]);

  const montarValoresCongelados = (
    atividade,
    dataCongelamento = new Date().toISOString(),
    tabelaOrigem = obterTabelaOrigemDaAtividade(atividade)
  ) => {
    const regras = obterRegrasOperacionais(atividade.servico, atividade.equipamento);
    const entradaContrapesoAvulsa =
      atividade.equipamento === "Balancinho" && normalizarAlteracaoContrapeso(atividade) === "adicionar";
    const quantidadeContrapeso = obterQuantidadeContrapeso(atividade) || 1;

    return {
      servicoUnitario: regras.cobraServico ? Number(atividade.valorUnitarioServico || 0) : 0,
      adicionalContrapesoServico: regras.cobraServico
        ? Number(atividade.usaContrapeso ? atividade.adicionalServicoContrapeso || 0 : 0)
        : 0,
      totalServico: regras.cobraServico ? Number(atividade.valorTotalServico || 0) : 0,
      locacaoMensalUnitario: regras.iniciaLocacao ? Number(atividade.valorMensalLocacao || 0) : 0,
      adicionalContrapesoLocacao: regras.iniciaLocacao || entradaContrapesoAvulsa
        ? Number(atividade.usaContrapeso || entradaContrapesoAvulsa ? atividade.adicionalMensalContrapeso || 0 : 0)
        : 0,
      totalLocacaoMensal: regras.iniciaLocacao || entradaContrapesoAvulsa
        ? Number(atividade.valorTotalMensalLocacao || 0) ||
          Number(atividade.adicionalMensalContrapeso || 0) * quantidadeContrapeso
        : 0,
      quantidade: Number(atividade.quantidade) || 1,
      tabelaOrigem,
      dataCongelamento,
    };
  };

  const aplicarValoresCongeladosNoFormulario = (atividade) => {
    if (!atividade.valoresCongelados) return atividade;

    return {
      ...atividade,
      valorUnitarioServico:
        atividade.valoresCongelados.servicoUnitario ?? atividade.valorUnitarioServico ?? "",
      adicionalServicoContrapeso:
        atividade.valoresCongelados.adicionalContrapesoServico ??
        atividade.adicionalServicoContrapeso ??
        "",
      valorTotalServico:
        atividade.valoresCongelados.totalServico ?? atividade.valorTotalServico ?? "",
      valorMensalLocacao:
        atividade.valoresCongelados.locacaoMensalUnitario ?? atividade.valorMensalLocacao ?? "",
      adicionalMensalContrapeso:
        atividade.valoresCongelados.adicionalContrapesoLocacao ??
        atividade.adicionalMensalContrapeso ??
        "",
      valorTotalMensalLocacao:
        atividade.valoresCongelados.totalLocacaoMensal ?? atividade.valorTotalMensalLocacao ?? "",
    };
  };

  const calcularContrapesosAtivosAte = (atividadeReferencia, dataReferencia) => {
    if (!dataReferencia) return 0;

    const chaveObraReferencia = obterChaveObra(atividadeReferencia);

    return atividades
      .filter((atividade) => {
        if (!atividade.dataLiberacao || atividade.equipamento !== "Balancinho") return false;
        if (String(atividade.id) === String(atividadeReferencia.id)) return false;
        if (atividade.dataLiberacao > dataReferencia) return false;
        return obterChaveObra(atividade) === chaveObraReferencia;
      })
      .reduce((total, atividade) => {
        const quantidade = Number(atividade.quantidade) || 1;
        const alteracaoContrapeso = normalizarAlteracaoContrapeso(atividade);
        const quantidadeContrapeso = obterQuantidadeContrapeso(atividade);

        if (servicoEntradaLocacaoInicial(atividade.servico) && atividade.usaContrapeso) {
          return total + quantidade;
        }

        if (alteracaoContrapeso === "adicionar") return total + quantidadeContrapeso;
        if (alteracaoContrapeso === "remover") return total - quantidadeContrapeso;

        return total;
      }, 0);
  };

  const validarContrapeso = (atividade) => {
    if (atividade.equipamento !== "Balancinho") return true;

    const alteracaoContrapeso = normalizarAlteracaoContrapeso(atividade);
    if (alteracaoContrapeso === "nenhuma") return true;

    const quantidadeContrapeso = Number(atividade.quantidadeContrapeso);
    if (!Number.isInteger(quantidadeContrapeso) || quantidadeContrapeso < 1) {
      alert("Informe uma quantidade de contrapesos inteira e maior que zero.");
      return false;
    }

    if (alteracaoContrapeso === "remover" && atividade.dataLiberacao) {
      const ativos = calcularContrapesosAtivosAte(atividade, atividade.dataLiberacao);
      if (quantidadeContrapeso > ativos) {
        alert(`Nao e possivel remover ${quantidadeContrapeso} contrapeso(s). Existem ${ativos} ativo(s) na obra ate a data da atividade.`);
        return false;
      }
    }

    return true;
  };

  const validarItensEquipamentos = (itens) => {
    for (let indice = 0; indice < itens.length; indice += 1) {
      const item = itens[indice];
      const numeroEquipamento = indice + 1;

      if (!item?.idItem || item.equipamento !== form.equipamento) {
        alert(`Preencha corretamente os dados do Equipamento ${numeroEquipamento}.`);
        return false;
      }

      if (form.equipamento === "Balancinho") {
        if (!String(item.tipoBalancinho || "").trim()) {
          alert(`Informe o tipo do Equipamento ${numeroEquipamento}.`);
          return false;
        }
      }

      if (
        form.equipamento === "Mini Grua" &&
        !String(item.tipoMiniGrua || "").trim()
      ) {
        alert(`Informe o tipo do Equipamento ${numeroEquipamento}.`);
        return false;
      }
    }

    return true;
  };

  const validarItensMovimentacao = (itens) => {
    if (itens.length === 0) {
      alert("Selecione ao menos um equipamento ativo.");
      return false;
    }

    const identidades = new Set();
    for (let indice = 0; indice < itens.length; indice += 1) {
      const item = itens[indice];
      const numeroEquipamento = indice + 1;

      if (!item.idItemOrigem || identidades.has(item.idItemOrigem)) {
        alert(`O Equipamento ${numeroEquipamento} está duplicado ou sem vínculo de origem.`);
        return false;
      }
      identidades.add(item.idItemOrigem);

      if (
        !form.id &&
        !unidadesAtivasDisponiveis.some(
          (unidade) => unidade.idUnidade === item.idItemOrigem
        )
      ) {
        alert(`O Equipamento ${numeroEquipamento} não está mais ativo nesta obra.`);
        return false;
      }

      if (item.equipamento !== form.equipamento) {
        alert(`O Equipamento ${numeroEquipamento} pertence a outro tipo de equipamento.`);
        return false;
      }

      if (form.servico === "Deslocamento") {
        const alteracao = String(
          item.alteracaoContrapeso || "nenhuma"
        ).toLowerCase();
        if (
          alteracao === "adicionar" &&
          item.usaContrapesoAnterior === true
        ) {
          alert(`O Equipamento ${numeroEquipamento} já utiliza contrapeso.`);
          return false;
        }
        if (
          alteracao === "remover" &&
          item.usaContrapesoAnterior !== true
        ) {
          alert(`O Equipamento ${numeroEquipamento} não utiliza contrapeso.`);
          return false;
        }
      }
    }

    return true;
  };

  const salvar = () => {
    const camposObrigatorios = [
      { nome: "Construtora", valor: form.construtora },
      { nome: "Obra", valor: form.obra || form.obraId },
      { nome: "Equipamento", valor: form.equipamento },
      { nome: "Serviço", valor: form.servico },
    ];
    const camposFaltantes = camposObrigatorios
      .filter((campo) => !String(campo.valor || "").trim())
      .map((campo) => campo.nome);

    if (camposFaltantes.length > 0) {
      alert(`Preencha os campos obrigatórios: ${camposFaltantes.join(", ")}.`);
      return;
    }

    const usaItensEquipamentos =
      permiteItensEquipamentos(form.equipamento, form.servico) &&
      Array.isArray(form.itensEquipamentos) &&
      form.itensEquipamentos.length > 0;
    const usaItensMovimentacao =
      servicoSelecionaUnidadesAtivas(form.servico) &&
      Array.isArray(form.itensEquipamentos);
    const usaItensIndividuais =
      usaItensEquipamentos || usaItensMovimentacao;
    const itensEquipamentos = usaItensIndividuais
      ? form.itensEquipamentos.map((item) => ({
          ...item,
          idItem: item.idItem || gerarIdItemEquipamento(),
          equipamento: form.equipamento,
          ...(form.equipamento === "Balancinho"
            ? {
                tipoBalancinho: usaItensMovimentacao
                  ? item.tipoBalancinho || form.tipoBalancinho
                  : form.tipoBalancinho || item.tipoBalancinho,
                tamanho: String(item.tamanho ?? "").trim(),
                tamanhoAnterior: String(
                  item.tamanhoAnterior ?? item.tamanho ?? ""
                ).trim(),
                tamanhoNovo: String(
                  item.tamanhoNovo ?? item.tamanho ?? ""
                ).trim(),
                ancoragem: String(item.ancoragem ?? "").trim(),
                ancoragemAnterior: String(
                  item.ancoragemAnterior ?? item.ancoragem ?? ""
                ).trim(),
                numeroPatrimonio: String(
                  item.numeroPatrimonio ?? ""
                ).trim(),
                usaContrapeso: item.usaContrapeso === true,
                usaContrapesoAnterior:
                  item.usaContrapesoAnterior ?? item.usaContrapeso === true,
                alteracaoContrapeso: String(
                  item.alteracaoContrapeso || "nenhuma"
                ).toLowerCase(),
              }
            : {
                tipoMiniGrua: usaItensMovimentacao
                  ? item.tipoMiniGrua || form.tipoMiniGrua
                  : form.tipoMiniGrua || item.tipoMiniGrua,
                numeroPatrimonio: String(
                  item.numeroPatrimonio ?? ""
                ).trim(),
              }),
        }))
      : null;

    if (usaItensEquipamentos && !validarItensEquipamentos(itensEquipamentos)) {
      return;
    }
    if (
      usaItensMovimentacao &&
      !validarItensMovimentacao(itensEquipamentos)
    ) {
      return;
    }

    const quantidadeFinal = usaItensIndividuais
      ? itensEquipamentos.length
      : Number(form.quantidade) || 1;
    const usaContrapesoFinal = usaItensIndividuais
      ? itensEquipamentos.some((item) => item.usaContrapeso === true)
      : form.usaContrapeso;
    const formCompatibilidade = {
      ...form,
      quantidade: quantidadeFinal,
      usaContrapeso: usaContrapesoFinal,
      ...(usaItensIndividuais && form.equipamento === "Balancinho"
        ? {
            tamanho: itensEquipamentos[0]?.tamanho || "",
            tamanhoAnterior:
              itensEquipamentos[0]?.tamanhoAnterior ||
              itensEquipamentos[0]?.tamanho ||
              "",
            tamanhoNovo:
              itensEquipamentos[0]?.tamanhoNovo ||
              itensEquipamentos[0]?.tamanho ||
              "",
            ancoragem: itensEquipamentos[0]?.ancoragem || "",
          }
        : {}),
    };

    if (!validarContrapeso(formCompatibilidade)) return;

    const regrasOperacionais = obterRegraOperacionalSegura(form.equipamento, form.servico);
    const obraSelecionada = obterObraDaAtividade(formCompatibilidade, obras);
    const alteracaoContrapeso = form.equipamento === "Balancinho" && servicoPermiteAlteracaoContrapeso(form.servico)
      ? normalizarAlteracaoContrapeso(form)
      : "nenhuma";
    const quantidadeContrapeso = alteracaoContrapeso === "nenhuma"
      ? usaItensMovimentacao
        ? Number(form.quantidadeContrapeso) || 0
        : usaItensEquipamentos
          ? itensEquipamentos.filter(
              (item) => item.usaContrapeso === true
            ).length
        : 1
      : obterQuantidadeContrapesoFormulario(form.quantidadeContrapeso, form.quantidade);
    const valoresCongelados = form.dataLiberacao
      ? montarValoresCongelados(
          { ...formCompatibilidade, alteracaoContrapeso, quantidadeContrapeso },
          form.valoresCongelados?.dataCongelamento || new Date().toISOString(),
          form.valoresCongelados?.tabelaOrigem || obterTabelaOrigemDaAtividade(form)
        )
      : form.valoresCongelados;
    const numeroOS = form.numeroOS || (form.dataLiberacao ? gerarProximoNumeroOS(atividades, form.dataLiberacao) : "");
    const novaAtividade = {
      ...form,
      obra: obraSelecionada?.nome || form.obra,
      obraId: obraSelecionada?.id || form.obraId || "",
      quantidade: quantidadeFinal,
      ...(usaItensIndividuais ? { itensEquipamentos } : {}),
      ...(usaItensIndividuais && form.equipamento === "Balancinho"
        ? {
            tamanho: itensEquipamentos[0]?.tamanho || "",
            tamanhoAnterior:
              itensEquipamentos[0]?.tamanhoAnterior ||
              itensEquipamentos[0]?.tamanho ||
              "",
            tamanhoNovo:
              itensEquipamentos[0]?.tamanhoNovo ||
              itensEquipamentos[0]?.tamanho ||
              "",
            ancoragem: itensEquipamentos[0]?.ancoragem || "",
          }
        : {}),
      usaContrapeso: usaContrapesoFinal,
      alteracaoContrapeso,
      quantidadeContrapeso,
      numerosPatrimonio: usaItensIndividuais
        ? itensEquipamentos.map((item) => item.numeroPatrimonio || "")
        : normalizarNumerosPatrimonio(
            form.numerosPatrimonio || [],
            quantidadeFinal
          ),
      adicionalServicoContrapeso: usaContrapesoFinal ? form.adicionalServicoContrapeso : 0,
      adicionalMensalContrapeso:
        usaContrapesoFinal || alteracaoContrapeso === "adicionar" ? form.adicionalMensalContrapeso : 0,
      ...regrasOperacionais,
      valoresCongelados,
      numeroOS,
      id: form.id || Date.now(),
      iniciado: form.iniciado || false,
    };

    const novas = form.id
      ? atividades.map((a) => (a.id === form.id ? novaAtividade : a))
      : [novaAtividade, ...atividades];

    setAtividades(novas);
    localStorage.setItem("atividades", JSON.stringify(novas));
    setForm({
      id: null,
      construtora: "",
      obra: "",
      obraId: "",
      equipamento: "",
      servico: "",
      tamanho: "",
      tamanhoAnterior: "",
      tamanhoNovo: "",
      ancoragem: "",
      tipoBalancinho: "Eletrico",
      usaContrapeso: false,
      alteracaoContrapeso: "nenhuma",
      quantidadeContrapeso: 1,
      tipoMiniGrua: "500kg",
      quantidade: 1,
      numerosPatrimonio: [""],
      dataAgendamento: "",
      dataLiberacao: "",
      equipeResponsavel: "",
      observacoes: "",
      valorUnitarioServico: "",
      adicionalServicoContrapeso: "",
      valorTotalServico: "",
      valorMensalLocacao: "",
      adicionalMensalContrapeso: "",
      valorTotalMensalLocacao: "",
      iniciado: false,
    });
    setValoresEditadosManual(camposValorLimpos);
  };

  const editar = (item) => {
    const atividadeComValores = aplicarValoresCongeladosNoFormulario(item);
    const quantidadeEdicao = Array.isArray(
      atividadeComValores.itensEquipamentos
    )
      ? atividadeComValores.itensEquipamentos.length
      : atividadeComValores.quantidade || 1;
    setValoresEditadosManual(marcarCamposValorPreenchidos(atividadeComValores));
    setForm({
      ...atividadeComValores,
      ...(Array.isArray(atividadeComValores.itensEquipamentos)
        ? {
            itensEquipamentos: atividadeComValores.itensEquipamentos.map(
              (itemEquipamento) => ({ ...itemEquipamento })
            ),
          }
        : {}),
      quantidade: quantidadeEdicao,
      numerosPatrimonio: ajustarNumerosPatrimonio(
        atividadeComValores.numerosPatrimonio || [],
        quantidadeEdicao
      ),
      tipoBalancinho: atividadeComValores.tipoBalancinho || "",
      usaContrapeso: atividadeComValores.usaContrapeso || false,
      alteracaoContrapeso: normalizarAlteracaoContrapeso(atividadeComValores),
      quantidadeContrapeso: atividadeComValores.quantidadeContrapeso || 1,
      tipoMiniGrua: atividadeComValores.tipoMiniGrua || "",
    });
    setTimeout(() => {
      topoRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };
  const excluir = (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta atividade?")) return;

    const novas = atividades.filter((a) => a.id !== id);
    setAtividades(novas);
    localStorage.setItem("atividades", JSON.stringify(novas));
  };

  const abrirOrdemServico = (item) => {
    setDocumentosAbertoId(null);
    setAtividadeOrdemServico(item);
  };

  const abrirContrato = (item) => {
    setDocumentosAbertoId(null);
    setAtividadeContrato(item);
  };

  const toggleMateriais = (id) =>
    setMostrarMateriaisId(mostrarMateriaisId === id ? null : id);

  const calcularMateriais = (tamanho, ancoragem) => {
    if (!tamanho || !ancoragem) return [];
    const base = [`Plataforma ${tamanho}m`];
    if (ancoragem === "Andaime Simples") base.push("Kit Simples");
    if (ancoragem === "Andaime Duplo") base.push("Kit Duplo");
    if (ancoragem === "Afastador") base.push("Afastador");
    return base;
  };

    const tamanhoSelecionado =
    form.servico === "Deslocamento" ? form.tamanhoNovo : form.tamanho;

  const materiais = calcularMateriais(tamanhoSelecionado, form.ancoragem);
  const regrasFormulario = obterRegrasOperacionais(form.servico);
  const servicosPermitidos = obterServicosPermitidos(form.equipamento);
  const obraSelecionadaNoFormulario = obterObraDaAtividade(form, obras);
  const unidadesAtivasDisponiveis = useMemo(() => {
    if (
      !obraSelecionadaNoFormulario ||
      !form.equipamento ||
      !servicoSelecionaUnidadesAtivas(form.servico)
    ) {
      return [];
    }

    const atividadesParaCalculo = form.id
      ? atividades.filter(
          (atividade) => String(atividade.id) !== String(form.id)
        )
      : atividades;

    return obterUnidadesEquipamentosAtivos(
      obraSelecionadaNoFormulario,
      atividadesParaCalculo
    ).filter((unidade) => unidade.equipamento === form.equipamento);
  }, [
    atividades,
    form.equipamento,
    form.id,
    form.servico,
    obraSelecionadaNoFormulario,
  ]);
  const alteracaoContrapesoFormulario = normalizarAlteracaoContrapeso(form);
  const entradaContrapesoAvulsaFormulario =
    form.equipamento === "Balancinho" && alteracaoContrapesoFormulario === "adicionar";
  const mostrarUsaContrapesoFormulario =
    form.equipamento === "Balancinho" && servicoEntradaLocacaoInicial(form.servico);
  const mostrarItensEquipamentosFormulario =
    permiteItensEquipamentos(form.equipamento, form.servico) &&
    Array.isArray(form.itensEquipamentos) &&
    form.itensEquipamentos.length > 0;
  const mostrarSelecaoUnidadesAtivas =
    Boolean(obraSelecionadaNoFormulario) &&
    Boolean(form.equipamento) &&
    servicoSelecionaUnidadesAtivas(form.servico) &&
    (!form.id || Array.isArray(form.itensEquipamentos));
  const unidadesParaSelecao = useMemo(() => {
    const unidades = [...unidadesAtivasDisponiveis];

    if (Array.isArray(form.itensEquipamentos)) {
      form.itensEquipamentos.forEach((item) => {
        if (
          !item.idItemOrigem ||
          unidades.some(
            (unidade) => unidade.idUnidade === item.idItemOrigem
          )
        ) {
          return;
        }

        unidades.push({
          idUnidade: item.idItemOrigem,
          idItemOrigem: item.idItemOrigem,
          atividadeOrigemId: item.atividadeOrigemId,
          equipamento: item.equipamento,
          tipoBalancinho: item.tipoBalancinho || "",
          tipoMiniGrua: item.tipoMiniGrua || "",
          tamanho: item.tamanhoAnterior || item.tamanho || "",
          ancoragem: item.ancoragemAnterior || item.ancoragem || "",
          numeroPatrimonio: item.numeroPatrimonio || "",
          usaContrapeso:
            item.usaContrapesoAnterior ?? item.usaContrapeso === true,
          obraId: form.obraId,
          construtora: form.construtora,
          obra: form.obra,
        });
      });
    }

    return unidades;
  }, [
    form.ancoragem,
    form.construtora,
    form.itensEquipamentos,
    form.obra,
    form.obraId,
    unidadesAtivasDisponiveis,
  ]);

  const formatarEquipamento = (item) => {
    if (item.equipamento === "Mini Grua") {
      return item.tipoMiniGrua ? `Mini Grua ${item.tipoMiniGrua}` : "Mini Grua";
    }

    if (item.equipamento !== "Balancinho") return item.equipamento;
    const tipo = item.tipoBalancinho === "Manual" ? "Manual" : "Elétrico";
    return `Balancinho ${tipo}`;
  };

  const obterDataReferenciaFiltro = (atividade) =>
    atividade.dataLiberacao || atividade.dataAgendamento || "";

  const construtorasFiltro = useMemo(() => {
    return [...construtoras].sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    );
  }, [construtoras]);

  const obrasFiltro = useMemo(() => {
    return obras
      .filter(
        (obra) =>
          !filtrosLista.construtora ||
          normalizarTexto(obra.construtora) === normalizarTexto(filtrosLista.construtora)
      )
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  }, [obras, filtrosLista.construtora]);

  const servicosFiltro = useMemo(() => {
    const servicosDasRegras = ["Balancinho", "Mini Grua"].flatMap((equipamento) =>
      obterOperacoes(equipamento).map((operacao) => operacao.nome)
    );
    const servicosDasAtividades = atividades.map((atividade) => atividade.servico).filter(Boolean);
    const servicosUnicos = Array.from(new Set([...servicosDasRegras, ...servicosDasAtividades]));

    return servicosUnicos.sort((a, b) => String(a || "").localeCompare(String(b || ""), "pt-BR"));
  }, [atividades]);

  const atividadesOrdenadas = useMemo(() => {
    const naoLiberadas = atividades
      .filter((a) => !a.dataLiberacao)
      .sort((a, b) => new Date(a.dataAgendamento) - new Date(b.dataAgendamento));

    const liberadas = atividades
      .filter((a) => a.dataLiberacao)
      .sort((a, b) => new Date(b.dataLiberacao) - new Date(a.dataLiberacao));

    return [...naoLiberadas, ...liberadas];
  }, [atividades]);

  const atividadesFiltradas = useMemo(() => {
    const busca = normalizarBusca(filtrosLista.busca);

    return atividadesOrdenadas.filter((atividade) => {
      const obraDaAtividade = obterObraDaAtividade(atividade, obras);
      const construtoraAtividade = obraDaAtividade?.construtora || atividade.construtora || "";
      const obraAtividade = obraDaAtividade?.nome || atividade.obra || "";
      const dataReferencia = obterDataReferenciaFiltro(atividade);

      if (
        filtrosLista.construtora &&
        normalizarTexto(construtoraAtividade) !== normalizarTexto(filtrosLista.construtora)
      ) {
        return false;
      }

      if (filtrosLista.obraId) {
        if (!obraDaAtividade || String(obraDaAtividade.id) !== String(filtrosLista.obraId)) {
          return false;
        }
      }

      if (filtrosLista.dataInicial || filtrosLista.dataFinal) {
        if (!dataReferencia) return false;
        if (filtrosLista.dataInicial && dataReferencia < filtrosLista.dataInicial) return false;
        if (filtrosLista.dataFinal && dataReferencia > filtrosLista.dataFinal) return false;
      }

      if (filtrosLista.equipamento && atividade.equipamento !== filtrosLista.equipamento) {
        return false;
      }

      if (filtrosLista.servico && atividade.servico !== filtrosLista.servico) {
        return false;
      }

      if (filtrosLista.status === "pendentes" && atividade.dataLiberacao) return false;
      if (filtrosLista.status === "liberadas" && !atividade.dataLiberacao) return false;

      if (busca) {
        const textoBusca = [
          construtoraAtividade,
          obraAtividade,
          atividade.equipamento,
          atividade.tipoBalancinho,
          atividade.tipoMiniGrua,
          atividade.servico,
          atividade.observacoes,
          atividade.tamanho,
          atividade.tamanhoAnterior,
          atividade.tamanhoNovo,
          atividade.ancoragem,
        ]
          .map(normalizarBusca)
          .join(" ");

        if (!textoBusca.includes(busca)) return false;
      }

      return true;
    });
  }, [atividadesOrdenadas, filtrosLista, obras]);

  const encerrarLocalizacaoAtividade = () => {
    setAtividadeDestacadaId(null);
    setAtividadeParaLocalizarId(null);

    if (filtrosAntesLocalizacaoRef.current) {
      setFiltrosLista(filtrosAntesLocalizacaoRef.current);
      filtrosAntesLocalizacaoRef.current = null;
    }
  };

  useEffect(() => {
    if (!atividadeParaLocalizarId || atividades.length === 0) return;

    const atividadeExiste = atividades.some((atividade) => String(atividade.id) === String(atividadeParaLocalizarId));
    if (!atividadeExiste) {
      setAtividadeParaLocalizarId(null);
      return;
    }

    const atividadeVisivel = atividadesFiltradas.some(
      (atividade) => String(atividade.id) === String(atividadeParaLocalizarId)
    );

    if (!atividadeVisivel) {
      if (!filtrosAntesLocalizacaoRef.current) {
        filtrosAntesLocalizacaoRef.current = filtrosLista;
      }
      setFiltrosLista(filtrosListaIniciais);
      return;
    }

    const elemento = atividadeRefs.current[String(atividadeParaLocalizarId)];
    if (!elemento) return;

    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    setAtividadeDestacadaId(String(atividadeParaLocalizarId));

    const timeout = window.setTimeout(() => {
      encerrarLocalizacaoAtividade();
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [atividadeParaLocalizarId, atividades, atividadesFiltradas, filtrosLista]);

  return (
    <div className="p-4">
      <div ref={topoRef}></div>
      <h2 className="text-xl font-semibold mb-4">Nova Atividade</h2>

      <div className="grid gap-3">
        <select
          value={form.construtora ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              construtora: e.target.value,
              obra: "",
              obraId: "",
              itensEquipamentos: undefined,
              quantidade: 1,
            })
          }
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        >
          <option value="">Construtora</option>
          {construtoras.map((c) => (
            <option key={c.id}>{c.nome}</option>
          ))}
        </select>

        <select
          value={obraSelecionadaNoFormulario?.id ?? form.obraId ?? ""}
          onChange={(e) => {
            const obraSelecionada = obras.find((obra) => String(obra.id) === String(e.target.value));
            setForm({
              ...form,
              obra: obraSelecionada?.nome || "",
              obraId: obraSelecionada?.id || "",
              itensEquipamentos: undefined,
              quantidade: 1,
            });
          }}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        >
          <option value="">Obra</option>
          {obras
            .filter((o) => o.construtora === form.construtora)
            .map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          {obraSelecionadaNoFormulario &&
            !obras.some((o) => String(o.id) === String(obraSelecionadaNoFormulario.id)) && (
              <option value={obraSelecionadaNoFormulario.id ?? ""}>{obraSelecionadaNoFormulario.nome}</option>
            )}
        </select>

        <select
          value={form.equipamento ?? ""}
          onChange={(e) => {
            const equipamento = e.target.value;
            const servico = obterServicoValidoParaEquipamento(
              equipamento,
              form.servico
            );
            const formularioAtualizado = {
              ...form,
              equipamento,
              servico,
              ancoragem: "",
              tipoBalancinho: equipamento === "Balancinho" ? form.tipoBalancinho || "Eletrico" : "",
              usaContrapeso: equipamento === "Balancinho" ? form.usaContrapeso || false : false,
              alteracaoContrapeso: equipamento === "Balancinho" ? form.alteracaoContrapeso || "nenhuma" : "nenhuma",
              quantidadeContrapeso: equipamento === "Balancinho" ? form.quantidadeContrapeso || 1 : 1,
              tipoMiniGrua: equipamento === "Mini Grua" ? form.tipoMiniGrua || "500kg" : "",
              itensEquipamentos: undefined,
              ...(servicoSelecionaUnidadesAtivas(servico)
                ? { quantidade: 0, numerosPatrimonio: [] }
                : {}),
            };

            setForm({
              ...formularioAtualizado,
              ...(obterQuantidadePatrimonio(form.quantidade) > 1 &&
              permiteItensEquipamentos(equipamento, servico)
                ? {
                    itensEquipamentos: ajustarItensEquipamentos(
                      { ...formularioAtualizado, itensEquipamentos: [] },
                      form.quantidade
                    ),
                  }
                : {}),
            });
          }}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        >
          <option value="">Equipamento</option>
          <option>Balancinho</option>
          <option>Mini Grua</option>
        </select>

        {form.equipamento === "Balancinho" && !mostrarSelecaoUnidadesAtivas && (
          <>
            <select
              value={form.tipoBalancinho ?? ""}
              onChange={(e) => {
                const tipoBalancinho = e.target.value;
                setForm({
                  ...form,
                  tipoBalancinho,
                  ...(Array.isArray(form.itensEquipamentos)
                    ? {
                        itensEquipamentos: form.itensEquipamentos.map((item) => ({
                          ...item,
                          tipoBalancinho,
                        })),
                      }
                    : {}),
                });
              }}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            >
              <option value="">Tipo do Balancinho</option>
              <option value="Eletrico">Elétrico</option>
              <option value="Manual">Manual</option>
            </select>

          </>
        )}

        {form.equipamento === "Mini Grua" && !mostrarSelecaoUnidadesAtivas && (
          <select
            value={form.tipoMiniGrua ?? ""}
            onChange={(e) => {
              const tipoMiniGrua = e.target.value;
              setForm({
                ...form,
                tipoMiniGrua,
                ...(Array.isArray(form.itensEquipamentos)
                  ? {
                      itensEquipamentos: form.itensEquipamentos.map((item) => ({
                        ...item,
                        tipoMiniGrua,
                      })),
                    }
                  : {}),
              });
            }}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="">Tipo da Mini Grua</option>
            <option value="500kg">500kg</option>
            <option value="1T">1T</option>
          </select>
        )}

        <select
          value={form.servico ?? ""}
          onChange={(e) => {
            const servico = e.target.value;
            const permiteUsoInicialContrapeso = servicoEntradaLocacaoInicial(servico);
            const formularioAtualizado = {
              ...form,
              servico,
              ...(servicoSelecionaUnidadesAtivas(servico)
                ? {
                    itensEquipamentos: undefined,
                    quantidade: 0,
                    numerosPatrimonio: [],
                  }
                : {}),
              usaContrapeso: permiteUsoInicialContrapeso ? form.usaContrapeso : false,
              adicionalServicoContrapeso: permiteUsoInicialContrapeso ? form.adicionalServicoContrapeso : 0,
              adicionalMensalContrapeso: permiteUsoInicialContrapeso ? form.adicionalMensalContrapeso : 0,
              alteracaoContrapeso: servicoPermiteAlteracaoContrapeso(servico)
                ? form.alteracaoContrapeso || "nenhuma"
                : "nenhuma",
              quantidadeContrapeso: form.quantidadeContrapeso || form.quantidade || 1,
            };
            setForm({
              ...formularioAtualizado,
              ...(obterQuantidadePatrimonio(form.quantidade) > 1 &&
              permiteItensEquipamentos(form.equipamento, servico)
                ? {
                    itensEquipamentos: ajustarItensEquipamentos(
                      formularioAtualizado,
                      form.quantidade
                    ),
                  }
                : {}),
            });
          }}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        >
          <option value="">Serviço</option>
          {servicosPermitidos.map((servico) => (
            <option key={servico}>{servico}</option>
          ))}
        </select>

        {mostrarUsaContrapesoFormulario && !mostrarItensEquipamentosFormulario && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={Boolean(form.usaContrapeso)}
              onChange={(e) => {
                const usaContrapeso = e.target.checked;
                setForm({
                  ...form,
                  usaContrapeso,
                  adicionalServicoContrapeso: usaContrapeso ? form.adicionalServicoContrapeso : 0,
                  adicionalMensalContrapeso: usaContrapeso ? form.adicionalMensalContrapeso : 0,
                });
                if (!usaContrapeso) {
                  setValoresEditadosManual((atuais) => ({
                    ...atuais,
                    adicionalServicoContrapeso: false,
                    adicionalMensalContrapeso: false,
                  }));
                }
              }}
            />
            Usa contrapeso?
          </label>
        )}
        {form.equipamento === "Balancinho" &&
          form.servico !== "" &&
          form.servico !== "Deslocamento" &&
          !mostrarItensEquipamentosFormulario && (
            <select
              value={form.tamanho ?? ""}
              onChange={(e) => setForm({ ...form, tamanho: e.target.value })}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            >
              <option value="">Tamanho</option>
              {[1, 1.5, 2, 3, 4, 5, 6].map((val) => (
                <option key={val} value={val}>{val}m</option>
              ))}
            </select>
          )}

        {form.servico === "Deslocamento" && !mostrarSelecaoUnidadesAtivas && (
          <>
            <select
              value={form.tamanhoAnterior ?? ""}
              onChange={(e) =>
                setForm({ ...form, tamanhoAnterior: e.target.value })
              }
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            >
              <option value="">Tamanho Anterior</option>
              {[1, 1.5, 2, 3, 4, 5, 6].map((val) => (
                <option key={val} value={val}>{val}m</option>
              ))}
            </select>

            <select
              value={form.tamanhoNovo ?? ""}
              onChange={(e) =>
                setForm({ ...form, tamanhoNovo: e.target.value })
              }
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            >
              <option value="">Tamanho Novo</option>
              {[1, 1.5, 2, 3, 4, 5, 6].map((val) => (
                <option key={val} value={val}>{val}m</option>
              ))}
            </select>
          </>
        )}

        {form.equipamento === "Balancinho" &&
          !mostrarItensEquipamentosFormulario &&
          !mostrarSelecaoUnidadesAtivas && (
          <select
            value={form.ancoragem ?? ""}
            onChange={(e) => setForm({ ...form, ancoragem: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="">Ancoragem</option>
            <option>Andaime Simples</option>
            <option>Andaime Duplo</option>
            <option>Afastador</option>
          </select>
        )}

        {mostrarSelecaoUnidadesAtivas ? (
          <p className="rounded-xl border bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            Equipamentos selecionados:{" "}
            {Array.isArray(form.itensEquipamentos)
              ? form.itensEquipamentos.length
              : 0}
          </p>
        ) : (
          <>
            <label className="text-sm font-medium mt-2">
              Quantidade de Equipamentos
            </label>
            <input
              type="number"
              min="1"
              value={form.quantidade ?? ""}
              onChange={(e) => atualizarQuantidade(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            />
          </>
        )}

        {mostrarSelecaoUnidadesAtivas && (
          <section className="space-y-3 rounded-xl border bg-gray-50 p-3">
            <div>
              <h3 className="font-semibold">Equipamentos ativos desta obra</h3>
              <p className="text-sm text-gray-500">
                Selecione uma ou várias unidades para este lançamento.
              </p>
            </div>

            {unidadesParaSelecao.length === 0 ? (
              <p className="rounded-lg border bg-white p-3 text-sm text-gray-500">
                Nenhum equipamento ativo disponível para esta obra.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {unidadesParaSelecao.map((unidade, indiceUnidade) => {
                  const itemSelecionado = form.itensEquipamentos?.find(
                    (item) => item.idItemOrigem === unidade.idUnidade
                  );
                  const selecionada = Boolean(itemSelecionado);
                  const tipo =
                    unidade.equipamento === "Balancinho"
                      ? unidade.tipoBalancinho === "Manual"
                        ? "Balancinho Manual"
                        : "Balancinho Elétrico"
                      : `Mini Grua ${unidade.tipoMiniGrua || ""}`.trim();

                  return (
                    <div
                      key={unidade.idUnidade}
                      className={`rounded-xl border p-3 shadow-sm ${
                        selecionada
                          ? "border-blue-400 bg-blue-50"
                          : "bg-white"
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={() =>
                            alternarSelecaoUnidadeAtiva(unidade)
                          }
                          className="mt-1"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block font-semibold">
                            {tipo} — Unidade {indiceUnidade + 1}
                          </span>
                          {unidade.equipamento === "Balancinho" && (
                            <span className="block text-gray-600">
                              {unidade.tamanho
                                ? `${unidade.tamanho} m`
                                : "Tamanho não informado"}
                              {unidade.ancoragem
                                ? ` — ${unidade.ancoragem}`
                                : ""}
                            </span>
                          )}
                          <span className="block text-gray-500">
                            {unidade.numeroPatrimonio
                              ? `Patrimônio ${unidade.numeroPatrimonio}`
                              : "Sem patrimônio"}
                            {unidade.equipamento === "Balancinho" &&
                            unidade.usaContrapeso
                              ? " — Contrapeso"
                              : ""}
                          </span>
                        </span>
                      </label>

                      {selecionada &&
                        form.servico === "Deslocamento" &&
                        itemSelecionado && (
                          <div className="mt-3 space-y-3 border-t pt-3">
                            <p className="text-sm text-gray-600">
                              Tamanho anterior:{" "}
                              <strong>
                                {itemSelecionado.tamanhoAnterior || "-"} m
                              </strong>
                            </p>

                            <label className="block text-sm font-medium">
                              Novo tamanho
                              <select
                                value={itemSelecionado.tamanhoNovo || ""}
                                onChange={(e) =>
                                  atualizarItemEquipamento(
                                    itemSelecionado.idItem,
                                    "tamanhoNovo",
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                              >
                                <option value="">Novo tamanho</option>
                                {[1, 1.5, 2, 3, 4, 5, 6].map((valor) => (
                                  <option key={valor} value={valor}>
                                    {valor}m
                                  </option>
                                ))}
                              </select>
                            </label>

                            <p className="text-sm text-gray-600">
                              Ancoragem anterior:{" "}
                              <strong>
                                {itemSelecionado.ancoragemAnterior || "-"}
                              </strong>
                            </p>

                            <label className="block text-sm font-medium">
                              Nova ancoragem
                              <select
                                value={itemSelecionado.ancoragem || ""}
                                onChange={(e) =>
                                  atualizarItemEquipamento(
                                    itemSelecionado.idItem,
                                    "ancoragem",
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                              >
                                <option value="">Nova ancoragem</option>
                                <option>Andaime Simples</option>
                                <option>Andaime Duplo</option>
                                <option>Afastador</option>
                              </select>
                            </label>

                            <label className="block text-sm font-medium">
                              Alteração de contrapeso
                              <select
                                value={
                                  itemSelecionado.alteracaoContrapeso ||
                                  "nenhuma"
                                }
                                onChange={(e) =>
                                  atualizarItemEquipamento(
                                    itemSelecionado.idItem,
                                    "alteracaoContrapeso",
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                              >
                                <option value="nenhuma">Sem alteração</option>
                                <option
                                  value="adicionar"
                                  disabled={
                                    itemSelecionado.usaContrapesoAnterior ===
                                    true
                                  }
                                >
                                  Adicionar
                                </option>
                                <option
                                  value="remover"
                                  disabled={
                                    itemSelecionado.usaContrapesoAnterior !==
                                    true
                                  }
                                >
                                  Remover
                                </option>
                              </select>
                            </label>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {mostrarItensEquipamentosFormulario && (
          <section className="space-y-3 rounded-xl border bg-gray-50 p-3">
            <div>
              <h3 className="font-semibold">Equipamentos deste lançamento</h3>
              <p className="text-sm text-gray-500">
                Informe os dados próprios de cada unidade.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {form.itensEquipamentos.map((item, indice) => (
                <div
                  key={item.idItem}
                  className="space-y-3 rounded-xl border bg-white p-3 shadow-sm"
                >
                  <h4 className="font-semibold text-blue-700">
                    Equipamento {indice + 1}
                  </h4>

                  {form.equipamento === "Balancinho" ? (
                    <>
                      <label className="block text-sm font-medium">
                        Tipo do Balancinho
                        <select
                          value={item.tipoBalancinho || form.tipoBalancinho || ""}
                          onChange={(e) =>
                            atualizarItemEquipamento(
                              item.idItem,
                              "tipoBalancinho",
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                        >
                          <option value="">Tipo do Balancinho</option>
                          <option value="Eletrico">Elétrico</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </label>

                      <label className="block text-sm font-medium">
                        Tamanho
                        <select
                          value={item.tamanho ?? ""}
                          onChange={(e) =>
                            atualizarItemEquipamento(
                              item.idItem,
                              "tamanho",
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                        >
                          <option value="">Tamanho</option>
                          {[1, 1.5, 2, 3, 4, 5, 6].map((valor) => (
                            <option key={valor} value={valor}>
                              {valor}m
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-sm font-medium">
                        Ancoragem
                        <select
                          value={item.ancoragem ?? ""}
                          onChange={(e) =>
                            atualizarItemEquipamento(
                              item.idItem,
                              "ancoragem",
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                        >
                          <option value="">Ancoragem</option>
                          <option>Andaime Simples</option>
                          <option>Andaime Duplo</option>
                          <option>Afastador</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={item.usaContrapeso === true}
                          onChange={(e) =>
                            atualizarItemEquipamento(
                              item.idItem,
                              "usaContrapeso",
                              e.target.checked
                            )
                          }
                        />
                        Usa contrapeso?
                      </label>
                    </>
                  ) : (
                    <label className="block text-sm font-medium">
                      Tipo da Mini Grua
                      <select
                        value={item.tipoMiniGrua || form.tipoMiniGrua || ""}
                        onChange={(e) =>
                          atualizarItemEquipamento(
                            item.idItem,
                            "tipoMiniGrua",
                            e.target.value
                          )
                        }
                        className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                      >
                        <option value="">Tipo da Mini Grua</option>
                        <option value="500kg">500kg</option>
                        <option value="1T">1T</option>
                      </select>
                    </label>
                  )}

                  <label className="block text-sm font-medium">
                    Número de patrimônio
                    <input
                      type="text"
                      value={item.numeroPatrimonio ?? ""}
                      onChange={(e) =>
                        atualizarItemEquipamento(
                          item.idItem,
                          "numeroPatrimonio",
                          e.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        {form.equipamento === "Balancinho" &&
          servicoPermiteAlteracaoContrapeso(form.servico) &&
          !mostrarSelecaoUnidadesAtivas && (
          <div className="grid gap-3 border rounded-xl p-3 bg-gray-50">
            <h3 className="text-sm font-semibold">Contrapeso</h3>
            {form.servico === "Deslocamento" ? (
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  ["nenhuma", "Sem alteração"],
                  ["adicionar", "Adicionar contrapeso"],
                  ["remover", "Remover contrapeso"],
                ].map(([valor, rotulo]) => (
                  <label key={valor} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="alteracaoContrapeso"
                      value={valor}
                      checked={normalizarAlteracaoContrapeso(form) === valor}
                      onChange={() =>
                        setForm({
                          ...form,
                          alteracaoContrapeso: valor,
                          quantidadeContrapeso: form.quantidadeContrapeso || form.quantidade || 1,
                        })
                      }
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  ["nenhuma", "Não"],
                  ["remover", "Sim"],
                ].map(([valor, rotulo]) => (
                  <label key={valor} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="alteracaoContrapeso"
                      value={valor}
                      checked={normalizarAlteracaoContrapeso(form) === valor}
                      onChange={() =>
                        setForm({
                          ...form,
                          alteracaoContrapeso: valor,
                          quantidadeContrapeso: form.quantidadeContrapeso || form.quantidade || 1,
                        })
                      }
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            )}

            <div className="min-h-[70px]">
              {normalizarAlteracaoContrapeso(form) !== "nenhuma" && (
                <label className="block text-sm font-medium">
                  Quantidade de contrapesos
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantidadeContrapeso ?? 1}
                    onChange={(e) => setForm({ ...form, quantidadeContrapeso: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {!mostrarItensEquipamentosFormulario && !mostrarSelecaoUnidadesAtivas && (
        <div className="grid gap-3 border rounded-xl p-3 bg-gray-50">
          <h3 className="text-sm font-semibold">Números de patrimônio</h3>
          <div className="grid gap-3">
            {ajustarNumerosPatrimonio(form.numerosPatrimonio || [], form.quantidade || 1).map((numero, indice) => (
              <label key={indice} className="text-sm font-medium">
                Patrimônio {indice + 1}
                <input
                  type="text"
                  value={numero}
                  onChange={(e) => atualizarNumeroPatrimonio(indice, e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
                />
              </label>
            ))}
          </div>
        </div>
        )}

        {form.servico && regrasFormulario.cobraServico && (
          <div className="grid gap-3 border rounded-xl p-3 bg-gray-50">
            <h3 className="text-sm font-semibold">Valores do Serviço</h3>

            <label className="text-sm font-medium">Valor unitário do serviço</label>
            <input
              type="number"
              value={form.valorUnitarioServico ?? ""}
              onChange={(e) => atualizarCampoValor("valorUnitarioServico", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            />

            {form.usaContrapeso && (
              <>
                <label className="text-sm font-medium">Adicional serviço contrapeso</label>
                <input
                  type="number"
                  value={form.adicionalServicoContrapeso ?? ""}
                  onChange={(e) => atualizarCampoValor("adicionalServicoContrapeso", e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
                />
              </>
            )}

            <label className="text-sm font-medium">Valor total do serviço</label>
            <input
              type="number"
              value={form.valorTotalServico ?? ""}
              onChange={(e) => atualizarCampoValor("valorTotalServico", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            />
          </div>
        )}

        {form.servico && (regrasFormulario.iniciaLocacao || entradaContrapesoAvulsaFormulario) && (
          <div className="grid gap-3 border rounded-xl p-3 bg-gray-50">
            <h3 className="text-sm font-semibold">Valores da Locação</h3>

            <label className="text-sm font-medium">Valor mensal locação</label>
            <input
              type="number"
              value={form.valorMensalLocacao ?? ""}
              onChange={(e) => atualizarCampoValor("valorMensalLocacao", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            />

            {(form.usaContrapeso || entradaContrapesoAvulsaFormulario) && (
              <>
                <label className="text-sm font-medium">Adicional mensal contrapeso</label>
                <input
                  type="number"
                  value={form.adicionalMensalContrapeso ?? ""}
                  onChange={(e) => atualizarCampoValor("adicionalMensalContrapeso", e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
                />
              </>
            )}

            <label className="text-sm font-medium">Valor total mensal locação</label>
            <input
              type="number"
              value={form.valorTotalMensalLocacao ?? ""}
              onChange={(e) => atualizarCampoValor("valorTotalMensalLocacao", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            />
          </div>
        )}

        <label className="text-sm font-medium mt-2">Data de Agendamento</label>
        <input
          type="date"
          value={form.dataAgendamento ?? ""}
          onChange={(e) => setForm({ ...form, dataAgendamento: e.target.value })}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        />

        <label className="text-sm font-medium mt-2">Data de Liberação</label>
        <input
          type="date"
          value={form.dataLiberacao ?? ""}
          onChange={(e) => setForm({ ...form, dataLiberacao: e.target.value })}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        />

        <label className="text-sm font-medium mt-2">Equipe responsavel</label>
        <input
          type="text"
          value={form.equipeResponsavel ?? ""}
          onChange={(e) => setForm({ ...form, equipeResponsavel: e.target.value })}
          placeholder="Ex.: Israel, Matheus e LG"
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        />

        <textarea
          value={form.observacoes ?? ""}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          placeholder="Observações"
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        />
        <button
          onClick={salvar}
          className="w-full bg-blue-500 text-white p-2 rounded-xl shadow"
        >
          Salvar
        </button>
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-4">
        Atividades Salvas ({atividadesFiltradas.length})
      </h2>

      <div className="mb-4 rounded-xl border bg-gray-50 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Filtros da lista</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={filtrosLista.busca}
            onChange={(e) => setFiltrosLista({ ...filtrosLista, busca: e.target.value })}
            placeholder="Buscar atividade"
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          />

          <select
            value={filtrosLista.construtora}
            onChange={(e) => {
              const construtora = e.target.value;
              const obraAtual = obras.find((obra) => String(obra.id) === String(filtrosLista.obraId));
              const manterObra =
                obraAtual && normalizarTexto(obraAtual.construtora) === normalizarTexto(construtora);

              setFiltrosLista({
                ...filtrosLista,
                construtora,
                obraId: manterObra ? filtrosLista.obraId : "",
              });
            }}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="">Todas as construtoras</option>
            {construtorasFiltro.map((construtora) => (
              <option key={construtora.id || construtora.nome} value={construtora.nome}>
                {construtora.nome}
              </option>
            ))}
          </select>

          <select
            value={filtrosLista.obraId}
            onChange={(e) => setFiltrosLista({ ...filtrosLista, obraId: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="">Todas as obras</option>
            {obrasFiltro.map((obra) => (
              <option key={obra.id} value={obra.id}>
                {obra.nome}{obra.construtora ? ` (${obra.construtora})` : ""}
              </option>
            ))}
          </select>

          <select
            value={filtrosLista.equipamento}
            onChange={(e) => setFiltrosLista({ ...filtrosLista, equipamento: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="">Todos os equipamentos</option>
            <option value="Balancinho">Balancinho</option>
            <option value="Mini Grua">Mini Grua</option>
          </select>

          <input
            type="date"
            value={filtrosLista.dataInicial}
            onChange={(e) => setFiltrosLista({ ...filtrosLista, dataInicial: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          />

          <input
            type="date"
            value={filtrosLista.dataFinal}
            onChange={(e) => setFiltrosLista({ ...filtrosLista, dataFinal: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          />

          <select
            value={filtrosLista.servico}
            onChange={(e) => setFiltrosLista({ ...filtrosLista, servico: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="">Todos os servicos</option>
            {servicosFiltro.map((servico) => (
              <option key={servico} value={servico}>
                {servico}
              </option>
            ))}
          </select>

          <select
            value={filtrosLista.status}
            onChange={(e) => setFiltrosLista({ ...filtrosLista, status: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="todas">Todas</option>
            <option value="pendentes">Pendentes</option>
            <option value="liberadas">Liberadas</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setFiltrosLista(filtrosListaIniciais)}
          className="mt-3 rounded-xl border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
        >
          Limpar filtros
        </button>
      </div>

<div className="space-y-4">
  {atividadesFiltradas.length === 0 ? (
    <p className="rounded-xl border bg-white p-4 text-sm text-gray-500">
      Nenhuma atividade encontrada com os filtros selecionados.
    </p>
  ) : (
    atividadesFiltradas.map((item) => {
      const tamanhoInfo =
        item.servico === "Deslocamento"
          ? `Tamanho: ${item.tamanhoAnterior || ""} ➔ ${item.tamanhoNovo || ""}`
          : `Tamanho: ${item.tamanho || ""}`;

      return (
        <div
          key={item.id}
          ref={(elemento) => {
            if (elemento) atividadeRefs.current[String(item.id)] = elemento;
            else delete atividadeRefs.current[String(item.id)];
          }}
          onMouseDown={
            String(atividadeDestacadaId) === String(item.id)
              ? encerrarLocalizacaoAtividade
              : undefined
          }
          onTouchStart={
            String(atividadeDestacadaId) === String(item.id)
              ? encerrarLocalizacaoAtividade
              : undefined
          }
          onFocusCapture={
            String(atividadeDestacadaId) === String(item.id)
              ? encerrarLocalizacaoAtividade
              : undefined
          }
          className={`border rounded-xl p-4 shadow flex flex-col gap-2 transition-colors duration-500 ${
            String(atividadeDestacadaId) === String(item.id)
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
              : "bg-white"
          }`}
        >
              <strong>{item.servico} - {formatarEquipamento(item)}</strong>
              {item.usaContrapeso && (
                <span className="inline-block w-fit rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                  CONTRAPESO
                </span>
              )}
              {normalizarAlteracaoContrapeso(item) !== "nenhuma" && (
                <span className="inline-block w-fit rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-900">
                  Contrapeso: {normalizarAlteracaoContrapeso(item) === "adicionar" ? "adicionar" : "remover"} {item.quantidadeContrapeso || 1}
                </span>
              )}
              <span className="text-xs font-semibold text-gray-500">
  Status: {item.dataLiberacao
    ? "CONCLUÍDO"
    : item.iniciado
    ? "EM ANDAMENTO"
    : "AGENDADO"}
</span>

              <span>{item.construtora} | {item.obra}</span>
              <span>{tamanhoInfo}</span>
              <span>Quantidade: {item.quantidade || 1}</span>
              <span>Ancoragem: {item.ancoragem}</span>
              {item.dataAgendamento && (
                <span>
                  Agendamento: {item.dataAgendamento.split("-").reverse().join("/")}
                </span>
              )}
              {item.dataLiberacao && (
                <span>
                  Liberação: {item.dataLiberacao.split("-").reverse().join("/")}
                </span>
              )}

              {item.observacoes && (
                <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm font-medium">
                  Obs: {item.observacoes}
                </div>
              )}

              <div className="flex gap-2 flex-wrap mt-2">
                {!item.dataLiberacao && !item.iniciado && (
                  <button
                    onClick={() => {
                      const atualizadas = atividades.map((a) =>
                        a.id === item.id ? { ...a, iniciado: true } : a
                      );
                      setAtividades(atualizadas);
                      localStorage.setItem("atividades", JSON.stringify(atualizadas));
                    }}
                    className="bg-white border rounded-xl px-4 py-1 text-orange-600 shadow-sm"
                  >
                    Iniciar Serviço
                  </button>
                )}
                {!item.dataLiberacao && (
                  <button
                    onClick={() => {
                      const dataLiberacao = new Date().toISOString().split("T")[0];
                      const atividadeLiberada = { ...item, dataLiberacao };
                      if (!validarContrapeso(atividadeLiberada)) return;
                      const atualizadas = atividades.map((a) =>
                        a.id === item.id
                          ? {
                              ...a,
                              dataLiberacao,
                              numeroOS: a.numeroOS || gerarProximoNumeroOS(atividades, dataLiberacao),
                              valoresCongelados: montarValoresCongelados(atividadeLiberada),
                            }
                          : a
                      );
                      setAtividades(atualizadas);
                      localStorage.setItem("atividades", JSON.stringify(atualizadas));
                    }}
                    className="bg-white border rounded-xl px-4 py-1 text-green-600 shadow-sm"
                  >
                    Liberar
                  </button>
                )}
                <button
                  onClick={() => editar(item)}
                  className="bg-white border rounded-xl px-4 py-1 text-blue-500 shadow-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => excluir(item.id)}
                  className="bg-white border rounded-xl px-4 py-1 text-red-500 shadow-sm"
                >
                  Excluir
                </button>
                <div className="relative">
                  <button
                    onClick={() =>
                      setDocumentosAbertoId(documentosAbertoId === item.id ? null : item.id)
                    }
                    className="bg-white border rounded-xl px-4 py-1 text-gray-700 shadow-sm"
                  >
                    Documentos
                  </button>
                  {documentosAbertoId === item.id && (
                    <div className="absolute right-0 z-10 mt-1 min-w-[180px] rounded border bg-white p-1 shadow">
                      <button
                        onClick={() => abrirOrdemServico(item)}
                        className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                      >
                        Ordem de Serviço
                      </button>
                      {obterTipoContrato(item) && (
                        <button
                          onClick={() => abrirContrato(item)}
                          className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                        >
                          Contrato
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {mostrarMateriaisId === item.id && (
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                  {calcularMateriais(
                    item.servico === "Deslocamento"
                      ? item.tamanhoNovo
                      : item.tamanho,
                    item.ancoragem
                  ).map((mat, i) => (
                    <li key={i}>{mat}</li>
                  ))}
                </ul>
                )}
                </div>
              );
            })
          )}
        </div>
        {atividadeOrdemServico && (
          <OrdemServico
            atividade={atividadeOrdemServico}
            obras={obras}
            construtoras={construtoras}
            onClose={() => setAtividadeOrdemServico(null)}
          />
        )}
        {atividadeContrato && (
          <Contrato
            atividade={atividadeContrato}
            obras={obras}
            construtoras={construtoras}
            onClose={() => setAtividadeContrato(null)}
          />
        )}
      </div>
    );
  }
  

