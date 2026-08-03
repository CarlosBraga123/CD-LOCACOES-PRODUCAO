import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Boxes, ChevronDown, ChevronUp, ClipboardList, TriangleAlert } from "lucide-react";
import { obterUnidadesEquipamentosAtivos } from "../utils/equipamentosAtivos";
import {
  montarControleGeralPatrimonios,
  normalizarNumeroPatrimonio,
  obterRegistrosPatrimonio,
} from "../utils/patrimoniosEquipamentos";
import PatrimonioEquipamentosModal from "./PatrimonioEquipamentosModal";
import CadastroEquipamentoMestreModal from "./CadastroEquipamentoMestreModal";
import VincularPatrimonioModal from "./VincularPatrimonioModal";
import { obterPendenciasOperacionais } from "../utils/pendenciasOperacionais";
import {
  obterAjustesConfiguracaoEquipamentos,
  obterAjustesDaUnidade,
  obterSituacaoConferenciaUnidade,
} from "../utils/ajustesConfiguracaoEquipamentos";
import {
  ajustarQuantidadeKitContrapeso,
  obterControleKitContrapeso,
} from "../utils/controleKitContrapeso";
import {
  alterarEquipamentoPatrimonio,
  equipamentoPossuiHistoricoOperacional,
  excluirEquipamentoPatrimonioSeguro,
  migrarEquipamentosConhecidos,
  obterEquipamentosPatrimonio,
  obterSubstituicoesEquipamentos,
  salvarEquipamentosPatrimonio,
  sincronizarPatrimoniosMestres,
} from "../utils/equipamentosPatrimonio";

const normalizar = (valor) =>
  String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const texto = (valor) => String(valor || "").trim();
const lerListaLocal = (chave) => {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
};
const dataBr = (data) => {
  if (!data) return "—";
  const [ano, mes, dia] = String(data).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
};
const subtipo = (item) =>
  item.equipamento === "Balancinho"
    ? item.tipoBalancinho || "Elétrico"
    : item.equipamento === "Mini Grua"
      ? item.tipoMiniGrua || ""
      : "";
const descricao = (item) =>
  [item.equipamento || "Equipamento não identificado", subtipo(item)].filter(Boolean).join(" ");
const ultimaAlteracao = (item) =>
  [
    ...(Array.isArray(item?.historico) ? item.historico : []),
    ...(Array.isArray(item?.historicoAdministrativo) ? item.historicoAdministrativo : []),
  ].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))[0];

export default function ControlePatrimonios() {
  const [abaAtiva, setAbaAtiva] = useState("inventario");
  const [atividades, setAtividades] = useState([]);
  const [obras, setObras] = useState([]);
  const [construtoras, setConstrutoras] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [equipamentosMestres, setEquipamentosMestres] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState({
    situacao: "Todos", tipo: "Todos", balancinho: "Todos",
    miniGrua: "Todos", construtora: "Todos", obra: "Todos",
  });
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [editor, setEditor] = useState(null);
  const [cadastroMestre, setCadastroMestre] = useState(undefined);
  const [situacao, setSituacao] = useState(null);
  const [pendenciaParaVincular, setPendenciaParaVincular] = useState(null);
  const [grupoAberto, setGrupoAberto] = useState(null);
  const [controleKits, setControleKits] = useState(() => obterControleKitContrapeso());
  const [ajusteKits, setAjusteKits] = useState(null);
  const [mostrarLocaisKits, setMostrarLocaisKits] = useState(false);
  const [buscaInventario, setBuscaInventario] = useState("");
  const [filtrosInventario, setFiltrosInventario] = useState({ situacao: "Todos", categoria: "Todas", construtora: "Todos", obra: "Todos" });
  const [filtrosInventarioAbertos, setFiltrosInventarioAbertos] = useState(false);
  const [categoriaInventarioAberta, setCategoriaInventarioAberta] = useState(null);
  const [versaoDados, setVersaoDados] = useState(0);

  useEffect(() => {
    setAtividades(lerListaLocal("atividades"));
    setObras(lerListaLocal("obras"));
    setConstrutoras(lerListaLocal("construtoras"));
    setRegistros(obterRegistrosPatrimonio());
    setEquipamentosMestres(obterEquipamentosPatrimonio());
  }, []);

  const ativos = useMemo(
    () => obras.flatMap((obra) =>
      obterUnidadesEquipamentosAtivos(obra, atividades, registros, equipamentosMestres).map((item) => ({
        ...item, obraId: obra.id || "", obraNome: obra.nome || "",
      }))
    ),
    [atividades, equipamentosMestres, obras, registros, versaoDados]
  );
  const consolidados = useMemo(
    () => montarControleGeralPatrimonios({
      registrosPatrimonio: registros,
      equipamentosMestres,
      equipamentosAtivos: ativos,
      construtoras,
      obras,
    }),
    [ativos, construtoras, equipamentosMestres, obras, registros]
  );
  useEffect(() => {
    const migracao = migrarEquipamentosConhecidos({
      equipamentos: equipamentosMestres,
      registrosPatrimonio: registros,
      equipamentosAtivos: ativos,
    });
    if (migracao.alterado) {
      salvarEquipamentosPatrimonio(migracao.equipamentos);
      setEquipamentosMestres(migracao.equipamentos);
    }
  }, [ativos, equipamentosMestres, registros]);
  const ajustesConfiguracao = useMemo(
    () => obterAjustesConfiguracaoEquipamentos(),
    [equipamentosMestres, registros, versaoDados]
  );
  const categoriaDoItem = (item) => {
    const equipamento = normalizar(item.equipamento);
    if (equipamento.includes("kit") && equipamento.includes("contrapeso")) return null;
    if (equipamento.includes("mini grua")) {
      return normalizar(item.tipoMiniGrua).includes("1t") ? "Mini Grua 1 T" : "Mini Grua 500 kg";
    }
    return normalizar(item.tipoBalancinho).includes("manual")
      ? "Balancinho Manual"
      : "Balancinho Elétrico";
  };
  const pendenteConferencia = (item) => {
    if (item.situacao !== "LOCADO") return false;
    if (!item.numeroPatrimonioAtual) return true;
    if (item.equipamento !== "Balancinho") return false;
    const possuiConferencia = obterAjustesDaUnidade(item, ajustesConfiguracao).length > 0;
    return !item.tamanho || (!possuiConferencia && item.usaContrapeso !== true);
  };
  const patrimoniosIndividuais = useMemo(
    () => consolidados.filter((item) => categoriaDoItem(item) !== null),
    [consolidados]
  );
  const indicadores = useMemo(() => ({
    total: patrimoniosIndividuais.length,
    eletricos: patrimoniosIndividuais.filter((item) => categoriaDoItem(item) === "Balancinho Elétrico").length,
    manuais: patrimoniosIndividuais.filter((item) => categoriaDoItem(item) === "Balancinho Manual").length,
    miniGruas: patrimoniosIndividuais.filter((item) => categoriaDoItem(item).startsWith("Mini Grua")).length,
    kits: controleKits.quantidadeTotal,
    locados: patrimoniosIndividuais.filter((item) => item.situacao === "LOCADO").length,
    galpao: patrimoniosIndividuais.filter((item) => item.situacao === "NO_GALPAO").length,
    pendentes: patrimoniosIndividuais.filter(pendenteConferencia).length,
  }), [ajustesConfiguracao, controleKits.quantidadeTotal, patrimoniosIndividuais]);
  const kitsLocados = useMemo(
    () => ativos.filter((item) => item.equipamento === "Balancinho" && item.usaContrapeso === true).length,
    [ativos]
  );
  const resumoKits = {
    total: controleKits.quantidadeTotal,
    locados: kitsLocados,
    galpao: Math.max(0, controleKits.quantidadeTotal - kitsLocados),
    pendentes: Math.max(0, kitsLocados - controleKits.quantidadeTotal),
  };
  const locaisKits = useMemo(() => {
    const porObra = new Map();
    ativos
      .filter((item) => item.equipamento === "Balancinho" && item.usaContrapeso === true)
      .forEach((item) => {
        const obra = obras.find((candidata) => String(candidata.id) === String(item.obraId));
        const construtora = construtoras.find((candidata) =>
          obra?.construtoraId && candidata?.id
            ? String(candidata.id) === String(obra.construtoraId)
            : normalizar(candidata?.nome) === normalizar(obra?.construtora)
        );
        const chave = String(item.obraId || item.obraNome || "sem-obra");
        const atual = porObra.get(chave) || {
          obra: item.obraNome || obra?.nome || "Obra não localizada",
          construtora: construtora?.nome || obra?.construtora || "Construtora não localizada",
          quantidade: 0,
        };
        atual.quantidade += 1;
        porObra.set(chave, atual);
      });
    return [...porObra.values()].sort((a, b) =>
      a.construtora.localeCompare(b.construtora, "pt-BR") ||
      a.obra.localeCompare(b.obra, "pt-BR")
    );
  }, [ativos, construtoras, obras]);
  const itemConferidoInventario = (item) => {
    return obterSituacaoConferenciaUnidade(
      item,
      registros,
      ajustesConfiguracao
    ).status === "conferido";
  };
  const pendenciasOperacionais = useMemo(
    () => obterPendenciasOperacionais(atividades),
    [atividades]
  );
  const inventarioGeral = useMemo(() => {
    const individuais = patrimoniosIndividuais;
    const semPatrimonio = individuais.filter((item) => !item.numeroPatrimonioAtual).length;
    const conferenciaPendente = individuais.filter((item) => !itemConferidoInventario(item)).length;
    return {
      total: individuais.length + resumoKits.total,
      locados: individuais.filter((item) => item.situacao === "LOCADO").length + resumoKits.locados,
      galpao: individuais.filter((item) => item.situacao === "NO_GALPAO").length + resumoKits.galpao,
      manutencao: individuais.filter((item) => item.situacao === "EM_MANUTENCAO").length,
      indisponiveis: individuais.filter((item) => item.situacao === "INDISPONIVEL").length,
      semLocalizacao: individuais.filter((item) => item.situacao === "SEM_LOCALIZACAO_ATUAL").length,
      baixados: individuais.filter((item) => item.situacao === "BAIXADO").length,
      semPatrimonio,
      conferenciaPendente,
      vinculosPendentes: pendenciasOperacionais.length,
      conferidos: individuais.length - conferenciaPendente,
      individuais: individuais.length,
    };
  }, [ajustesConfiguracao, patrimoniosIndividuais, pendenciasOperacionais.length, resumoKits.galpao, resumoKits.locados, resumoKits.total]);
  const percentualInventario = inventarioGeral.individuais
    ? Math.round((inventarioGeral.conferidos / inventarioGeral.individuais) * 100)
    : 100;
  const resumoTopoInventario = useMemo(() => ({
    equipamentosCadastrados: patrimoniosIndividuais.filter(
      (item) => item.situacao !== "BAIXADO"
    ).length,
    emObras: patrimoniosIndividuais.filter(
      (item) => item.situacao === "LOCADO"
    ).length,
    noGalpao: patrimoniosIndividuais.filter(
      (item) => item.situacao === "NO_GALPAO"
    ).length,
  }), [patrimoniosIndividuais]);
  const obrasInventario = useMemo(() => obras.filter((obra) =>
    filtrosInventario.construtora === "Todos" ||
    String(obra.construtoraId || "") === filtrosInventario.construtora ||
    normalizar(obra.construtora) === normalizar(construtoras.find((item) => String(item.id) === filtrosInventario.construtora)?.nome)
  ), [construtoras, filtrosInventario.construtora, obras]);
  const inventarioFiltrado = useMemo(() => {
    const termo = normalizar(buscaInventario);
    return patrimoniosIndividuais.filter((item) => {
      const categoria = categoriaDoItem(item);
      const pendente = !itemConferidoInventario(item);
      const buscaOk = !termo || [item.numeroPatrimonioAtual, ...(item.numerosAnteriores || []), categoria, item.situacao, item.construtoraNome, item.obraNome, item.observacao].some((valor) => normalizar(valor).includes(termo));
      const situacaoOk = filtrosInventario.situacao === "Todos" || (filtrosInventario.situacao === "PENDENTES" ? pendente : item.situacao === filtrosInventario.situacao);
      return buscaOk && situacaoOk &&
        (filtrosInventario.categoria === "Todas" || categoria === filtrosInventario.categoria) &&
        (filtrosInventario.construtora === "Todos" || String(item.construtoraId || "") === filtrosInventario.construtora) &&
        (filtrosInventario.obra === "Todos" || String(item.obraId || "") === filtrosInventario.obra);
    });
  }, [ajustesConfiguracao, buscaInventario, filtrosInventario, patrimoniosIndividuais]);
  const locaisKitsInventarioFiltrados = useMemo(() => locaisKits.filter((local) =>
    (filtrosInventario.construtora === "Todos" || normalizar(local.construtora) === normalizar(construtoras.find((item) => String(item.id) === filtrosInventario.construtora)?.nome)) &&
    (filtrosInventario.obra === "Todos" || normalizar(local.obra) === normalizar(obras.find((item) => String(item.id) === filtrosInventario.obra)?.nome))
  ), [construtoras, filtrosInventario.construtora, filtrosInventario.obra, locaisKits, obras]);
  const kitVisivelInventario = useMemo(() => {
    if (!["Todas", "Kit Contrapeso"].includes(filtrosInventario.categoria)) return false;
    if (filtrosInventario.situacao === "PENDENTES") return resumoKits.pendentes > 0;
    if (!["Todos", "LOCADO", "NO_GALPAO"].includes(filtrosInventario.situacao)) return false;
    if (filtrosInventario.situacao === "LOCADO" && resumoKits.locados === 0) return false;
    if (filtrosInventario.situacao === "NO_GALPAO" && resumoKits.galpao === 0) return false;
    if ((filtrosInventario.construtora !== "Todos" || filtrosInventario.obra !== "Todos") && locaisKitsInventarioFiltrados.length === 0) return false;
    const termo = normalizar(buscaInventario);
    return !termo || normalizar("Kit Contrapeso").includes(termo) || locaisKitsInventarioFiltrados.some((local) => normalizar(`${local.construtora} ${local.obra}`).includes(termo));
  }, [buscaInventario, filtrosInventario, locaisKitsInventarioFiltrados, resumoKits.galpao, resumoKits.locados, resumoKits.pendentes]);
  const obrasDoFiltro = useMemo(
    () => obras.filter((obra) =>
      filtros.construtora === "Todos" ||
      String(obra.construtoraId || "") === filtros.construtora ||
      normalizar(obra.construtora) === normalizar(
        construtoras.find((item) => String(item.id) === filtros.construtora)?.nome
      )
    ),
    [construtoras, filtros.construtora, obras]
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    const resultado = patrimoniosIndividuais.filter((item) => {
      const encontrouAntigo = (item.numerosAnteriores || []).some((numero) => normalizar(numero).includes(termo));
      const correspondeBusca = !termo || encontrouAntigo || [
        item.numeroPatrimonioAtual, item.construtoraNome, item.obraNome,
        item.equipamento, subtipo(item), item.tamanho,
      ].some((valor) => normalizar(valor).includes(termo));
      const correspondeSituacao =
        filtros.situacao === "Todos" ||
        (filtros.situacao === "SUBSTITUÍDO"
          ? (item.numerosAnteriores || []).length > 0
          : filtros.situacao === "SEM PATRIMÔNIO"
            ? !item.numeroPatrimonioAtual
            : item.situacao === filtros.situacao);
      return correspondeBusca && correspondeSituacao &&
        (filtros.tipo === "Todos" || item.equipamento === filtros.tipo) &&
        (filtros.balancinho === "Todos" || item.equipamento !== "Balancinho" || (item.tipoBalancinho || "Elétrico") === filtros.balancinho) &&
        (filtros.miniGrua === "Todos" || item.equipamento !== "Mini Grua" || item.tipoMiniGrua === filtros.miniGrua) &&
        (filtros.construtora === "Todos" || String(item.construtoraId) === filtros.construtora) &&
        (filtros.obra === "Todos" || String(item.obraId) === filtros.obra);
    });
    return resultado.sort((a, b) => {
      const grupo = (item) => !item.numeroPatrimonioAtual ? 0 : item.situacao === "LOCADO" ? 1 : item.situacao === "NO_GALPAO" ? 2 : 3;
      const porGrupo = grupo(a) - grupo(b);
      if (porGrupo) return porGrupo;
      if (!a.numeroPatrimonioAtual || !b.numeroPatrimonioAtual) {
        const local = `${a.construtoraNome}|${a.obraNome}`.localeCompare(`${b.construtoraNome}|${b.obraNome}`, "pt-BR");
        if (local) return local;
      }
      const porNumero = String(a.numeroPatrimonioAtual || "").localeCompare(String(b.numeroPatrimonioAtual || ""), "pt-BR", { numeric: true });
      return porNumero || a.ordemOriginal - b.ordemOriginal;
    });
  }, [busca, filtros, patrimoniosIndividuais]);

  const abrirEditor = (item) => {
    const obra = obras.find((candidata) => String(candidata.id) === String(item.obraId));
    const construtora = construtoras.find((candidata) => String(candidata.id) === String(item.construtoraId));
    setEditor({ modo: "obra", obra: obra || { id: item.obraId, nome: item.obraNome }, construtora, itens: [item] });
  };
  const confirmarSituacao = () => {
    if (!situacao?.nova || !situacao.data || !situacao.motivo.trim()) {
      alert("Informe a situação, a data e o motivo.");
      return;
    }
    if (situacao.item.situacao === "LOCADO" && situacao.nova === "NO_GALPAO") {
      alert("Equipamento locado não pode ser enviado manualmente ao galpão.");
      return;
    }
    const atualizados = alterarEquipamentoPatrimonio({
      equipamentos: equipamentosMestres,
      idEquipamento: situacao.item.idEquipamento,
      alteracoes: {
        situacaoAdministrativa: situacao.nova,
        ativo: situacao.nova !== "BAIXADO",
      },
      data: situacao.data,
      motivo: situacao.motivo,
      observacao: situacao.observacao,
      tipo: situacao.nova === "BAIXADO" ? "baixa" : "mudanca_situacao",
    });
    salvarEquipamentosPatrimonio(atualizados);
    setEquipamentosMestres(atualizados);
    setSituacao(null);
  };
  const exportar = () => {
    const linhas = visiveis.map((item) => {
      const ultimo = ultimaAlteracao(item);
      return {
        Patrimônio: item.numeroPatrimonioAtual || "Sem patrimônio",
        Situação: item.situacao,
        Equipamento: item.equipamento || "",
        Subtipo: subtipo(item),
        "Configuração atual - tamanho":
          item.situacao === "LOCADO" ? item.tamanho || "" : "",
        "Configuração atual - ancoragem":
          item.situacao === "LOCADO" ? item.ancoragem || "" : "",
        "Localização atual": item.obraNome
          ? `${item.construtoraNome} / ${item.obraNome}`
          : item.situacao === "NO_GALPAO"
            ? "Galpão"
            : "Sem localização atual",
        Construtora: item.construtoraNome || "",
        Obra: item.obraNome || "",
        "Data de cadastro": item.dataCadastro || "",
        "Números anteriores": (item.numerosAnteriores || []).join(", "),
        "Última movimentação":
          [...(Array.isArray(item.historicoAdministrativo) ? item.historicoAdministrativo : [])].sort((a, b) =>
            String(b.data || "").localeCompare(String(a.data || ""))
          )[0]?.data || ultimo?.data || "",
        Observação: item.observacao || ultimo?.observacao || "",
      };
    });
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const arquivo = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(arquivo, planilha, "Patrimônios");
    XLSX.writeFile(arquivo, "controle-patrimonios.xlsx");
  };
  const buscaAntiga = (item) =>
    (item.numerosAnteriores || []).find((numero) => normalizar(numero).includes(normalizar(busca)));
  const atividadesDoDetalhe = detalhe
    ? atividades
        .filter((atividade) =>
          (Array.isArray(atividade.itensEquipamentos) ? atividade.itensEquipamentos : []).some(
            (item) =>
              (detalhe.idEquipamento &&
                String(item.idEquipamento || "") === String(detalhe.idEquipamento)) ||
              (detalhe.idItem &&
                (String(item.idItem || "") === String(detalhe.idItem) ||
                  String(item.idItemOrigem || "") === String(detalhe.idItem)))
          )
        )
        .sort((a, b) =>
          String(b.dataLiberacao || b.dataAgendamento || "").localeCompare(
            String(a.dataLiberacao || a.dataAgendamento || "")
          )
        )
    : [];
  const grupos = useMemo(() => {
    const ordem = ["Balancinho Elétrico", "Balancinho Manual", "Kit Contrapeso", "Mini Grua 500 kg", "Mini Grua 1 T"];
    return ordem.map((nome) => {
      if (nome === "Kit Contrapeso") {
        return {
          nome,
          kit: true,
          itens: [],
          total: resumoKits.total,
          locados: resumoKits.locados,
          galpao: resumoKits.galpao,
        };
      }
      const itens = visiveis.filter((item) => categoriaDoItem(item) === nome);
      return {
        nome,
        itens,
        total: itens.length,
        locados: itens.filter((item) => item.situacao === "LOCADO").length,
        galpao: itens.filter((item) => item.situacao === "NO_GALPAO").length,
      };
    });
  }, [resumoKits.galpao, resumoKits.locados, resumoKits.total, visiveis]);
  const excluirEquipamento = (item) => {
    if (item.situacao === "LOCADO") return alert("Este equipamento está locado.");
    if (equipamentoPossuiHistoricoOperacional(item, atividades)) {
      return alert("Este equipamento possui histórico operacional.\n\nUtilize a opção Inativar quando disponível.");
    }
    if (item.situacao !== "NO_GALPAO") {
      return alert("Somente equipamentos no galpão podem ser excluídos.");
    }
    if (!window.confirm("Excluir permanentemente este equipamento?")) return;
    try {
      const resultado = excluirEquipamentoPatrimonioSeguro({
        equipamento: item,
        equipamentos: equipamentosMestres,
        registrosPatrimonio: registros,
        ajustesConfiguracao,
        substituicoes: obterSubstituicoesEquipamentos(),
        atividades,
      });
      setEquipamentosMestres(resultado.equipamentos);
      setRegistros(resultado.registros);
      if (detalhe?.idEquipamento === item.idEquipamento) setDetalhe(null);
    } catch (erro) {
      alert(erro.message || "Não foi possível excluir o equipamento.");
    }
  };
  const salvarAjusteKits = () => {
    try {
      const atualizado = ajustarQuantidadeKitContrapeso({
        controle: controleKits,
        quantidadeNova: ajusteKits.quantidadeTotal,
        data: ajusteKits.data,
        motivo: ajusteKits.motivo,
        observacao: ajusteKits.observacao,
      });
      setControleKits(atualizado);
      setAjusteKits(null);
    } catch (erro) {
      alert(erro.message || "Não foi possível ajustar a quantidade.");
    }
  };
  const categoriasInventario = ["Balancinho Elétrico", "Balancinho Manual", "Kit Contrapeso", "Mini Grua 500 kg", "Mini Grua 1 T"].map((nome) => {
    if (nome === "Kit Contrapeso") return { nome, kit: true, total: resumoKits.total, locados: resumoKits.locados, galpao: resumoKits.galpao };
    const todos = patrimoniosIndividuais.filter((item) => categoriaDoItem(item) === nome);
    return {
      nome,
      todos,
      itens: inventarioFiltrado.filter((item) => categoriaDoItem(item) === nome),
      total: todos.length,
      locados: todos.filter((item) => item.situacao === "LOCADO").length,
      galpao: todos.filter((item) => item.situacao === "NO_GALPAO").length,
      manutencao: todos.filter((item) => item.situacao === "EM_MANUTENCAO").length,
      indisponiveis: todos.filter((item) => item.situacao === "INDISPONIVEL").length,
      pendentes: todos.filter((item) => !itemConferidoInventario(item)).length,
    };
  });
  const exportarInventario = () => {
    const linhasEquipamentos = inventarioFiltrado.map((item) => ({
      Patrimônio: item.numeroPatrimonioAtual || "Sem patrimônio",
      Categoria: categoriaDoItem(item),
      Situação: item.situacao,
      Construtora: item.construtoraNome || "",
      Obra: item.obraNome || "",
      "Tamanho atual": item.tamanho || "",
      "Ancoragem atual": item.ancoragem || "",
      "Contrapeso atual": item.equipamento === "Balancinho" ? (item.usaContrapeso ? "Sim" : "Não") : "",
      "Data da última conferência": item.dataUltimaConferencia || "",
      Pendência: itemConferidoInventario(item) ? "" : "Conferência pendente",
      Observação: item.observacao || "",
    }));
    const locaisExportados = kitVisivelInventario ? locaisKitsInventarioFiltrados.filter((local) => {
      const termo = normalizar(buscaInventario);
      return !termo || normalizar(`Kit Contrapeso ${local.construtora} ${local.obra}`).includes(termo);
    }) : [];
    const linhasKits = (locaisExportados.length ? locaisExportados : kitVisivelInventario ? [{ construtora: "", obra: "", quantidade: 0 }] : []).map((local) => ({
      "Quantidade total": resumoKits.total,
      "Quantidade locada": resumoKits.locados,
      "Quantidade no galpão": resumoKits.galpao,
      Construtora: local.construtora,
      Obra: local.obra,
      "Quantidade locada por obra": local.quantidade,
    }));
    const arquivo = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(linhasEquipamentos), "Equipamentos Individuais");
    XLSX.utils.book_append_sheet(arquivo, XLSX.utils.json_to_sheet(linhasKits), "Kits Contrapeso");
    XLSX.writeFile(arquivo, "inventario-geral.xlsx");
  };

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Controle de Patrimônios</h2>
        <div className="flex gap-2"><button type="button" onClick={() => setCadastroMestre(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Novo equipamento</button><button type="button" onClick={exportar} className="rounded-lg border bg-white px-4 py-2 text-sm text-blue-700">Exportar Excel</button></div>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-xl border bg-gray-50 p-2 sm:grid-cols-3">
        {[["inventario", "Inventário Geral", Boxes], ["equipamentos", "Equipamentos", ClipboardList], ["pendencias", "Pendências Operacionais", TriangleAlert]].map(([valor, rotulo, Icone]) => <button key={valor} type="button" onClick={() => setAbaAtiva(valor)} className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${abaAtiva === valor ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}><Icone className="h-5 w-5" />{rotulo}</button>)}
      </div>
      {abaAtiva === "inventario" && <>
        <section className="flex flex-col gap-2 rounded-xl border bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-blue-700" /><h3 className="font-bold">INVENTÁRIO GERAL</h3></div><div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700"><p>Equipamentos principais: <strong>{resumoTopoInventario.equipamentosCadastrados}</strong></p><p>Kits Contrapeso: <strong>{resumoKits.total}</strong></p></div></section>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Equipamentos Cadastrados", resumoTopoInventario.equipamentosCadastrados], ["Em Obras", resumoTopoInventario.emObras], ["No Galpão", resumoTopoInventario.noGalpao], ["Conferência Pendente", inventarioGeral.conferenciaPendente]].map(([rotulo, valor]) => <div key={rotulo} className={`rounded-xl border p-3 ${rotulo === "Conferência Pendente" ? "bg-amber-50" : "bg-gray-50"}`}><p className={`text-xs ${rotulo === "Conferência Pendente" ? "text-amber-900" : "text-gray-500"}`}>{rotulo}</p><p className="text-2xl font-bold text-blue-700">{valor}</p></div>)}
        </div>
        <section className="rounded-xl border bg-white p-4"><div className="flex items-end justify-between gap-3"><div><h3 className="font-bold">Progresso da conferência patrimonial</h3><p className="text-sm text-gray-600">{inventarioGeral.conferidos} de {inventarioGeral.individuais} equipamentos conferidos</p></div><p className="text-2xl font-bold text-blue-700">{percentualInventario}%</p></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-green-600" style={{ width: `${percentualInventario}%` }} /></div></section>
        <div className="flex flex-col gap-2 sm:flex-row"><input value={buscaInventario} onChange={(e) => setBuscaInventario(e.target.value)} placeholder="Buscar patrimônio, categoria, situação, construtora ou obra" className="min-w-0 flex-1 rounded-xl border p-3" /><button type="button" onClick={exportarInventario} className="rounded-lg bg-blue-600 px-4 py-3 text-sm text-white">Exportar Inventário</button></div>
        <button type="button" onClick={() => setFiltrosInventarioAbertos(!filtrosInventarioAbertos)} className="w-full rounded-lg border px-3 py-2 text-left text-sm sm:hidden">Filtros {filtrosInventarioAbertos ? "▲" : "▼"}</button>
        <div className={`${filtrosInventarioAbertos ? "grid" : "hidden"} grid-cols-1 gap-2 rounded-xl border bg-gray-50 p-3 sm:grid sm:grid-cols-4`}><select value={filtrosInventario.situacao} onChange={(e) => setFiltrosInventario({ ...filtrosInventario, situacao: e.target.value })} className="rounded border p-2"><option value="Todos">Todas as situações</option><option value="LOCADO">Locados</option><option value="NO_GALPAO">No galpão</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="INDISPONIVEL">Indisponíveis</option><option value="SEM_LOCALIZACAO_ATUAL">Sem localização</option><option value="BAIXADO">Baixados</option><option value="PENDENTES">Pendentes</option></select><select value={filtrosInventario.categoria} onChange={(e) => setFiltrosInventario({ ...filtrosInventario, categoria: e.target.value })} className="rounded border p-2"><option>Todas</option>{["Balancinho Elétrico", "Balancinho Manual", "Kit Contrapeso", "Mini Grua 500 kg", "Mini Grua 1 T"].map((categoria) => <option key={categoria}>{categoria}</option>)}</select><select value={filtrosInventario.construtora} onChange={(e) => setFiltrosInventario({ ...filtrosInventario, construtora: e.target.value, obra: "Todos" })} className="rounded border p-2"><option value="Todos">Todas as construtoras</option>{construtoras.map((item) => <option key={item.id || item.nome} value={item.id || ""}>{item.nome}</option>)}</select><select value={filtrosInventario.obra} onChange={(e) => setFiltrosInventario({ ...filtrosInventario, obra: e.target.value })} className="rounded border p-2"><option value="Todos">Todas as obras</option>{obrasInventario.map((item) => <option key={item.id || item.nome} value={item.id || ""}>{item.nome}</option>)}</select></div>
        <div className="space-y-3">{categoriasInventario.map((categoria) => {
          if (categoria.kit && !kitVisivelInventario) return null;
          if (!categoria.kit && filtrosInventario.categoria !== "Todas" && filtrosInventario.categoria !== categoria.nome) return null;
          const aberto = categoriaInventarioAberta === categoria.nome;
          return <section key={categoria.nome} className={`overflow-hidden rounded-xl border ${aberto ? "border-blue-300 bg-blue-50" : "bg-gray-50"}`}><button type="button" onClick={() => setCategoriaInventarioAberta(aberto ? null : categoria.nome)} className="flex min-h-[64px] w-full items-center justify-between gap-3 p-4 text-left"><span><strong className="block">{categoria.nome}</strong><span className="text-sm text-gray-600">Total: {categoria.total} • Locados: {categoria.locados} • Galpão: {categoria.galpao}{!categoria.kit && ` • Manutenção: ${categoria.manutencao} • Indisponíveis: ${categoria.indisponiveis} • Pendentes: ${categoria.pendentes}`}</span></span>{aberto ? <ChevronUp className="h-5 w-5 shrink-0 text-blue-700" /> : <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />}</button>{aberto && <div className="space-y-2 border-t border-blue-200 p-3">{categoria.kit ? <><div className="grid grid-cols-3 gap-2">{[["Total", resumoKits.total], ["Locados", resumoKits.locados], ["Galpão", resumoKits.galpao]].map(([r, v]) => <div key={r} className="rounded border bg-white p-2 text-center"><p className="text-xs text-gray-500">{r}</p><p className="text-xl font-bold">{v}</p></div>)}</div>{locaisKitsInventarioFiltrados.map((local) => <div key={`${local.construtora}-${local.obra}`} className="rounded border bg-white p-3 text-sm"><strong>{local.construtora}</strong><p>{local.obra} • {local.quantidade} {local.quantidade === 1 ? "Kit" : "Kits"}</p></div>)}{controleKits.historico.length > 0 && <details className="rounded border bg-white p-3"><summary className="cursor-pointer font-semibold">Histórico quantitativo</summary>{[...controleKits.historico].reverse().map((evento) => <p key={evento.id} className="mt-2 text-sm">{dataBr(evento.data)} • {evento.quantidadeAnterior} → {evento.quantidadeNova} • {evento.motivo}</p>)}</details>}</> : categoria.itens.length ? categoria.itens.map((item) => { const ultimo = ultimaAlteracao(item); return <div key={item.idEquipamento || item.idItem} className="rounded-lg border bg-white p-3 text-sm"><div className="flex justify-between gap-2"><strong className="font-mono text-blue-700">{item.numeroPatrimonioAtual || "Sem patrimônio"}</strong><span>{item.situacao}</span></div><p>{item.construtoraNome && `${item.construtoraNome} • `}{item.obraNome || (item.situacao === "NO_GALPAO" ? "Galpão" : "Sem localização atual")}</p><p className="text-gray-500">Última movimentação: {dataBr(ultimo?.data)}</p>{!itemConferidoInventario(item) && <p className="mt-1 text-amber-700">Conferência pendente</p>}</div>}) : <p className="text-sm text-gray-500">Nenhum equipamento corresponde aos filtros.</p>}</div>}</section>;
        })}</div>
      </>}
      {abaAtiva === "equipamentos" && <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Total Patrimônios", indicadores.total],
          ["Balancinhos Elétricos", indicadores.eletricos],
          ["Balancinhos Manuais", indicadores.manuais],
          ["Mini Gruas", indicadores.miniGruas],
          ["Kits Contrapeso", indicadores.kits],
          ["Locados", indicadores.locados],
          ["No Galpão", indicadores.galpao],
          ["Pendentes de Conferência", indicadores.pendentes],
        ].map(([rotulo, valor]) => <div key={rotulo} className="rounded-xl border bg-gray-50 p-3"><p className="text-xs text-gray-500">{rotulo}</p><p className="text-2xl font-bold text-blue-700">{valor}</p></div>)}
      </div>
      </>}
      {abaAtiva === "pendencias" && (
      <section className="rounded-xl border bg-amber-50 p-3">
        <h3 className="font-semibold text-amber-900">Pendências Operacionais ({pendenciasOperacionais.length})</h3>
        {pendenciasOperacionais.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Nenhuma pendência operacional.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {pendenciasOperacionais.map(({ atividade, resumo }) => (
              <div key={atividade.id} className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold">{atividade.servico} • {atividade.equipamento}</p>
                  <p>{atividade.construtora} • {atividade.obra}</p>
                  <p className="text-gray-500">{dataBr(atividade.dataLiberacao || atividade.dataAgendamento)} • {atividade.equipeResponsavel || "Sem responsável"}</p>
                  <p className="text-amber-700">{resumo.total} equipamento(s) • Vinculados: {resumo.vinculados} • Pendentes: {resumo.pendentes}</p>
                </div>
                <button type="button" onClick={() => setPendenciaParaVincular(atividade)} className="rounded border px-3 py-2 text-sm text-amber-700">Vincular patrimônio</button>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
      {abaAtiva === "equipamentos" && <>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar patrimônio, obra, construtora ou equipamento" className="w-full rounded-xl border p-3" />
      <button type="button" onClick={() => setFiltrosAbertos(!filtrosAbertos)} className="w-full rounded-lg border px-3 py-2 text-left text-sm sm:hidden">Filtros {filtrosAbertos ? "▲" : "▼"}</button>
      <div className={`${filtrosAbertos ? "grid" : "hidden"} grid-cols-1 gap-2 rounded-xl border bg-gray-50 p-3 sm:grid sm:grid-cols-3 lg:grid-cols-6`}>
        <select value={filtros.situacao} onChange={(e) => setFiltros({ ...filtros, situacao: e.target.value })} className="rounded border p-2"><option value="Todos">Todos</option><option value="NO_GALPAO">No galpão</option><option value="LOCADO">Locados</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="INDISPONIVEL">Indisponível</option><option value="SEM_LOCALIZACAO_ATUAL">Sem localização atual</option><option value="BAIXADO">Baixado</option><option value="SEM PATRIMÔNIO">Sem patrimônio</option><option value="SUBSTITUÍDO">Substituídos</option></select>
        <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} className="rounded border p-2"><option>Todos</option><option>Balancinho</option><option>Mini Grua</option></select>
        <select value={filtros.balancinho} disabled={filtros.tipo === "Mini Grua"} onChange={(e) => setFiltros({ ...filtros, balancinho: e.target.value })} className="rounded border p-2"><option>Todos</option><option value="Eletrico">Elétrico</option><option>Manual</option></select>
        <select value={filtros.miniGrua} disabled={filtros.tipo === "Balancinho"} onChange={(e) => setFiltros({ ...filtros, miniGrua: e.target.value })} className="rounded border p-2"><option>Todos</option><option value="500kg">500 kg</option><option value="1T">1 T</option></select>
        <select value={filtros.construtora} onChange={(e) => setFiltros({ ...filtros, construtora: e.target.value, obra: "Todos" })} className="rounded border p-2"><option>Todos</option>{construtoras.map((item) => <option key={item.id || item.nome} value={item.id || ""}>{item.nome}</option>)}</select>
        <select value={filtros.obra} onChange={(e) => setFiltros({ ...filtros, obra: e.target.value })} className="rounded border p-2"><option>Todos</option>{obrasDoFiltro.map((item) => <option key={item.id || item.nome} value={item.id || ""}>{item.nome}</option>)}</select>
      </div>
      <p className="text-sm text-gray-500">{visiveis.length} equipamento(s) encontrado(s)</p>
      <div className="space-y-3">
        {grupos.map((grupo) => {
          const aberto = grupoAberto === grupo.nome;
          return <section key={grupo.nome} className={`overflow-hidden rounded-xl border transition-colors ${aberto ? "border-blue-300 bg-blue-50" : "bg-gray-50"}`}>
            <button type="button" aria-expanded={aberto} onClick={() => setGrupoAberto(aberto ? null : grupo.nome)} className="flex min-h-[64px] w-full items-center justify-between gap-3 p-4 text-left">
              <span className="min-w-0"><span className={`block font-bold ${aberto ? "text-blue-950" : "text-gray-900"}`}>{grupo.nome}</span><span className={`block text-sm sm:inline ${aberto ? "text-blue-700" : "text-gray-500"}`}>Total: {grupo.total} • Locados: {grupo.locados} • Galpão: {grupo.galpao}</span></span>
              {aberto ? <ChevronUp aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" /> : <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500" />}
            </button>
            {aberto && grupo.kit && <div className="space-y-3 border-t border-blue-200 p-3 sm:p-4">
              <p className="text-sm text-blue-800">Estoque controlado por quantidade, sem patrimônio individual.</p>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setAjusteKits({ quantidadeTotal: String(controleKits.quantidadeTotal), data: new Date().toISOString().slice(0, 10), motivo: "", observacao: "" })} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">Ajustar quantidade</button><button type="button" onClick={() => setMostrarLocaisKits(true)} className="rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-800">Ver onde estão locados</button></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Total cadastrado", resumoKits.total], ["Locados", resumoKits.locados], ["No galpão", resumoKits.galpao], ["Pendentes", resumoKits.pendentes]].map(([rotulo, valor]) => <div key={rotulo} className="rounded-lg border bg-white p-3"><p className="text-xs text-gray-500">{rotulo}</p><p className="text-2xl font-bold text-blue-700">{valor}</p></div>)}</div>
              {controleKits.historico.length > 0 && <details className="rounded-lg border bg-white p-3"><summary className="cursor-pointer font-semibold">Histórico de ajustes</summary><div className="mt-2 space-y-2">{[...controleKits.historico].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).map((evento) => <div key={evento.id} className="rounded border bg-gray-50 p-2 text-sm"><p className="font-medium">{dataBr(evento.data)} — {evento.quantidadeAnterior} → {evento.quantidadeNova}</p><p>{evento.motivo}</p>{evento.observacao && <p className="text-gray-600">{evento.observacao}</p>}</div>)}</div></details>}
            </div>}
            {aberto && !grupo.kit && <div className="grid grid-cols-1 gap-3 border-t border-blue-200 p-3 lg:grid-cols-2">
            {grupo.itens.length === 0 && <p className="text-sm text-gray-500">Nenhum equipamento neste grupo.</p>}
            {grupo.itens.map((item) => {
          const ultimo = ultimaAlteracao(item);
          const antigo = buscaAntiga(item);
          return (
            <article key={item.idEquipamento || item.idItem} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-mono text-2xl font-bold text-blue-700">{item.numeroPatrimonioAtual || "Sem patrimônio"}</p><p className="font-semibold">{descricao(item)}</p></div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold">{item.situacao}</span>
              </div>
              {antigo && <div className="mt-2 rounded bg-amber-50 p-2 text-sm"><strong>Patrimônio pesquisado:</strong> {antigo}<br />Situação do número: Substituído<br />Patrimônio atual: {item.numeroPatrimonioAtual}</div>}
              {!antigo && filtros.situacao === "SUBSTITUÍDO" && (
                <div className="mt-2 rounded bg-amber-50 p-2 text-sm">
                  <strong>Números substituídos:</strong> {(item.numerosAnteriores || []).join(", ")}
                  <br />Patrimônio atual do equipamento: {item.numeroPatrimonioAtual || "Sem patrimônio"}
                </div>
              )}
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {item.obraNome && <p>{item.construtoraNome} • {item.obraNome}</p>}
                {item.situacao === "LOCADO" &&
                  (item.tamanho || item.ancoragem || item.usaContrapeso) && (
                    <div className="mt-2 rounded bg-blue-50 p-2">
                      <p className="font-semibold text-blue-900">Configuração atual da locação</p>
                      {item.tamanho && <p>Tamanho: {item.tamanho} m</p>}
                      {item.ancoragem && <p>Ancoragem: {item.ancoragem}</p>}
                      <p>{item.usaContrapeso ? "Com contrapeso" : "Sem contrapeso"}</p>
                    </div>
                  )}
                <p>Última alteração: {dataBr(ultimo?.data)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setDetalhe(item)} className="rounded border px-3 py-2 text-sm">Ver detalhes</button>
                {item.idEquipamento && <button type="button" onClick={() => setCadastroMestre(item)} className="rounded border px-3 py-2 text-sm">Editar</button>}
                <button type="button" onClick={() => abrirEditor({ ...item, numeroPatrimonio: item.numeroPatrimonioAtual })} className="rounded border px-3 py-2 text-sm text-blue-700">{item.numeroPatrimonioAtual ? "Trocar patrimônio" : "Cadastrar patrimônio"}</button>
                {item.idEquipamento && item.situacao !== "LOCADO" && <button type="button" onClick={() => setSituacao({ item, nova: item.situacao, data: new Date().toISOString().slice(0,10), motivo: "", observacao: "" })} className="rounded border px-3 py-2 text-sm">Alterar situação</button>}
                {item.idEquipamento && <button type="button" onClick={() => excluirEquipamento(item)} className="rounded border border-red-200 px-3 py-2 text-sm text-red-700">Excluir</button>}
              </div>
            </article>
          );
        })}
            </div>}
          </section>;
        })}
      </div>
      </>}
      {detalhe && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-2xl sm:rounded-2xl">
            <h3 className="text-lg font-bold">{detalhe.numeroPatrimonioAtual || "Sem patrimônio"}</h3>
            <p>{descricao(detalhe)} • {detalhe.situacao}</p>
            {detalhe.obraNome && <p className="text-sm text-gray-600">{detalhe.construtoraNome} • {detalhe.obraNome}</p>}
            {detalhe.situacao === "LOCADO" &&
              (detalhe.tamanho || detalhe.ancoragem || detalhe.usaContrapeso) && (
                <div className="mt-3 rounded bg-blue-50 p-3 text-sm">
                  <h4 className="font-semibold text-blue-900">Configuração atual da locação</h4>
                  {detalhe.tamanho && <p>Tamanho: {detalhe.tamanho} m</p>}
                  {detalhe.ancoragem && <p>Ancoragem: {detalhe.ancoragem}</p>}
                  <p>{detalhe.usaContrapeso ? "Com contrapeso" : "Sem contrapeso"}</p>
                  {detalhe.origemConfiguracao === "CONFERENCIA_CADASTRAL" && <p>Origem: Conferência cadastral</p>}
                  {detalhe.dataUltimaConferencia && <p>Última conferência: {dataBr(detalhe.dataUltimaConferencia)}</p>}
                </div>
              )}
            <p className="mt-2 text-sm">Origem: {detalhe.origemPatrimonio}</p>
            <h4 className="mt-4 font-semibold">Histórico administrativo</h4>
            <div className="mt-2 space-y-2">{[...(Array.isArray(detalhe.historicoAdministrativo) ? detalhe.historicoAdministrativo : [])].sort((a,b) => String(b.data || "").localeCompare(String(a.data || ""))).map((evento) => { const obraAnterior = obras.find((obra) => String(obra.id) === String(evento.obraAnteriorId || "")); const obraNova = obras.find((obra) => String(obra.id) === String(evento.obraNovaId || "")); return <div key={evento.id} className="rounded border bg-blue-50 p-2 text-sm"><p>{dataBr(evento.data)}: {evento.situacaoAnterior || "Cadastro"} → {evento.situacaoNova}</p>{evento.patrimonioRelacionado && <p>Patrimônio relacionado: {evento.patrimonioRelacionado}</p>}{obraAnterior && <p>Origem: {obraAnterior.nome}</p>}{obraNova ? <p>Destino: {obraNova.nome}</p> : evento.tipo === "SUBSTITUICAO" && <p>Destino: Galpão</p>}{evento.motivo && <p>Motivo: {evento.motivo}</p>}{evento.observacao && <p>Observação: {evento.observacao}</p>}</div>; })}</div>
            <h4 className="mt-4 font-semibold">Histórico de patrimônio</h4>
            <div className="mt-2 space-y-2">{[...(Array.isArray(detalhe.historico) ? detalhe.historico : [])].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).map((evento) => {
              const obraEvento = obras.find((obra) => String(obra.id) === String(evento.obraId));
              return <div key={evento.id} className="rounded border bg-gray-50 p-2 text-sm"><p>{dataBr(evento.data)}: {evento.numeroAnterior || "Sem patrimônio"} → {evento.numeroNovo}</p>{evento.motivo && <p>Motivo: {evento.motivo}</p>}{evento.observacao && <p>Observação: {evento.observacao}</p>}{obraEvento && <p>Obra: {obraEvento.nome}</p>}</div>;
            })}</div>
            <h4 className="mt-4 font-semibold">Conferências cadastrais</h4>
            {obterAjustesDaUnidade(detalhe, obterAjustesConfiguracaoEquipamentos()).length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Nenhuma conferência cadastral registrada.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {obterAjustesDaUnidade(detalhe, obterAjustesConfiguracaoEquipamentos()).map((ajuste) => {
                  const obraAjuste = obras.find((obra) => String(obra.id) === String(ajuste.obraId));
                  return <div key={ajuste.id} className="rounded border bg-emerald-50 p-2 text-sm"><p>{dataBr(ajuste.data)} • {obraAjuste?.nome || "Obra não localizada"}</p>{ajuste.tamanho && <p>Tamanho: {ajuste.tamanho} m</p>}{ajuste.ancoragem && <p>Ancoragem: {ajuste.ancoragem}</p>}<p>Contrapeso: {ajuste.usaContrapeso === true ? "Sim" : ajuste.usaContrapeso === false ? "Não" : "Não conferido"}</p>{ajuste.observacao && <p>Observação: {ajuste.observacao}</p>}<p className="text-xs text-gray-500">Registro administrativo não cobrável.</p></div>;
                })}
              </div>
            )}
            <h4 className="mt-4 font-semibold">Histórico operacional</h4>
            {atividadesDoDetalhe.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Nenhuma atividade vinculada localizada.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {atividadesDoDetalhe.map((atividade) => (
                  <div key={atividade.id} className="rounded border p-2 text-sm">
                    <p>{dataBr(atividade.dataLiberacao || atividade.dataAgendamento)} • {atividade.servico}</p>
                    <p>{atividade.construtora} • {atividade.obra}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setDetalhe(null)} className="rounded border px-4 py-2">Fechar</button><button type="button" onClick={() => { setDetalhe(null); abrirEditor(detalhe); }} className="rounded bg-blue-600 px-4 py-2 text-white">{detalhe.numeroPatrimonioAtual ? "Trocar patrimônio" : "Cadastrar patrimônio"}</button></div>
          </div>
        </div>
      )}
      {editor && <PatrimonioEquipamentosModal contexto={editor} registros={registros} equipamentosAtivos={ativos} obras={obras} onClose={() => setEditor(null)} onRegistrosAlterados={(novos) => { setRegistros(novos); const mestres = sincronizarPatrimoniosMestres(equipamentosMestres, novos); salvarEquipamentosPatrimonio(mestres); setEquipamentosMestres(mestres); setVersaoDados((versao) => versao + 1); }} onSubstituicaoConcluida={({ equipamentos }) => { setEquipamentosMestres(equipamentos); setEditor(null); }} />}
      {pendenciaParaVincular && (
        <VincularPatrimonioModal
          atividade={pendenciaParaVincular}
          atividades={atividades}
          obras={obras}
          onClose={() => setPendenciaParaVincular(null)}
          onVinculado={(atualizadas, mestresAtualizados) => {
            setAtividades(atualizadas);
            setEquipamentosMestres(mestresAtualizados);
            setPendenciaParaVincular(null);
          }}
        />
      )}
      {cadastroMestre !== undefined && <CadastroEquipamentoMestreModal equipamento={cadastroMestre || null} equipamentos={equipamentosMestres} registrosPatrimonio={registros} equipamentosAtivos={ativos} onClose={() => setCadastroMestre(undefined)} onSalvar={(novos, novosRegistros) => { setEquipamentosMestres(novos); setRegistros(novosRegistros); setCadastroMestre(undefined); }} />}
      {situacao && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"><div className="w-full space-y-3 rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl"><h3 className="font-bold">Alterar situação</h3><select value={situacao.nova} onChange={(e) => setSituacao({ ...situacao, nova: e.target.value })} className="w-full rounded border p-2"><option value="NO_GALPAO">No galpão</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="INDISPONIVEL">Indisponível</option><option value="BAIXADO">Baixado</option><option value="SEM_LOCALIZACAO_ATUAL">Sem localização atual</option></select><input type="date" value={situacao.data} onChange={(e) => setSituacao({ ...situacao, data: e.target.value })} className="w-full rounded border p-2" /><input value={situacao.motivo} onChange={(e) => setSituacao({ ...situacao, motivo: e.target.value })} placeholder="Motivo obrigatório" className="w-full rounded border p-2" /><textarea value={situacao.observacao} onChange={(e) => setSituacao({ ...situacao, observacao: e.target.value })} placeholder="Observação" className="w-full rounded border p-2" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setSituacao(null)} className="rounded border px-4 py-2">Cancelar</button><button type="button" onClick={confirmarSituacao} className="rounded bg-blue-600 px-4 py-2 text-white">Salvar</button></div></div></div>}
      {ajusteKits && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"><div className="w-full space-y-3 rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl"><h3 className="text-lg font-bold">Ajustar quantidade de Kits Contrapeso</h3><label className="block text-sm font-medium">Quantidade total<input type="number" min="0" step="1" inputMode="numeric" value={ajusteKits.quantidadeTotal} onChange={(e) => setAjusteKits({ ...ajusteKits, quantidadeTotal: e.target.value })} className="mt-1 w-full rounded border p-3" /></label><label className="block text-sm font-medium">Data<input type="date" value={ajusteKits.data} onChange={(e) => setAjusteKits({ ...ajusteKits, data: e.target.value })} className="mt-1 w-full rounded border p-3" /></label><label className="block text-sm font-medium">Motivo<input value={ajusteKits.motivo} onChange={(e) => setAjusteKits({ ...ajusteKits, motivo: e.target.value })} className="mt-1 w-full rounded border p-3" /></label><label className="block text-sm font-medium">Observação<textarea value={ajusteKits.observacao} onChange={(e) => setAjusteKits({ ...ajusteKits, observacao: e.target.value })} className="mt-1 w-full rounded border p-3" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setAjusteKits(null)} className="rounded border px-4 py-2">Cancelar</button><button type="button" onClick={salvarAjusteKits} className="rounded bg-blue-600 px-4 py-2 text-white">Salvar ajuste</button></div></div></div>}
      {mostrarLocaisKits && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"><div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl"><h3 className="text-lg font-bold">Kits Contrapeso locados</h3>{locaisKits.length === 0 ? <p className="mt-3 text-sm text-gray-500">Nenhum Kit Contrapeso está locado.</p> : <div className="mt-3 space-y-2">{locaisKits.map((local) => <div key={`${local.construtora}-${local.obra}`} className="rounded-lg border p-3"><p className="font-semibold">{local.construtora}</p><p className="text-sm text-gray-600">{local.obra}</p><p className="mt-1 text-sm text-blue-700">{local.quantidade} {local.quantidade === 1 ? "Kit" : "Kits"}</p></div>)}</div>}<div className="mt-4 flex justify-end"><button type="button" onClick={() => setMostrarLocaisKits(false)} className="rounded border px-4 py-2">Fechar</button></div></div></div>}
    </div>
  );
}
