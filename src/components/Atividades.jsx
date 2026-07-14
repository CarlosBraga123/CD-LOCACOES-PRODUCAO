// Atividades.jsx - Versão corrigida sem erro de fechamento de JSX
import { useEffect, useState, useRef, useMemo } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { obterObraDaAtividade, normalizarTexto } from "../utils/obras";
import { obterOperacoes, obterRegraOperacao } from "../utils/regrasOperacao";
import OrdemServico from "./OrdemServico";
import Contrato from "./documentos/Contrato";
import { obterTipoContrato } from "../utils/contrato";
import { gerarCodigoOrdemServico } from "../utils/ordemServico";

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

export default function Atividades() {
  const topoRef = useRef(null);
  const [construtoras, setConstrutoras] = useState([]);
  const [obras, setObras] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [mostrarMateriaisId, setMostrarMateriaisId] = useState(null);
  const [filtrosLista, setFiltrosLista] = useState(filtrosListaIniciais);
  const [documentosAbertoId, setDocumentosAbertoId] = useState(null);
  const [atividadeOrdemServico, setAtividadeOrdemServico] = useState(null);
  const [atividadeContrato, setAtividadeContrato] = useState(null);
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

    const atividadeParaEditar = localStorage.getItem("atividadeParaEditar");
    if (atividadeParaEditar) {
      const encontrada = dadosSalvos.find((a) => String(a.id) === atividadeParaEditar);
      if (encontrada) {
        const atividadeComValores = aplicarValoresCongeladosNoFormulario(encontrada);
        setValoresEditadosManual(marcarCamposValorPreenchidos(atividadeComValores));
        setForm({
          ...atividadeComValores,
          quantidade: atividadeComValores.quantidade || 1,
          numerosPatrimonio: ajustarNumerosPatrimonio(
            atividadeComValores.numerosPatrimonio || [],
            atividadeComValores.quantidade || 1
          ),
          tipoBalancinho: atividadeComValores.tipoBalancinho || "",
          usaContrapeso: atividadeComValores.usaContrapeso || false,
          tipoMiniGrua: atividadeComValores.tipoMiniGrua || "",
        });
        setTimeout(() => {
          topoRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
      localStorage.removeItem("atividadeParaEditar");
    }
  }, []);

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
    const patrimoniosAtuais = form.numerosPatrimonio || [];

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
      regras.iniciaLocacao && form.equipamento === "Balancinho" && form.usaContrapeso
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
      const adicionalLocacaoFinal = form.usaContrapeso
        ? usandoValoresCongelados || valoresEditadosManual.adicionalMensalContrapeso
          ? atual.adicionalMensalContrapeso
          : adicionalMensalContrapeso
        : 0;
      const totalLocacaoCalculado = regras.iniciaLocacao
        ? (converterValorParaNumero(mensalLocacaoFinal) + converterValorParaNumero(adicionalLocacaoFinal)) *
          quantidade
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
        adicionalMensalContrapeso: form.usaContrapeso ? adicionalLocacaoFinal : 0,
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

    return {
      servicoUnitario: regras.cobraServico ? Number(atividade.valorUnitarioServico || 0) : 0,
      adicionalContrapesoServico: regras.cobraServico
        ? Number(atividade.usaContrapeso ? atividade.adicionalServicoContrapeso || 0 : 0)
        : 0,
      totalServico: regras.cobraServico ? Number(atividade.valorTotalServico || 0) : 0,
      locacaoMensalUnitario: regras.iniciaLocacao ? Number(atividade.valorMensalLocacao || 0) : 0,
      adicionalContrapesoLocacao: regras.iniciaLocacao
        ? Number(atividade.usaContrapeso ? atividade.adicionalMensalContrapeso || 0 : 0)
        : 0,
      totalLocacaoMensal: regras.iniciaLocacao ? Number(atividade.valorTotalMensalLocacao || 0) : 0,
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

    const regrasOperacionais = obterRegraOperacionalSegura(form.equipamento, form.servico);
    const obraSelecionada = obterObraDaAtividade(form, obras);
    const valoresCongelados = form.dataLiberacao
      ? montarValoresCongelados(
          form,
          form.valoresCongelados?.dataCongelamento || new Date().toISOString(),
          form.valoresCongelados?.tabelaOrigem || obterTabelaOrigemDaAtividade(form)
        )
      : form.valoresCongelados;
    const novaAtividade = {
      ...form,
      obra: obraSelecionada?.nome || form.obra,
      obraId: obraSelecionada?.id || form.obraId || "",
      quantidade: Number(form.quantidade) || 1,
      numerosPatrimonio: normalizarNumerosPatrimonio(
        form.numerosPatrimonio || [],
        Number(form.quantidade) || 1
      ),
      adicionalServicoContrapeso: form.usaContrapeso ? form.adicionalServicoContrapeso : 0,
      adicionalMensalContrapeso: form.usaContrapeso ? form.adicionalMensalContrapeso : 0,
      ...regrasOperacionais,
      valoresCongelados,
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
    setValoresEditadosManual(marcarCamposValorPreenchidos(atividadeComValores));
    setForm({
      ...atividadeComValores,
      quantidade: atividadeComValores.quantidade || 1,
      numerosPatrimonio: ajustarNumerosPatrimonio(
        atividadeComValores.numerosPatrimonio || [],
        atividadeComValores.quantidade || 1
      ),
      tipoBalancinho: atividadeComValores.tipoBalancinho || "",
      usaContrapeso: atividadeComValores.usaContrapeso || false,
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
    let atividadeAtualizada = item;
    let listaAtualizada = atividades;

    if (!item.codigoOrdemServico) {
      const codigoOrdemServico = gerarCodigoOrdemServico(atividades);
      listaAtualizada = atividades.map((atividade) =>
        atividade.id === item.id ? { ...atividade, codigoOrdemServico } : atividade
      );
      atividadeAtualizada = { ...item, codigoOrdemServico };
      setAtividades(listaAtualizada);
      localStorage.setItem("atividades", JSON.stringify(listaAtualizada));
    }

    setDocumentosAbertoId(null);
    setAtividadeOrdemServico(atividadeAtualizada);
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

  return (
    <div className="p-4">
      <div ref={topoRef}></div>
      <h2 className="text-xl font-semibold mb-4">Nova Atividade</h2>

      <div className="grid gap-3">
        <select
          value={form.construtora ?? ""}
          onChange={(e) => setForm({ ...form, construtora: e.target.value, obra: "", obraId: "" })}
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
            setForm({
              ...form,
              equipamento,
              servico: obterServicoValidoParaEquipamento(equipamento, form.servico),
              ancoragem: "",
              tipoBalancinho: equipamento === "Balancinho" ? form.tipoBalancinho || "Eletrico" : "",
              usaContrapeso: equipamento === "Balancinho" ? form.usaContrapeso || false : false,
              tipoMiniGrua: equipamento === "Mini Grua" ? form.tipoMiniGrua || "500kg" : "",
            });
          }}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        >
          <option value="">Equipamento</option>
          <option>Balancinho</option>
          <option>Mini Grua</option>
        </select>

        {form.equipamento === "Balancinho" && (
          <>
            <select
              value={form.tipoBalancinho ?? ""}
              onChange={(e) => setForm({ ...form, tipoBalancinho: e.target.value })}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            >
              <option value="">Tipo do Balancinho</option>
              <option value="Eletrico">Elétrico</option>
              <option value="Manual">Manual</option>
            </select>

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
          </>
        )}

        {form.equipamento === "Mini Grua" && (
          <select
            value={form.tipoMiniGrua ?? ""}
            onChange={(e) => setForm({ ...form, tipoMiniGrua: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
          >
            <option value="">Tipo da Mini Grua</option>
            <option value="500kg">500kg</option>
            <option value="1T">1T</option>
          </select>
        )}

        <select
          value={form.servico ?? ""}
          onChange={(e) => setForm({ ...form, servico: e.target.value })}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        >
          <option value="">Serviço</option>
          {servicosPermitidos.map((servico) => (
            <option key={servico}>{servico}</option>
          ))}
        </select>

        {form.equipamento === "Balancinho" &&
          form.servico !== "" &&
          form.servico !== "Deslocamento" && (
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

        {form.servico === "Deslocamento" && (
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

        {form.equipamento === "Balancinho" && (
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

        <label className="text-sm font-medium mt-2">Quantidade de Equipamentos</label>
        <input
          type="number"
          min="1"
          value={form.quantidade ?? ""}
          onChange={(e) => atualizarQuantidade(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
        />

        <div className="grid gap-3 border rounded-xl p-3 bg-gray-50">
          <h3 className="text-sm font-semibold">Números de patrimônio</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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

        {form.servico && regrasFormulario.iniciaLocacao && (
          <div className="grid gap-3 border rounded-xl p-3 bg-gray-50">
            <h3 className="text-sm font-semibold">Valores da Locação</h3>

            <label className="text-sm font-medium">Valor mensal locação</label>
            <input
              type="number"
              value={form.valorMensalLocacao ?? ""}
              onChange={(e) => atualizarCampoValor("valorMensalLocacao", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 shadow-sm bg-white text-gray-800"
            />

            {form.usaContrapeso && (
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
          className="bg-blue-500 text-white p-2 rounded-xl shadow"
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
          className="border rounded-xl p-4 shadow flex flex-col gap-2 bg-white"
        >
              <strong>{item.servico} - {formatarEquipamento(item)}</strong>
              {item.usaContrapeso && (
                <span className="inline-block w-fit rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                  CONTRAPESO
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
                      const atualizadas = atividades.map((a) =>
                        a.id === item.id
                          ? {
                              ...a,
                              dataLiberacao: new Date().toISOString().split("T")[0],
                              valoresCongelados: montarValoresCongelados(a),
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
  
