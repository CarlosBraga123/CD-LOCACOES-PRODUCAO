import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizarTexto, atividadePertenceObra } from "../utils/obras";
import {
  criarFormularioConstrutora,
  mesclarConstrutoraEditada,
  prepararConstrutoraParaSalvar,
} from "../utils/construtoras";
import {
  aplicarConstrutoraAoFormularioObra,
  criarContato,
  criarFormularioObra,
  mesclarObraEditada,
  prepararObraParaSalvar,
  situacoesObra,
} from "../utils/cadastrosObras";
import {
  copiarTabelaComercialPadrao,
  herdarTabelaComercialDaConstrutora,
  normalizarTabelaComercial,
  normalizarTabelaComercialParaSalvar,
} from "../utils/tabelaComercial";
import {
  converterMoedaParaNumero,
  formatarMoeda,
  formatarNumeroParaEdicao,
} from "../utils/moeda";
import {
  compararTextoPtBr,
  ordenarConstrutoras,
  ordenarObrasPorConstrutoraENome,
  ordenarObrasPorEquipamentosAtivos,
} from "../utils/ordenacao";
import {
  obterResumoEquipamentosAtivos,
  obterResumoUnidadesEquipamentosAtivos,
  obterTotalEquipamentosAtivos,
  obterTotalUnidadesEquipamentosAtivos,
  obterUnidadesEquipamentosAtivos,
} from "../utils/equipamentosAtivos";
import {
  contarServicosObra,
  formatarDataDetalhesObra,
  formatarEquipamentoDetalhesObra,
  obterHistoricoAtividadesObra,
  obterServicosExecutadosObra,
} from "../utils/detalhesObra";
import AtividadeResumoCard from "./AtividadeResumoCard";

const texto = (valor) => String(valor || "").trim();

const normalizarBusca = (valor) =>
  normalizarTexto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const situacaoObra = (obra) => texto(obra?.situacao) || "Ativa";

const montarEndereco = (item) =>
  [
    item?.logradouro || item?.endereco,
    item?.numero,
    item?.complemento,
    item?.bairro,
    item?.cidade,
    item?.estado,
  ]
    .map(texto)
    .filter(Boolean)
    .join(", ");

const obterContatoPrincipal = (item) => texto(item?.telefone) || texto(item?.whatsapp);

const obraPertenceConstrutora = (obra, construtora) => {
  if (obra?.construtoraId && construtora?.id) {
    return String(obra.construtoraId) === String(construtora.id);
  }

  return normalizarTexto(obra?.construtora) === normalizarTexto(construtora?.nome);
};

const buscarEm = (termos, busca) =>
  termos.some((termo) => normalizarBusca(termo).includes(busca));

const obterConstrutoraDaObra = (obra, construtoras) =>
  construtoras.find((construtora) => obraPertenceConstrutora(obra, construtora));

const obterChaveConstrutoraCadastro = (construtora) =>
  construtora?.id
    ? `id:${String(construtora.id)}`
    : `nome:${normalizarTexto(construtora?.nome)}`;

const obterChaveObraCadastro = (obra) =>
  obra?.id
    ? `id:${String(obra.id)}`
    : `nome:${normalizarTexto(obra?.construtora)}||${normalizarTexto(obra?.nome)}`;

const obterTotalGrupo = (resumo, prefixo) =>
  resumo
    .filter((item) => item.grupo === prefixo || item.grupo.startsWith(`${prefixo} `))
    .reduce((total, item) => total + Math.max(0, Number(item.total) || 0), 0);

const montarCategoriasAtivas = (resumo) => [
  { chave: "eletricos", rotulo: "Eletricos", valor: obterTotalGrupo(resumo, "Balancinho Elétrico") },
  { chave: "manuais", rotulo: "Manuais", valor: obterTotalGrupo(resumo, "Balancinho Manual") },
  { chave: "miniGruas", rotulo: "Mini Grua", valor: obterTotalGrupo(resumo, "Mini Grua") },
  { chave: "contrapesos", rotulo: "Contrapeso", valor: obterTotalGrupo(resumo, "Kit Contrapeso") },
];

const atividadesRecentesDaObra = (obra, atividades) =>
  atividades
    .filter((atividade) => atividadePertenceObra(atividade, obra))
    .sort((a, b) => {
      const dataA = a.dataLiberacao || a.dataAgendamento || "";
      const dataB = b.dataLiberacao || b.dataAgendamento || "";
      return dataB.localeCompare(dataA);
    })
    .slice(0, 5);

const Campo = ({ label, value, onChange, type = "text", className = "", ...props }) => (
  <label className={`block text-sm font-medium ${className}`}>
    {label}
    <input
      type={type}
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded border p-2"
      {...props}
    />
  </label>
);

const Bloco = ({ titulo, children }) => (
  <fieldset className="rounded border bg-gray-50 p-3">
    <legend className="px-1 text-sm font-semibold">{titulo}</legend>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
  </fieldset>
);

const classeFormularioDestacado =
  "outline outline-2 outline-blue-500 ring-4 ring-blue-200 bg-blue-50 transition-[outline,box-shadow,background-color] duration-200";

export default function ConstrutorasObras({
  navegar,
  abrirAtividade,
  contextoNavegacao,
  limparContextoNavegacao,
}) {
  const [construtoras, setConstrutoras] = useState([]);
  const [obras, setObras] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [visualizacao, setVisualizacao] = useState("ativos");
  const [busca, setBusca] = useState("");
  const [construtoraAbertaId, setConstrutoraAbertaId] = useState(null);
  const [obraAbertaId, setObraAbertaId] = useState(null);
  const [obraAtivaAbertaId, setObraAtivaAbertaId] = useState(null);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [modoFormularioConstrutora, setModoFormularioConstrutora] = useState(null);
  const [chaveConstrutoraEmEdicao, setChaveConstrutoraEmEdicao] = useState(null);
  const [formularioConstrutora, setFormularioConstrutora] = useState(
    criarFormularioConstrutora()
  );
  const [tabelaConstrutoraEditada, setTabelaConstrutoraEditada] = useState(null);
  const [camposTabelaEmEdicao, setCamposTabelaEmEdicao] = useState({});
  const [destacarFormularioConstrutora, setDestacarFormularioConstrutora] =
    useState(false);
  const formularioConstrutoraRef = useRef(null);
  const deveRolarFormularioConstrutoraRef = useRef(false);
  const timeoutDestaqueConstrutoraRef = useRef(null);
  const contextoConstrutoraConsumidoRef = useRef(null);
  const [modoFormularioObra, setModoFormularioObra] = useState(null);
  const [chaveObraEmEdicao, setChaveObraEmEdicao] = useState(null);
  const [formularioObra, setFormularioObra] = useState(criarFormularioObra());
  const [camposTabelaObraEmEdicao, setCamposTabelaObraEmEdicao] = useState({});
  const [tabelaObraAlteradaManual, setTabelaObraAlteradaManual] = useState(false);
  const [destacarFormularioObra, setDestacarFormularioObra] = useState(false);
  const formularioObraRef = useRef(null);
  const deveRolarFormularioObraRef = useRef(false);
  const timeoutDestaqueObraRef = useRef(null);
  const [obraDetalhesSelecionadaChave, setObraDetalhesSelecionadaChave] =
    useState(null);
  const detalhesObraTopoRef = useRef(null);
  const deveRolarDetalhesObraRef = useRef(false);

  const carregarDados = useCallback(() => {
    setConstrutoras(JSON.parse(localStorage.getItem("construtoras") || "[]"));
    setObras(JSON.parse(localStorage.getItem("obras") || "[]"));
    setAtividades(JSON.parse(localStorage.getItem("atividades") || "[]"));
    setDadosCarregados(true);
  }, []);

  useEffect(() => {
    carregarDados();

    const atualizarAoVoltar = () => {
      if (!document.hidden) carregarDados();
    };

    window.addEventListener("focus", carregarDados);
    document.addEventListener("visibilitychange", atualizarAoVoltar);

    return () => {
      window.removeEventListener("focus", carregarDados);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
    };
  }, [carregarDados]);

  const buscaNormalizada = normalizarBusca(busca);

  const obrasAtivas = useMemo(() => {
    const obrasComTotais = obras
      .map((obra) => {
        const resumo = obterResumoEquipamentosAtivos(obra, atividades);
        const totalAtivos = obterTotalEquipamentosAtivos(obra, atividades);
        const construtora = obterConstrutoraDaObra(obra, construtoras);

        return {
          obra,
          construtora,
          resumo,
          totalAtivos,
          categorias: montarCategoriasAtivas(resumo),
        };
      })
      .filter((item) => item.totalAtivos > 0);

    return ordenarObrasPorEquipamentosAtivos(
      obrasComTotais,
      (item) => item.totalAtivos
    ).sort((a, b) => {
      if (a.totalAtivos !== b.totalAtivos) return b.totalAtivos - a.totalAtivos;
      return compararTextoPtBr(a.obra?.nome, b.obra?.nome);
    });
  }, [atividades, construtoras, obras]);

  const resumoGeralAtivos = useMemo(
    () =>
      obrasAtivas.reduce(
        (acc, item) => {
          acc.obras += 1;
          acc.total += item.totalAtivos;
          item.categorias.forEach((categoria) => {
            acc[categoria.chave] += categoria.valor;
          });
          return acc;
        },
        {
          obras: 0,
          total: 0,
          eletricos: 0,
          manuais: 0,
          miniGruas: 0,
          contrapesos: 0,
        }
      ),
    [obrasAtivas]
  );

  const dadosConstrutoras = useMemo(() => {
    const construtorasOrdenadas = ordenarConstrutoras(construtoras);

    return construtorasOrdenadas
      .map((construtora) => {
        const obrasDaConstrutora = obras.filter((obra) => obraPertenceConstrutora(obra, construtora));
        const obrasOrdenadas = ordenarObrasPorEquipamentosAtivos(
          obrasDaConstrutora,
          (obra) => obterTotalEquipamentosAtivos(obra, atividades)
        );
        const totalAtivos = obrasDaConstrutora.reduce(
          (total, obra) => total + obterTotalEquipamentosAtivos(obra, atividades),
          0
        );

        return {
          construtora,
          obras: obrasOrdenadas,
          totalObras: obrasDaConstrutora.length,
          totalAtivos,
        };
      })
      .filter(({ construtora, obras: obrasDaConstrutora }) => {
        if (!buscaNormalizada) return true;

        const encontrouConstrutora = buscarEm(
          [
            construtora?.nome,
            construtora?.razaoSocial,
            construtora?.nomeFantasia,
            construtora?.cnpj,
            construtora?.responsavel,
            construtora?.telefone,
            construtora?.whatsapp,
            construtora?.email,
          ],
          buscaNormalizada
        );

        const encontrouObra = obrasDaConstrutora.some((obra) =>
          buscarEm(
            [
              obra?.nome,
              obra?.cnpj,
              obra?.responsavel,
              obra?.engenheiro,
              obra?.telefone,
              obra?.whatsapp,
              obra?.email,
              obra?.cidade,
            ],
            buscaNormalizada
          )
        );

        return encontrouConstrutora || encontrouObra;
      });
  }, [atividades, buscaNormalizada, construtoras, obras]);

  const obrasOrdenadasParaDetalhes = useMemo(
    () => ordenarObrasPorConstrutoraENome(obras),
    [obras]
  );

  const obraDetalhesSelecionada = useMemo(
    () =>
      obras.find(
        (obra) =>
          obterChaveObraCadastro(obra) === obraDetalhesSelecionadaChave
      ) || null,
    [obraDetalhesSelecionadaChave, obras]
  );

  const obrasAtivasDetalhes = useMemo(() => {
    const obrasComTotais = obras
      .map((obra) => {
        const resumo = obterResumoUnidadesEquipamentosAtivos(obra, atividades);
        const totalAtivos = obterTotalUnidadesEquipamentosAtivos(
          obra,
          atividades
        );
        const construtora = obterConstrutoraDaObra(obra, construtoras);

        return {
          obra,
          construtora,
          resumo,
          totalAtivos,
          categorias: montarCategoriasAtivas(resumo),
        };
      })
      .filter((item) => item.totalAtivos > 0);

    return obrasComTotais.sort((a, b) => {
      if (a.totalAtivos !== b.totalAtivos) return b.totalAtivos - a.totalAtivos;
      return compararTextoPtBr(a.obra?.nome, b.obra?.nome);
    });
  }, [atividades, construtoras, obras]);

  const unidadesAtivasObraDetalhes = useMemo(
    () =>
      obraDetalhesSelecionada
        ? obterUnidadesEquipamentosAtivos(
            obraDetalhesSelecionada,
            atividades
          )
        : [],
    [atividades, obraDetalhesSelecionada]
  );

  const alternarConstrutora = (id) => {
    setConstrutoraAbertaId((atual) => (String(atual) === String(id) ? null : id));
    setObraAbertaId(null);
  };

  const alternarObraGestao = (id) => {
    setObraAbertaId((atual) => (String(atual) === String(id) ? null : id));
  };

  const alternarObraAtiva = (id) => {
    setObraAtivaAbertaId((atual) => (String(atual) === String(id) ? null : id));
  };

  const navegarPara = (pagina, contexto = null) => navegar?.(pagina, contexto);

  const criarCopiaTabelaComercialPadrao = () => {
    const tabelaPadraoSalva = JSON.parse(
      localStorage.getItem("tabelaComercialPadrao") || "null"
    );

    return copiarTabelaComercialPadrao(
      tabelaPadraoSalva,
      new Date().toISOString()
    );
  };

  const abrirFormularioNovaConstrutora = () => {
    setVisualizacao("gestao");
    setModoFormularioObra(null);
    setModoFormularioConstrutora("nova");
    setChaveConstrutoraEmEdicao(null);
    setFormularioConstrutora(criarFormularioConstrutora());
    setTabelaConstrutoraEditada(null);
    setCamposTabelaEmEdicao({});
    deveRolarFormularioConstrutoraRef.current = true;
    setDestacarFormularioConstrutora(true);
  };

  const editarConstrutora = (construtora) => {
    if (!construtora) return;

    setVisualizacao("gestao");
    setModoFormularioObra(null);
    setModoFormularioConstrutora("editar");
    setChaveConstrutoraEmEdicao(obterChaveConstrutoraCadastro(construtora));
    setFormularioConstrutora(criarFormularioConstrutora(construtora));
    setTabelaConstrutoraEditada(
      normalizarTabelaComercial(
        construtora.tabelaComercial || criarCopiaTabelaComercialPadrao(),
        { incluirVersaoPadrao: true }
      )
    );
    setCamposTabelaEmEdicao({});
    setConstrutoraAbertaId(construtora.id || construtora.nome);
    deveRolarFormularioConstrutoraRef.current = true;
    setDestacarFormularioConstrutora(true);
  };

  const fecharFormularioConstrutora = () => {
    setModoFormularioConstrutora(null);
    setChaveConstrutoraEmEdicao(null);
    setFormularioConstrutora(criarFormularioConstrutora());
    setTabelaConstrutoraEditada(null);
    setCamposTabelaEmEdicao({});
    setDestacarFormularioConstrutora(false);

    if (timeoutDestaqueConstrutoraRef.current) {
      window.clearTimeout(timeoutDestaqueConstrutoraRef.current);
      timeoutDestaqueConstrutoraRef.current = null;
    }
  };

  const salvarNovaConstrutora = () => {
    const dados = prepararConstrutoraParaSalvar(formularioConstrutora);
    if (!dados.nome) return;

    const novaConstrutora = {
      ...dados,
      id: Date.now(),
      tabelaComercial: criarCopiaTabelaComercialPadrao(),
    };
    const atualizadas = [...construtoras, novaConstrutora];

    setConstrutoras(atualizadas);
    localStorage.setItem("construtoras", JSON.stringify(atualizadas));
    setConstrutoraAbertaId(novaConstrutora.id);
    fecharFormularioConstrutora();
  };

  const salvarConstrutoraEditada = () => {
    const dados = prepararConstrutoraParaSalvar(formularioConstrutora);
    if (!dados.nome) return;

    const atualizadas = construtoras.map((construtora) =>
      obterChaveConstrutoraCadastro(construtora) === chaveConstrutoraEmEdicao
        ? mesclarConstrutoraEditada({
            registroExistente: construtora,
            dadosEditados: dados,
            tabelaComercial: {
              ...normalizarTabelaComercialParaSalvar(
                tabelaConstrutoraEditada ||
                  construtora.tabelaComercial ||
                  criarCopiaTabelaComercialPadrao(),
                { incluirVersaoPadrao: true }
              ),
              origem:
                tabelaConstrutoraEditada?.origem ||
                construtora.tabelaComercial?.origem ||
                "padrao",
              atualizadoEm: new Date().toISOString(),
            },
          })
        : construtora
    );

    setConstrutoras(atualizadas);
    localStorage.setItem("construtoras", JSON.stringify(atualizadas));
    setConstrutoraAbertaId(
      formularioConstrutora.id || formularioConstrutora.nome
    );
    fecharFormularioConstrutora();
  };

  const excluirConstrutora = (construtora) => {
    const possuiObras = obras.some((obra) =>
      obraPertenceConstrutora(obra, construtora)
    );

    if (possuiObras) {
      window.alert(
        "Não é possível excluir esta construtora porque existem obras vinculadas."
      );
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir esta construtora?")) return;

    const atualizadas = construtoras.filter(
      (item) =>
        obterChaveConstrutoraCadastro(item) !==
        obterChaveConstrutoraCadastro(construtora)
    );
    setConstrutoras(atualizadas);
    localStorage.setItem("construtoras", JSON.stringify(atualizadas));
    setConstrutoraAbertaId(null);

    if (
      modoFormularioConstrutora === "editar" &&
      chaveConstrutoraEmEdicao === obterChaveConstrutoraCadastro(construtora)
    ) {
      fecharFormularioConstrutora();
    }
  };

  const obterChaveCampoTabela = (grupo, chave) => `${grupo}:${chave}`;

  const atualizarValorTabelaConstrutora = (grupo, chave, valor) => {
    const numero = converterMoedaParaNumero(valor);
    if (numero === null) return;

    setTabelaConstrutoraEditada((tabelaAtual) => {
      const tabela = normalizarTabelaComercial(
        tabelaAtual || criarCopiaTabelaComercialPadrao(),
        { incluirVersaoPadrao: true }
      );

      return {
        ...tabela,
        atualizadoEm: new Date().toISOString(),
        [grupo]: {
          ...tabela[grupo],
          [chave]: numero,
        },
      };
    });
  };

  const iniciarEdicaoValorTabela = (grupo, chave, valor) => {
    setCamposTabelaEmEdicao((atuais) => ({
      ...atuais,
      [obterChaveCampoTabela(grupo, chave)]: formatarNumeroParaEdicao(valor),
    }));
  };

  const alterarValorTabelaEditado = (grupo, chave, valor) => {
    setCamposTabelaEmEdicao((atuais) => ({
      ...atuais,
      [obterChaveCampoTabela(grupo, chave)]: valor,
    }));
  };

  const finalizarEdicaoValorTabela = (grupo, chave) => {
    const chaveCampo = obterChaveCampoTabela(grupo, chave);
    atualizarValorTabelaConstrutora(
      grupo,
      chave,
      camposTabelaEmEdicao[chaveCampo]
    );
    setCamposTabelaEmEdicao((atuais) => {
      const novos = { ...atuais };
      delete novos[chaveCampo];
      return novos;
    });
  };

  useEffect(() => {
    if (
      !deveRolarFormularioConstrutoraRef.current ||
      !formularioConstrutoraRef.current
    ) {
      return;
    }

    deveRolarFormularioConstrutoraRef.current = false;

    requestAnimationFrame(() => {
      formularioConstrutoraRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    if (timeoutDestaqueConstrutoraRef.current) {
      window.clearTimeout(timeoutDestaqueConstrutoraRef.current);
    }

    timeoutDestaqueConstrutoraRef.current = window.setTimeout(() => {
      setDestacarFormularioConstrutora(false);
      timeoutDestaqueConstrutoraRef.current = null;
    }, 6000);
  }, [destacarFormularioConstrutora, modoFormularioConstrutora]);

  useEffect(
    () => () => {
      if (timeoutDestaqueConstrutoraRef.current) {
        window.clearTimeout(timeoutDestaqueConstrutoraRef.current);
      }
    },
    []
  );

  const removerDestaqueFormularioConstrutora = () => {
    if (!destacarFormularioConstrutora) return;

    setDestacarFormularioConstrutora(false);
    if (timeoutDestaqueConstrutoraRef.current) {
      window.clearTimeout(timeoutDestaqueConstrutoraRef.current);
      timeoutDestaqueConstrutoraRef.current = null;
    }
  };

  useEffect(() => {
    if (
      !dadosCarregados ||
      !contextoNavegacao ||
      contextoConstrutoraConsumidoRef.current === contextoNavegacao
    ) {
      return;
    }

    contextoConstrutoraConsumidoRef.current = contextoNavegacao;

    if (contextoNavegacao.visualizacao === "gestao") {
      setVisualizacao("gestao");
    }

    if (
      contextoNavegacao.destino === "construtorasobras" &&
      contextoNavegacao.acao === "nova-construtora"
    ) {
      abrirFormularioNovaConstrutora();
      limparContextoNavegacao?.();
      return;
    }

    if (
      contextoNavegacao.destino === "construtorasobras" &&
      contextoNavegacao.acao === "editar-construtora"
    ) {
      const construtoraId =
        contextoNavegacao.construtoraId || contextoNavegacao.id;
      const construtora = construtoras.find(
        (item) => String(item.id) === String(construtoraId)
      );

      if (construtora) editarConstrutora(construtora);
      limparContextoNavegacao?.();
      return;
    }

    if (
      contextoNavegacao.destino === "construtorasobras" &&
      contextoNavegacao.acao === "nova-obra"
    ) {
      const construtoraId =
        contextoNavegacao.construtoraId || contextoNavegacao.id;
      const construtora =
        construtoras.find(
          (item) => String(item.id) === String(construtoraId)
        ) ||
        construtoras.find(
          (item) =>
            normalizarTexto(item.nome) ===
            normalizarTexto(contextoNavegacao.construtoraNome)
        ) ||
        null;

      abrirNovaObra(construtora);
      limparContextoNavegacao?.();
      return;
    }

    if (
      contextoNavegacao.destino === "construtorasobras" &&
      contextoNavegacao.acao === "editar-obra"
    ) {
      const obraId = contextoNavegacao.obraId || contextoNavegacao.id;
      const obra = obraId
        ? obras.find((item) => String(item.id) === String(obraId))
        : null;

      if (obra) editarObra(obra);
      limparContextoNavegacao?.();
      return;
    }

    if (
      contextoNavegacao.destino === "construtorasobras" &&
      contextoNavegacao.acao === "abrir-detalhes-obra"
    ) {
      const obraId = contextoNavegacao.obraId;
      let obra = null;

      if (obraId) {
        obra =
          obras.find((item) => String(item.id) === String(obraId)) || null;
      } else if (contextoNavegacao.obraNome) {
        obra =
          obras.find(
            (item) =>
              normalizarTexto(item.nome) ===
                normalizarTexto(contextoNavegacao.obraNome) &&
              (!contextoNavegacao.construtoraNome ||
                normalizarTexto(item.construtora) ===
                  normalizarTexto(contextoNavegacao.construtoraNome))
          ) || null;
      }

      setObraDetalhesSelecionadaChave(
        obra ? obterChaveObraCadastro(obra) : null
      );
      setVisualizacao("detalhes");
      deveRolarDetalhesObraRef.current = true;
      limparContextoNavegacao?.();
      return;
    }

    if (contextoNavegacao.visualizacao === "gestao") {
      limparContextoNavegacao?.();
    }
  }, [
    construtoras,
    contextoNavegacao,
    dadosCarregados,
    limparContextoNavegacao,
    obras,
  ]);

  const obterConstrutoraPorNome = (nomeConstrutora) =>
    construtoras.find(
      (construtora) =>
        normalizarTexto(construtora.nome) === normalizarTexto(nomeConstrutora)
    );

  const criarTabelaComercialHerdada = (construtora) => {
    const tabelaPadraoSalva = JSON.parse(
      localStorage.getItem("tabelaComercialPadrao") || "null"
    );

    return herdarTabelaComercialDaConstrutora({
      tabelaConstrutora: construtora?.tabelaComercial,
      tabelaPadraoSalva,
      construtoraId: construtora?.id,
      atualizadoEm: new Date().toISOString(),
    });
  };

  const fecharFormularioObra = () => {
    setModoFormularioObra(null);
    setChaveObraEmEdicao(null);
    setFormularioObra(criarFormularioObra());
    setCamposTabelaObraEmEdicao({});
    setTabelaObraAlteradaManual(false);
    setDestacarFormularioObra(false);

    if (timeoutDestaqueObraRef.current) {
      window.clearTimeout(timeoutDestaqueObraRef.current);
      timeoutDestaqueObraRef.current = null;
    }
  };

  const abrirNovaObra = (construtora = null) => {
    setVisualizacao("gestao");
    setModoFormularioConstrutora(null);
    setModoFormularioObra("nova");
    setChaveObraEmEdicao(null);
    setCamposTabelaObraEmEdicao({});
    setTabelaObraAlteradaManual(false);

    const formulario = criarFormularioObra();
    setFormularioObra(
      construtora
        ? {
            ...aplicarConstrutoraAoFormularioObra(formulario, construtora),
            tabelaComercial: criarTabelaComercialHerdada(construtora),
          }
        : formulario
    );

    setConstrutoraAbertaId(
      construtora ? construtora.id || construtora.nome : construtoraAbertaId
    );
    deveRolarFormularioObraRef.current = true;
    setDestacarFormularioObra(true);
  };

  const editarObra = (obra) => {
    if (!obra) return;

    const construtora = obterConstrutoraDaObra(obra, construtoras);
    setVisualizacao("gestao");
    setModoFormularioConstrutora(null);
    setModoFormularioObra("editar");
    setChaveObraEmEdicao(obterChaveObraCadastro(obra));
    setFormularioObra({
      ...criarFormularioObra(obra),
      tabelaComercial:
        obra.tabelaComercial ||
        criarTabelaComercialHerdada(
          construtora || { nome: obra.construtora, id: obra.construtoraId }
        ),
    });
    setCamposTabelaObraEmEdicao({});
    setTabelaObraAlteradaManual(false);
    setConstrutoraAbertaId(
      construtora?.id || construtora?.nome || obra.construtora
    );
    setObraAbertaId(obra.id || obra.nome);
    deveRolarFormularioObraRef.current = true;
    setDestacarFormularioObra(true);
  };

  const atualizarConstrutoraFormularioObra = (nomeConstrutora) => {
    const construtora = obterConstrutoraPorNome(nomeConstrutora);
    const formularioAtualizado = aplicarConstrutoraAoFormularioObra(
      formularioObra,
      { id: construtora?.id || "", nome: nomeConstrutora }
    );

    setFormularioObra({
      ...formularioAtualizado,
      tabelaComercial: tabelaObraAlteradaManual
        ? {
            ...formularioObra.tabelaComercial,
            construtoraId: construtora?.id || null,
          }
        : criarTabelaComercialHerdada(construtora),
    });
  };

  const salvarNovaObra = () => {
    const dados = prepararObraParaSalvar(formularioObra);
    if (!dados.nome || !dados.construtora) return;

    const construtora = obterConstrutoraPorNome(dados.construtora);
    const novaObra = {
      ...dados,
      construtoraId: construtora?.id || dados.construtoraId || "",
      id: Date.now(),
      tabelaComercial:
        formularioObra.tabelaComercial ||
        criarTabelaComercialHerdada(construtora),
    };
    const atualizadas = [...obras, novaObra];

    setObras(atualizadas);
    localStorage.setItem("obras", JSON.stringify(atualizadas));
    setConstrutoraAbertaId(
      construtora?.id || construtora?.nome || novaObra.construtora
    );
    setObraAbertaId(novaObra.id);
    fecharFormularioObra();
  };

  const salvarObraEditada = () => {
    const dados = prepararObraParaSalvar(formularioObra);
    if (!dados.nome || !dados.construtora) return;

    const construtora = obterConstrutoraPorNome(dados.construtora);
    const atualizadas = obras.map((obra) =>
      obterChaveObraCadastro(obra) === chaveObraEmEdicao
        ? mesclarObraEditada({
            registroExistente: obra,
            dadosEditados: dados,
            construtoraId: construtora?.id,
            tabelaComercial: normalizarTabelaComercialParaSalvar(
              formularioObra.tabelaComercial ||
                obra.tabelaComercial ||
                criarTabelaComercialHerdada(construtora)
            ),
          })
        : obra
    );

    setObras(atualizadas);
    localStorage.setItem("obras", JSON.stringify(atualizadas));
    setConstrutoraAbertaId(
      construtora?.id || construtora?.nome || dados.construtora
    );
    setObraAbertaId(formularioObra.id || formularioObra.nome);
    fecharFormularioObra();
  };

  const excluirObra = (obra) => {
    if (!window.confirm("Deseja realmente excluir esta obra?")) return;

    const chave = obterChaveObraCadastro(obra);
    const atualizadas = obras.filter(
      (item) => obterChaveObraCadastro(item) !== chave
    );
    setObras(atualizadas);
    localStorage.setItem("obras", JSON.stringify(atualizadas));
    setObraAbertaId(null);
    setObraAtivaAbertaId(null);

    if (
      modoFormularioObra === "editar" &&
      chaveObraEmEdicao === chave
    ) {
      fecharFormularioObra();
    }
  };

  const atualizarContatoObra = (indice, campo, valor) => {
    const contatos = [...(formularioObra.contatos || [])];
    contatos[indice] = { ...contatos[indice], [campo]: valor };
    setFormularioObra({ ...formularioObra, contatos });
  };

  const adicionarContatoObra = () => {
    setFormularioObra({
      ...formularioObra,
      contatos: [...(formularioObra.contatos || []), criarContato()],
    });
  };

  const removerContatoObra = (indice) => {
    setFormularioObra({
      ...formularioObra,
      contatos: (formularioObra.contatos || []).filter(
        (_, atual) => atual !== indice
      ),
    });
  };

  const obterChaveCampoTabelaObra = (grupo, chave) => `${grupo}:${chave}`;

  const atualizarValorTabelaObra = (grupo, chave, valor) => {
    const numero = converterMoedaParaNumero(valor);
    if (numero === null) return;

    const construtora = obterConstrutoraPorNome(formularioObra.construtora);
    const tabelaAtual =
      formularioObra.tabelaComercial ||
      criarTabelaComercialHerdada(construtora);

    setFormularioObra({
      ...formularioObra,
      tabelaComercial: {
        ...tabelaAtual,
        atualizadoEm: new Date().toISOString(),
        [grupo]: {
          ...normalizarTabelaComercial(tabelaAtual)[grupo],
          [chave]: numero,
        },
      },
    });
    setTabelaObraAlteradaManual(true);
  };

  const iniciarEdicaoValorTabelaObra = (grupo, chave, valor) => {
    setCamposTabelaObraEmEdicao((atuais) => ({
      ...atuais,
      [obterChaveCampoTabelaObra(grupo, chave)]:
        formatarNumeroParaEdicao(valor),
    }));
  };

  const alterarValorTabelaObraEditado = (grupo, chave, valor) => {
    setCamposTabelaObraEmEdicao((atuais) => ({
      ...atuais,
      [obterChaveCampoTabelaObra(grupo, chave)]: valor,
    }));
  };

  const finalizarEdicaoValorTabelaObra = (grupo, chave) => {
    const chaveCampo = obterChaveCampoTabelaObra(grupo, chave);
    atualizarValorTabelaObra(
      grupo,
      chave,
      camposTabelaObraEmEdicao[chaveCampo]
    );
    setCamposTabelaObraEmEdicao((atuais) => {
      const novos = { ...atuais };
      delete novos[chaveCampo];
      return novos;
    });
  };

  useEffect(() => {
    if (
      !deveRolarFormularioObraRef.current ||
      !formularioObraRef.current
    ) {
      return;
    }

    deveRolarFormularioObraRef.current = false;
    requestAnimationFrame(() => {
      formularioObraRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    if (timeoutDestaqueObraRef.current) {
      window.clearTimeout(timeoutDestaqueObraRef.current);
    }
    timeoutDestaqueObraRef.current = window.setTimeout(() => {
      setDestacarFormularioObra(false);
      timeoutDestaqueObraRef.current = null;
    }, 6000);
  }, [destacarFormularioObra, modoFormularioObra]);

  useEffect(
    () => () => {
      if (timeoutDestaqueObraRef.current) {
        window.clearTimeout(timeoutDestaqueObraRef.current);
      }
    },
    []
  );

  const removerDestaqueFormularioObra = () => {
    if (!destacarFormularioObra) return;

    setDestacarFormularioObra(false);
    if (timeoutDestaqueObraRef.current) {
      window.clearTimeout(timeoutDestaqueObraRef.current);
      timeoutDestaqueObraRef.current = null;
    }
  };

  useEffect(() => {
    if (
      visualizacao !== "detalhes" ||
      !deveRolarDetalhesObraRef.current ||
      !detalhesObraTopoRef.current
    ) {
      return;
    }

    deveRolarDetalhesObraRef.current = false;
    requestAnimationFrame(() => {
      detalhesObraTopoRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [obraDetalhesSelecionadaChave, visualizacao]);

  useEffect(() => {
    if (
      dadosCarregados &&
      obraDetalhesSelecionadaChave &&
      !obraDetalhesSelecionada
    ) {
      setObraDetalhesSelecionadaChave(null);
    }
  }, [
    dadosCarregados,
    obraDetalhesSelecionada,
    obraDetalhesSelecionadaChave,
  ]);

  const abrirNovaAtividade = (obra, construtora) => {
    navegarPara("atividades", {
      origem: "construtoras-obras",
      destino: "atividades",
      acao: "nova-atividade",
      construtoraId: construtora?.id || obra?.construtoraId || "",
      construtoraNome: construtora?.nome || obra?.construtora || "",
      obraId: obra?.id || "",
      obraNome: obra?.nome || "",
    });
  };

  const abrirAtividadeRecente = (atividade) => {
    if (!atividade?.id || !abrirAtividade) return;
    abrirAtividade(atividade.id);
  };

  const abrirDetalhesObra = (obra, construtora) => {
    if (!obra) return;

    setObraDetalhesSelecionadaChave(obterChaveObraCadastro(obra));
    setVisualizacao("detalhes");
    deveRolarDetalhesObraRef.current = true;
  };

  const renderDetalheObra = ({ obra, construtora, resumo, compacto = false }) => {
    const contatoObra = obterContatoPrincipal(obra);
    const responsavel = texto(obra.responsavel) || texto(obra.engenheiro);
    const recentes = atividadesRecentesDaObra(obra, atividades);

    return (
      <div className={`grid gap-3 border-t pt-3 ${compacto ? "" : "lg:grid-cols-3"}`}>
        <div className="space-y-1 text-sm">
          <h3 className="font-semibold">Resumo</h3>
          <p>Construtora: {construtora?.nome || obra.construtora || "-"}</p>
          <p>Endereco: {montarEndereco(obra) || "-"}</p>
          <p>Responsavel: {responsavel || "-"}</p>
          <p>Telefone: {obra.telefone || contatoObra || "-"}</p>
          <p>WhatsApp: {obra.whatsapp || "-"}</p>
        </div>

        <div className="space-y-1 text-sm">
          <h3 className="font-semibold">Equipamentos ativos</h3>
          {resumo.length === 0 ? (
            <p className="text-gray-500">Nenhum equipamento ativo.</p>
          ) : (
            resumo.map((item) => (
              <p key={item.grupo}>
                {item.grupo}: <strong>{item.total}</strong>
              </p>
            ))
          )}
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Atividades recentes</h3>
          {recentes.length === 0 ? (
            <p className="text-gray-500">Nenhuma atividade encontrada.</p>
          ) : (
            recentes.map((atividade, indice) => (
              <AtividadeResumoCard
                key={atividade.id || `${atividade.dataLiberacao || atividade.dataAgendamento || "sem-data"}-${indice}`}
                atividade={atividade}
                onClick={() => abrirAtividadeRecente(atividade)}
                disabled={!atividade.id}
                className={
                  atividade.id
                    ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100"
                    : "cursor-default"
                }
                title={atividade.id ? "Abrir atividade" : ""}
              />
            ))
          )}
        </div>

        <div className={`flex flex-col gap-2 ${compacto ? "" : "lg:col-span-3 sm:flex-row"}`}>
          <button
            type="button"
            onClick={() => abrirNovaAtividade(obra, construtora)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow-sm"
          >
            Nova Atividade
          </button>
          <button
            type="button"
            onClick={() => editarObra(obra)}
            className="rounded-xl border bg-white px-4 py-2 text-blue-600 shadow-sm"
          >
            Editar Obra
          </button>
          <button
            type="button"
            onClick={() => abrirDetalhesObra(obra, construtora)}
            className="rounded-xl border bg-white px-4 py-2 text-blue-600 shadow-sm"
          >
            Abrir Detalhes da Obra atual
          </button>
        </div>
      </div>
    );
  };

  const renderEquipamentosAtivos = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-6">
        {[
          ["Obras", resumoGeralAtivos.obras],
          ["Total", resumoGeralAtivos.total],
          ["Eletricos", resumoGeralAtivos.eletricos],
          ["Manuais", resumoGeralAtivos.manuais],
          ["Mini Gruas", resumoGeralAtivos.miniGruas],
          ["Contrapesos", resumoGeralAtivos.contrapesos],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-lg border bg-gray-50 px-2 py-1">
            <p className="text-[11px] font-semibold uppercase text-gray-500">{rotulo}</p>
            <p className="text-lg font-bold text-blue-700 leading-none">{valor}</p>
          </div>
        ))}
      </div>

      {obrasAtivas.length === 0 ? (
        <p className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-500">
          Nenhuma obra com equipamento ativo.
        </p>
      ) : (
        <div className="space-y-1">
          {obrasAtivas.map(({ obra, construtora, resumo, totalAtivos, categorias }) => {
            const aberta = String(obraAtivaAbertaId) === String(obra.id || obra.nome);
            const categoriasVisiveis = categorias.filter((categoria) => categoria.valor > 0);

            return (
              <article key={obra.id || obra.nome} className="rounded-lg border bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => alternarObraAtiva(obra.id || obra.nome)}
                  className="grid w-full grid-cols-[1fr_auto] gap-2 px-3 py-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">{obra.nome || "Obra sem nome"}</p>
                    <p className="truncate text-xs text-gray-500 leading-tight">
                      {construtora?.nome || obra.construtora || "Sem construtora"}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-tight text-gray-600">
                      {categoriasVisiveis.map((categoria) => (
                        <span key={categoria.chave}>{categoria.rotulo} {categoria.valor}</span>
                      ))}
                    </p>
                  </div>
                  <div className="flex min-w-[42px] items-center justify-center rounded-lg bg-blue-50 px-2 text-xl font-bold text-blue-700">
                    {totalAtivos}
                  </div>
                </button>

                {aberta && (
                  <div className="px-3 pb-3">
                    {renderDetalheObra({ obra, construtora, resumo, compacto: true })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderContatosObra = () => (
    <Bloco titulo="Responsaveis e contatos">
      <Campo label="Responsavel principal" value={formularioObra.responsavel} onChange={(valor) => setFormularioObra({ ...formularioObra, responsavel: valor })} />
      <Campo label="Cargo do responsavel" value={formularioObra.cargoResponsavel} onChange={(valor) => setFormularioObra({ ...formularioObra, cargoResponsavel: valor })} />
      <Campo label="Telefone principal" value={formularioObra.telefone} onChange={(valor) => setFormularioObra({ ...formularioObra, telefone: valor })} />
      <Campo label="WhatsApp principal" value={formularioObra.whatsapp} onChange={(valor) => setFormularioObra({ ...formularioObra, whatsapp: valor })} />
      <Campo label="E-mail principal" type="email" value={formularioObra.email} onChange={(valor) => setFormularioObra({ ...formularioObra, email: valor })} className="md:col-span-2" />

      <div className="space-y-3 md:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold">Contatos adicionais</h4>
          <button
            type="button"
            onClick={adicionarContatoObra}
            className="rounded border bg-white px-3 py-1 text-sm text-blue-600"
          >
            Adicionar contato
          </button>
        </div>

        {(formularioObra.contatos || []).length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum contato adicional cadastrado.
          </p>
        ) : (
          formularioObra.contatos.map((contato, indice) => (
            <div key={contato.id || indice} className="rounded border bg-white p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Campo label="Tipo" value={contato.tipo} onChange={(valor) => atualizarContatoObra(indice, "tipo", valor)} />
                <Campo label="Nome" value={contato.nome} onChange={(valor) => atualizarContatoObra(indice, "nome", valor)} />
                <Campo label="Cargo" value={contato.cargo} onChange={(valor) => atualizarContatoObra(indice, "cargo", valor)} />
                <Campo label="CREA" value={contato.crea} onChange={(valor) => atualizarContatoObra(indice, "crea", valor)} />
                <Campo label="Telefone" value={contato.telefone} onChange={(valor) => atualizarContatoObra(indice, "telefone", valor)} />
                <Campo label="WhatsApp" value={contato.whatsapp} onChange={(valor) => atualizarContatoObra(indice, "whatsapp", valor)} />
                <Campo label="E-mail" type="email" value={contato.email} onChange={(valor) => atualizarContatoObra(indice, "email", valor)} />
                <div className="flex flex-wrap items-center gap-3 pt-6 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contato.principal === true}
                      onChange={(event) =>
                        atualizarContatoObra(
                          indice,
                          "principal",
                          event.target.checked
                        )
                      }
                    />
                    Principal
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contato.ativo !== false}
                      onChange={(event) =>
                        atualizarContatoObra(
                          indice,
                          "ativo",
                          event.target.checked
                        )
                      }
                    />
                    Ativo
                  </label>
                  <button
                    type="button"
                    onClick={() => removerContatoObra(indice)}
                    className="text-red-600 underline"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Bloco>
  );

  const renderFormularioObra = () => (
    <div className="space-y-3">
      <Bloco titulo="Identificacao">
        <label className="block text-sm font-medium">
          Construtora
          <select
            value={formularioObra.construtora}
            onChange={(event) =>
              atualizarConstrutoraFormularioObra(event.target.value)
            }
            className="mt-1 w-full rounded border p-2"
          >
            <option value="">Construtora</option>
            {ordenarConstrutoras(construtoras).map((construtora) => (
              <option
                key={construtora.id || construtora.nome}
                value={construtora.nome}
              >
                {construtora.nome}
              </option>
            ))}
          </select>
        </label>
        <Campo label="Nome da obra" value={formularioObra.nome} onChange={(valor) => setFormularioObra({ ...formularioObra, nome: valor })} />
        <Campo label="CNPJ da obra" value={formularioObra.cnpj} onChange={(valor) => setFormularioObra({ ...formularioObra, cnpj: valor })} />
        <Campo label="CNO" value={formularioObra.cno} onChange={(valor) => setFormularioObra({ ...formularioObra, cno: valor })} />
        <Campo label="Codigo interno" value={formularioObra.codigoInterno} onChange={(valor) => setFormularioObra({ ...formularioObra, codigoInterno: valor })} />
        <label className="block text-sm font-medium">
          Situacao
          <select
            value={formularioObra.situacao || "Ativa"}
            onChange={(event) =>
              setFormularioObra({
                ...formularioObra,
                situacao: event.target.value,
              })
            }
            className="mt-1 w-full rounded border p-2"
          >
            {situacoesObra.map((situacao) => (
              <option key={situacao} value={situacao}>
                {situacao}
              </option>
            ))}
          </select>
        </label>
      </Bloco>

      <Bloco titulo="Endereco">
        <Campo label="CEP" value={formularioObra.cep} onChange={(valor) => setFormularioObra({ ...formularioObra, cep: valor })} />
        <Campo label="Logradouro" value={formularioObra.logradouro} onChange={(valor) => setFormularioObra({ ...formularioObra, logradouro: valor })} />
        <Campo label="Numero" value={formularioObra.numero} onChange={(valor) => setFormularioObra({ ...formularioObra, numero: valor })} />
        <Campo label="Complemento" value={formularioObra.complemento} onChange={(valor) => setFormularioObra({ ...formularioObra, complemento: valor })} />
        <Campo label="Bairro" value={formularioObra.bairro} onChange={(valor) => setFormularioObra({ ...formularioObra, bairro: valor })} />
        <Campo label="Cidade" value={formularioObra.cidade} onChange={(valor) => setFormularioObra({ ...formularioObra, cidade: valor })} />
        <Campo label="Estado" value={formularioObra.estado} onChange={(valor) => setFormularioObra({ ...formularioObra, estado: valor })} />
        <Campo label="Ponto de referencia" value={formularioObra.pontoReferencia} onChange={(valor) => setFormularioObra({ ...formularioObra, pontoReferencia: valor })} />
        <Campo label="Endereco" value={formularioObra.endereco} onChange={(valor) => setFormularioObra({ ...formularioObra, endereco: valor })} className="md:col-span-2" />
      </Bloco>

      {renderContatosObra()}

      <Bloco titulo="Operacao">
        <Campo label="Engenheiro responsavel" value={formularioObra.engenheiro} onChange={(valor) => setFormularioObra({ ...formularioObra, engenheiro: valor })} />
        <Campo label="Horario de entrega" value={formularioObra.horarioEntrega} onChange={(valor) => setFormularioObra({ ...formularioObra, horarioEntrega: valor })} />
        <label className="block text-sm font-medium md:col-span-2">
          Orientacoes de acesso
          <textarea
            value={formularioObra.orientacoesAcesso || ""}
            onChange={(event) =>
              setFormularioObra({
                ...formularioObra,
                orientacoesAcesso: event.target.value,
              })
            }
            className="mt-1 w-full rounded border p-2"
            rows={2}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input
            type="checkbox"
            checked={formularioObra.enderecoEntregaDiferente === true}
            onChange={(event) =>
              setFormularioObra({
                ...formularioObra,
                enderecoEntregaDiferente: event.target.checked,
              })
            }
          />
          Endereco de entrega diferente
        </label>
        {formularioObra.enderecoEntregaDiferente && (
          <label className="block text-sm font-medium md:col-span-2">
            Endereco de entrega
            <textarea
              value={formularioObra.enderecoEntrega || ""}
              onChange={(event) =>
                setFormularioObra({
                  ...formularioObra,
                  enderecoEntrega: event.target.value,
                })
              }
              className="mt-1 w-full rounded border p-2"
              rows={2}
            />
          </label>
        )}
        <label className="block text-sm font-medium md:col-span-2">
          Observacoes
          <textarea
            value={formularioObra.observacoes || ""}
            onChange={(event) =>
              setFormularioObra({
                ...formularioObra,
                observacoes: event.target.value,
              })
            }
            className="mt-1 w-full rounded border p-2"
            rows={3}
          />
        </label>
      </Bloco>

      <div className="rounded border bg-gray-50 p-3">
        <h3 className="text-sm font-semibold">Contratos</h3>
        <p className="mt-1 text-sm text-gray-500">
          Area reservada para historico e dados contratuais da obra. O
          armazenamento sera implementado em etapa futura.
        </p>
      </div>
    </div>
  );

  const renderCamposTabelaObra = (grupo) => {
    const construtora = obterConstrutoraPorNome(formularioObra.construtora);
    const tabela = normalizarTabelaComercial(
      formularioObra.tabelaComercial ||
        criarTabelaComercialHerdada(construtora)
    );

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Object.entries(tabela[grupo]).map(([chave, valor]) => {
          const chaveCampo = obterChaveCampoTabelaObra(grupo, chave);

          return (
            <div key={chave}>
              <label className="block text-sm font-medium">{chave}</label>
              <input
                type="text"
                inputMode="decimal"
                value={
                  camposTabelaObraEmEdicao[chaveCampo] ??
                  formatarMoeda(valor)
                }
                onFocus={() =>
                  iniciarEdicaoValorTabelaObra(grupo, chave, valor)
                }
                onChange={(event) =>
                  alterarValorTabelaObraEditado(
                    grupo,
                    chave,
                    event.target.value
                  )
                }
                onBlur={() => finalizarEdicaoValorTabelaObra(grupo, chave)}
                className="w-full rounded border p-2 text-sm"
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderPainelFormularioObra = () => {
    if (!modoFormularioObra) return null;

    return (
      <section
        ref={formularioObraRef}
        onMouseDown={removerDestaqueFormularioObra}
        onFocusCapture={removerDestaqueFormularioObra}
        onTouchStart={removerDestaqueFormularioObra}
        className={`scroll-mt-24 space-y-4 rounded-xl border bg-white p-3 shadow-sm ${
          destacarFormularioObra
            ? classeFormularioDestacado
            : "transition-[outline,box-shadow,background-color] duration-200"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {modoFormularioObra === "nova" ? "Nova Obra" : "Editar Obra"}
          </h3>
          <button
            type="button"
            onClick={fecharFormularioObra}
            className="text-sm text-gray-600 underline"
          >
            Cancelar
          </button>
        </div>

        {renderFormularioObra()}

        <div className="space-y-4 rounded border bg-gray-50 p-3">
          <h3 className="font-semibold">Tabela Comercial da Obra</h3>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Servicos</h4>
            {renderCamposTabelaObra("servicos")}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Locacoes</h4>
            {renderCamposTabelaObra("locacoes")}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={
              modoFormularioObra === "nova"
                ? salvarNovaObra
                : salvarObraEditada
            }
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Salvar
          </button>
          {modoFormularioObra === "editar" && (
            <button
              type="button"
              onClick={() => excluirObra(formularioObra)}
              className="rounded border border-red-200 bg-white px-4 py-2 text-red-600"
            >
              Excluir
            </button>
          )}
        </div>
      </section>
    );
  };

  const renderCamposTabelaConstrutora = (grupo) => {
    const tabela = normalizarTabelaComercial(
      tabelaConstrutoraEditada || criarCopiaTabelaComercialPadrao(),
      { incluirVersaoPadrao: true }
    );

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Object.entries(tabela[grupo]).map(([chave, valor]) => {
          const chaveCampo = obterChaveCampoTabela(grupo, chave);

          return (
            <div key={chave}>
              <label className="block text-sm font-medium">{chave}</label>
              <input
                type="text"
                inputMode="decimal"
                value={
                  camposTabelaEmEdicao[chaveCampo] ?? formatarMoeda(valor)
                }
                onFocus={() => iniciarEdicaoValorTabela(grupo, chave, valor)}
                onChange={(event) =>
                  alterarValorTabelaEditado(grupo, chave, event.target.value)
                }
                onBlur={() => finalizarEdicaoValorTabela(grupo, chave)}
                className="w-full rounded border p-2 text-sm"
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormularioConstrutora = () => (
    <div className="space-y-3">
      <Bloco titulo="Identificacao">
        <Campo label="Nome curto" value={formularioConstrutora.nome} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, nome: valor })} />
        <Campo label="Razao social" value={formularioConstrutora.razaoSocial} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, razaoSocial: valor })} />
        <Campo label="Nome fantasia" value={formularioConstrutora.nomeFantasia} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, nomeFantasia: valor })} />
        <Campo label="CNPJ" value={formularioConstrutora.cnpj} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, cnpj: valor })} />
        <Campo label="Inscricao estadual" value={formularioConstrutora.inscricaoEstadual} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, inscricaoEstadual: valor })} />
        <Campo label="Inscricao municipal" value={formularioConstrutora.inscricaoMunicipal} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, inscricaoMunicipal: valor })} />
        <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input
            type="checkbox"
            checked={formularioConstrutora.ativa !== false}
            onChange={(event) =>
              setFormularioConstrutora({
                ...formularioConstrutora,
                ativa: event.target.checked,
              })
            }
          />
          Construtora ativa
        </label>
      </Bloco>

      <Bloco titulo="Contato principal">
        <Campo label="Responsavel" value={formularioConstrutora.responsavel} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, responsavel: valor })} />
        <Campo label="Cargo do responsavel" value={formularioConstrutora.cargoResponsavel} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, cargoResponsavel: valor })} />
        <Campo label="Telefone" value={formularioConstrutora.telefone} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, telefone: valor })} />
        <Campo label="WhatsApp" value={formularioConstrutora.whatsapp} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, whatsapp: valor })} />
        <Campo label="E-mail" type="email" value={formularioConstrutora.email} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, email: valor })} />
        <Campo label="E-mail financeiro" type="email" value={formularioConstrutora.emailFinanceiro} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, emailFinanceiro: valor })} />
      </Bloco>

      <Bloco titulo="Endereco">
        <Campo label="CEP" value={formularioConstrutora.cep} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, cep: valor })} />
        <Campo label="Logradouro" value={formularioConstrutora.logradouro} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, logradouro: valor })} />
        <Campo label="Numero" value={formularioConstrutora.numero} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, numero: valor })} />
        <Campo label="Complemento" value={formularioConstrutora.complemento} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, complemento: valor })} />
        <Campo label="Bairro" value={formularioConstrutora.bairro} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, bairro: valor })} />
        <Campo label="Cidade" value={formularioConstrutora.cidade} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, cidade: valor })} />
        <Campo label="Estado" value={formularioConstrutora.estado} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, estado: valor })} />
      </Bloco>

      <Bloco titulo="Comercial e financeiro">
        <Campo label="Condicao de pagamento" value={formularioConstrutora.condicaoPagamento} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, condicaoPagamento: valor })} />
        <Campo label="Responsavel comercial" value={formularioConstrutora.responsavelComercial} onChange={(valor) => setFormularioConstrutora({ ...formularioConstrutora, responsavelComercial: valor })} />
        <label className="block text-sm font-medium md:col-span-2">
          Observacoes internas
          <textarea
            value={formularioConstrutora.observacoesInternas || ""}
            onChange={(event) =>
              setFormularioConstrutora({
                ...formularioConstrutora,
                observacoesInternas: event.target.value,
              })
            }
            className="mt-1 w-full rounded border p-2"
            rows={3}
          />
        </label>
      </Bloco>
    </div>
  );

  const renderPainelFormularioConstrutora = () => {
    if (!modoFormularioConstrutora) return null;

    return (
      <section
        ref={formularioConstrutoraRef}
        onMouseDown={removerDestaqueFormularioConstrutora}
        onFocusCapture={removerDestaqueFormularioConstrutora}
        onTouchStart={removerDestaqueFormularioConstrutora}
        className={`scroll-mt-24 space-y-4 rounded-xl border bg-white p-3 shadow-sm ${
          destacarFormularioConstrutora
            ? classeFormularioDestacado
            : "transition-[outline,box-shadow,background-color] duration-200"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {modoFormularioConstrutora === "nova"
              ? "Nova Construtora"
              : "Editar Construtora"}
          </h3>
          <button
            type="button"
            onClick={fecharFormularioConstrutora}
            className="text-sm text-gray-600 underline"
          >
            Cancelar
          </button>
        </div>

        {renderFormularioConstrutora()}

        {modoFormularioConstrutora === "editar" && (
          <div className="space-y-4 rounded border bg-gray-50 p-3">
            <h3 className="font-semibold">Tabela Comercial da Construtora</h3>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Servicos</h4>
              {renderCamposTabelaConstrutora("servicos")}
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Locacoes</h4>
              {renderCamposTabelaConstrutora("locacoes")}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={
              modoFormularioConstrutora === "nova"
                ? salvarNovaConstrutora
                : salvarConstrutoraEditada
            }
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Salvar
          </button>
          {modoFormularioConstrutora === "editar" && (
            <button
              type="button"
              onClick={() => excluirConstrutora(formularioConstrutora)}
              className="rounded border border-red-200 bg-white px-4 py-2 text-red-600"
            >
              Excluir
            </button>
          )}
        </div>
      </section>
    );
  };

  const renderDetalhesCompletosObra = () => {
    const obra = obraDetalhesSelecionada;
    const construtora = obra
      ? obterConstrutoraDaObra(obra, construtoras)
      : null;
    const resumoAtivos = obra
      ? obterResumoUnidadesEquipamentosAtivos(obra, atividades)
      : [];
    const resumoBalancinhos = resumoAtivos.filter(
      (item) =>
        item.grupo.startsWith("Balancinho ") ||
        item.grupo === "Kit Contrapeso"
    );
    const resumoMiniGruas = resumoAtivos.filter((item) =>
      item.grupo.startsWith("Mini Grua")
    );
    const totalBalancinhos = unidadesAtivasObraDetalhes.filter(
      (unidade) => unidade.equipamento === "Balancinho"
    ).length;
    const totalMiniGruas = unidadesAtivasObraDetalhes.filter(
      (unidade) => unidade.equipamento === "Mini Grua"
    ).length;
    const servicosExecutados = obra
      ? obterServicosExecutadosObra(obra, atividades)
      : [];
    const historico = obra
      ? obterHistoricoAtividadesObra(obra, atividades)
      : [];
    const patrimonios = [
      ...new Set(
        historico
          .flatMap((atividade) =>
            Array.isArray(atividade.numerosPatrimonio)
              ? atividade.numerosPatrimonio
              : []
          )
          .map((numero) => String(numero || "").trim())
          .filter(Boolean)
      ),
    ];

    const gruposServicos = obra
      ? [
          {
            titulo: "Balancinho",
            equipamento: "Balancinho",
            servicos: [
              ["Instalacao", ["Instalação"]],
              ["Deslocamento", ["Deslocamento"]],
              ["Manutencao", ["Manutenção"]],
              ["Remocao", ["Remoção"]],
              ["Somente aluguel", ["Somente aluguel", "Somente aluguel / entrega"]],
              ["Somente recolhimento", ["Somente recolhimento", "Recolhimento / devolução"]],
            ],
          },
          {
            titulo: "Mini Grua",
            equipamento: "Mini Grua",
            servicos: [
              ["Instalacao", ["Instalação"]],
              ["Ascensao", ["Ascensão"]],
              ["Manutencao", ["Manutenção"]],
              ["Remocao", ["Remoção"]],
              ["Somente aluguel", ["Somente aluguel", "Somente aluguel / entrega"]],
              ["Somente recolhimento", ["Somente recolhimento", "Recolhimento / devolução"]],
            ],
          },
        ]
      : [];

    return (
      <div ref={detalhesObraTopoRef} className="scroll-mt-24 space-y-4">
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <label className="block text-sm font-medium">
            Obra
            <select
              value={obraDetalhesSelecionadaChave || ""}
              onChange={(event) =>
                setObraDetalhesSelecionadaChave(event.target.value || null)
              }
              className="mt-1 w-full rounded border bg-white p-2"
            >
              <option value="">Selecione uma obra</option>
              {obrasOrdenadasParaDetalhes.map((item) => (
                <option
                  key={obterChaveObraCadastro(item)}
                  value={obterChaveObraCadastro(item)}
                >
                  {item.nome || "Obra sem nome"} —{" "}
                  {item.construtora || "Sem construtora"}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!obra ? (
          obrasAtivasDetalhes.length === 0 ? (
            <p className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-500">
              Nenhuma obra com equipamento ativo. Use o seletor acima para
              consultar qualquer obra cadastrada.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {obrasAtivasDetalhes.map(
                ({ obra: obraAtiva, construtora: construtoraAtiva, totalAtivos, categorias }) => {
                  const categoriasVisiveis = categorias.filter(
                    (categoria) => categoria.valor > 0
                  );
                  const rotulosCategorias = {
                    eletricos: "Balancinhos Elétricos",
                    manuais: "Balancinhos Manuais",
                    contrapesos: "Kits de Contrapeso",
                    miniGruas: "Mini Gruas",
                  };

                  return (
                    <button
                      type="button"
                      key={obterChaveObraCadastro(obraAtiva)}
                      onClick={() =>
                        abrirDetalhesObra(obraAtiva, construtoraAtiva)
                      }
                      className="rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {obraAtiva.nome || "Obra sem nome"}
                          </p>
                          <p className="truncate text-sm text-gray-500">
                            {construtoraAtiva?.nome ||
                              obraAtiva.construtora ||
                              "Sem construtora"}
                          </p>
                        </div>
                        <div className="flex min-w-[48px] flex-col items-center rounded-lg bg-blue-50 px-2 py-1 text-blue-700">
                          <span className="text-xl font-bold leading-none">
                            {totalAtivos}
                          </span>
                          <span className="text-[10px] uppercase">ativos</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {categoriasVisiveis.map((categoria) => (
                          <span
                            key={categoria.chave}
                            className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
                          >
                            {rotulosCategorias[categoria.chave] ||
                              categoria.rotulo}
                            : <strong>{categoria.valor}</strong>
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          )
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setObraDetalhesSelecionadaChave(null)}
                className="rounded-xl border bg-white px-4 py-2 text-gray-600 shadow-sm"
              >
                Ver lista de obras
              </button>
              <button
                type="button"
                onClick={() => abrirNovaAtividade(obra, construtora)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow-sm"
              >
                Nova Atividade
              </button>
              <button
                type="button"
                onClick={() => editarObra(obra)}
                className="rounded-xl border bg-white px-4 py-2 text-blue-600 shadow-sm"
              >
                Editar Obra
              </button>
              <button
                type="button"
                onClick={() => setVisualizacao("ativos")}
                className="rounded-xl border bg-white px-4 py-2 text-gray-700 shadow-sm"
              >
                Voltar para Equipamentos Ativos
              </button>
              <button
                type="button"
                onClick={() => setVisualizacao("gestao")}
                className="rounded-xl border bg-white px-4 py-2 text-gray-700 shadow-sm"
              >
                Voltar para Gestão
              </button>
            </div>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold">Identificacao</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>Nome:</strong> {obra.nome || "-"}</p>
                  <p><strong>Construtora:</strong> {construtora?.nome || obra.construtora || "-"}</p>
                  <p><strong>Situacao:</strong> {obra.situacao || "Ativa"}</p>
                  <p><strong>CNPJ:</strong> {obra.cnpj || "-"}</p>
                  <p><strong>CNO:</strong> {obra.cno || "-"}</p>
                  <p><strong>Codigo interno:</strong> {obra.codigoInterno || "-"}</p>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold">Endereco</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>Endereco completo:</strong> {montarEndereco(obra) || obra.endereco || "-"}</p>
                  <p><strong>CEP:</strong> {obra.cep || "-"}</p>
                  <p><strong>Ponto de referencia:</strong> {obra.pontoReferencia || "-"}</p>
                  {obra.enderecoEntregaDiferente && (
                    <p><strong>Endereco de entrega:</strong> {obra.enderecoEntrega || "-"}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold">Responsaveis e contatos</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>Responsavel:</strong> {obra.responsavel || obra.engenheiro || "-"}</p>
                  <p><strong>Cargo:</strong> {obra.cargoResponsavel || "-"}</p>
                  <p><strong>Telefone:</strong> {obra.telefone || "-"}</p>
                  <p><strong>WhatsApp:</strong> {obra.whatsapp || "-"}</p>
                  <p><strong>E-mail:</strong> {obra.email || "-"}</p>
                  {(obra.contatos || []).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(obra.contatos || []).map((contato, indice) => (
                        <div key={contato.id || indice} className="rounded border bg-gray-50 p-2">
                          <p className="font-medium">{contato.nome || contato.tipo || "Contato"}</p>
                          <p>{[contato.tipo, contato.cargo, contato.crea].filter(Boolean).join(" | ") || "-"}</p>
                          <p>{[contato.telefone, contato.whatsapp, contato.email].filter(Boolean).join(" | ") || "-"}</p>
                          <p>{contato.ativo === false ? "Inativo" : "Ativo"}{contato.principal ? " | Principal" : ""}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold">Operacao</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>Engenheiro:</strong> {obra.engenheiro || "-"}</p>
                  <p><strong>Horario de entrega:</strong> {obra.horarioEntrega || "-"}</p>
                  <p><strong>Orientacoes de acesso:</strong> {obra.orientacoesAcesso || "-"}</p>
                  <p><strong>Observacoes:</strong> {obra.observacoes || "-"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="font-semibold">Contratos</h3>
              <p className="mt-1 text-sm text-gray-500">
                Area reservada para historico e dados contratuais da obra. O armazenamento sera implementado em etapa futura.
              </p>
            </section>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="font-semibold">Equipamentos ativos</h3>
              {resumoAtivos.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  Nenhum equipamento ativo.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {resumoAtivos.map((item) => (
                    <div key={item.grupo} className="rounded-lg bg-blue-50 p-3">
                      <p className="text-sm text-blue-700">{item.grupo}</p>
                      <p className="text-2xl font-bold text-blue-800">{item.total}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded border p-3 text-sm">
                  <p><strong>Balancinhos ativos:</strong> {totalBalancinhos}</p>
                  {resumoBalancinhos.map((item) => (
                    <p key={item.grupo}>{item.grupo}: {item.total}</p>
                  ))}
                </div>
                <div className="rounded border p-3 text-sm">
                  <p><strong>Mini Gruas ativas:</strong> {totalMiniGruas}</p>
                  {resumoMiniGruas.map((item) => (
                    <p key={item.grupo}>{item.grupo}: {item.total}</p>
                  ))}
                </div>
              </div>
              {unidadesAtivasObraDetalhes.length > 0 && (
                <div className="mt-5">
                  <h4 className="font-medium">Unidades em locação</h4>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {unidadesAtivasObraDetalhes.map((unidade) => {
                      const identificacao = `Unidade ${
                        unidade.indiceUnidade || 1
                      }`;

                      return (
                        <article
                          key={unidade.idUnidade}
                          className="rounded-lg border bg-gray-50 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">
                                {formatarEquipamentoDetalhesObra(unidade) ||
                                  "Equipamento"}
                              </p>
                              {(!unidade.numeroPatrimonio ||
                                unidade.unidadeLegada) && (
                                <p className="text-sm text-gray-500">
                                  {identificacao}
                                  {unidade.unidadeLegada
                                    ? " (registro legado)"
                                    : ""}
                                </p>
                              )}
                            </div>
                            {unidade.tamanho && (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                                Tamanho: {unidade.tamanho}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                            <p>
                              <strong>Patrimônio:</strong>{" "}
                              {unidade.numeroPatrimonio || "Não informado"}
                            </p>
                            <p>
                              <strong>Ancoragem:</strong>{" "}
                              {unidade.ancoragem || "-"}
                            </p>
                            {unidade.equipamento === "Balancinho" && (
                              <p>
                                <strong>Kit Contrapeso:</strong>{" "}
                                {unidade.usaContrapeso ? "Sim" : "Não"}
                              </p>
                            )}
                            <p>
                              <strong>Em locação desde:</strong>{" "}
                              {formatarDataDetalhesObra(unidade.dataEntrada) ||
                                "-"}
                            </p>
                          </div>

                          {unidade.atividadeOrigemId && abrirAtividade && (
                            <button
                              type="button"
                              onClick={() =>
                                abrirAtividadeRecente({
                                  id: unidade.atividadeOrigemId,
                                })
                              }
                              className="mt-3 rounded border bg-white px-3 py-1.5 text-sm text-blue-600"
                            >
                              Abrir atividade de origem
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
              {patrimonios.length > 0 && (
                <p className="mt-3 text-sm">
                  <strong>Patrimonios registrados:</strong> {patrimonios.join(", ")}
                </p>
              )}
            </section>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="font-semibold">Quantidade de servicos executados</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {gruposServicos.map((grupo) => (
                  <div key={grupo.equipamento} className="rounded border p-3">
                    <h4 className="font-medium">{grupo.titulo}</h4>
                    <div className="mt-2 space-y-1 text-sm">
                      {grupo.servicos.map(([rotulo, nomes]) => (
                        <p key={rotulo}>
                          {rotulo}:{" "}
                          <strong>
                            {contarServicosObra(
                              obra,
                              grupo.equipamento,
                              nomes,
                              atividades
                            )}
                          </strong>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="font-semibold">Servicos executados</h3>
              {servicosExecutados.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  Nenhum servico executado.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {servicosExecutados.map((atividade, indice) => (
                    <button
                      type="button"
                      key={atividade.id || `executada-${indice}`}
                      disabled={!atividade.id}
                      onClick={() => atividade.id && abrirAtividade?.(atividade.id)}
                      className={`w-full rounded border bg-gray-50 p-3 text-left ${
                        atividade.id
                          ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50"
                          : "cursor-default"
                      }`}
                    >
                      <p className="font-medium">
                        {atividade.servico || "Servico"} — {formatarEquipamentoDetalhesObra(atividade)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Quantidade: {atividade.quantidade || 1}
                        {atividade.tamanho && atividade.equipamento === "Balancinho"
                          ? ` | Tamanho: ${atividade.tamanho}m`
                          : ""}
                      </p>
                      <p className="text-sm text-gray-500">
                        Agendado: {formatarDataDetalhesObra(atividade.dataAgendamento) || "-"} | Liberado: {formatarDataDetalhesObra(atividade.dataLiberacao) || "-"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="font-semibold">Historico completo de atividades</h3>
              {historico.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  Nenhuma atividade encontrada.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {historico.map((atividade, indice) => {
                    const numerosPatrimonio = Array.isArray(
                      atividade.numerosPatrimonio
                    )
                      ? atividade.numerosPatrimonio
                          .map((numero) => String(numero || "").trim())
                          .filter(Boolean)
                      : [];

                    return (
                      <button
                        type="button"
                        key={atividade.id || `historico-${indice}`}
                        disabled={!atividade.id}
                        onClick={() => atividade.id && abrirAtividade?.(atividade.id)}
                        className={`w-full rounded border p-3 text-left ${
                          atividade.id
                            ? "cursor-pointer bg-white hover:border-blue-300 hover:bg-blue-50"
                            : "cursor-default bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium">
                            {atividade.servico || "Servico"} — {formatarEquipamentoDetalhesObra(atividade)}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatarDataDetalhesObra(
                              atividade.dataLiberacao ||
                                atividade.dataAgendamento
                            ) || "Sem data"}
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-sm text-gray-600">
                          <p>Quantidade: {atividade.quantidade || 1}</p>
                          {atividade.servico === "Deslocamento" ? (
                            <p>
                              Tamanho: {atividade.tamanhoAnterior || "-"} →{" "}
                              {atividade.tamanhoNovo || "-"}
                            </p>
                          ) : (
                            atividade.tamanho && (
                              <p>Tamanho: {atividade.tamanho}m</p>
                            )
                          )}
                          {atividade.ancoragem && (
                            <p>Ancoragem: {atividade.ancoragem}</p>
                          )}
                          {atividade.equipeResponsavel && (
                            <p>Equipe: {atividade.equipeResponsavel}</p>
                          )}
                          {numerosPatrimonio.length > 0 && (
                            <p>Patrimonios: {numerosPatrimonio.join(", ")}</p>
                          )}
                          {atividade.usaContrapeso && <p>Contrapeso: Sim</p>}
                          {atividade.alteracaoContrapeso &&
                            atividade.alteracaoContrapeso !== "nenhuma" && (
                              <p>
                                Alteracao de contrapeso:{" "}
                                {atividade.alteracaoContrapeso}{" "}
                                {atividade.quantidadeContrapeso || 1}
                              </p>
                            )}
                          {atividade.observacoes && (
                            <p>Observacoes: {atividade.observacoes}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    );
  };

  const renderGestao = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={abrirFormularioNovaConstrutora}
          className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow-sm"
        >
          Nova Construtora
        </button>
        <button
          type="button"
          onClick={() => abrirNovaObra()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow-sm"
        >
          Nova Obra
        </button>
      </div>

      {renderPainelFormularioConstrutora()}
      {renderPainelFormularioObra()}

      <input
        type="text"
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
        placeholder="Buscar construtora, obra, CNPJ, responsavel ou contato"
        className="w-full rounded-xl border px-3 py-2 shadow-sm"
      />

      {dadosConstrutoras.length === 0 ? (
        <p className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-500">
          Nenhuma construtora ou obra encontrada.
        </p>
      ) : (
        dadosConstrutoras.map(({ construtora, obras: obrasDaConstrutora, totalObras, totalAtivos }) => {
          const construtoraAberta = String(construtoraAbertaId) === String(construtora.id || construtora.nome);
          const contato = obterContatoPrincipal(construtora);

          return (
            <section key={construtora.id || construtora.nome} className="rounded-xl border bg-white shadow-sm">
              <button
                type="button"
                onClick={() => alternarConstrutora(construtora.id || construtora.nome)}
                className="flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold">{construtora.nome || "Construtora sem nome"}</p>
                  <p className="text-sm text-gray-500">
                    {totalObras} obra(s) | {totalAtivos} equipamento(s) ativo(s)
                  </p>
                  {construtora.responsavel && (
                    <p className="text-sm text-gray-600">Responsavel: {construtora.responsavel}</p>
                  )}
                  {contato && <p className="text-sm text-gray-600">Contato: {contato}</p>}
                  {construtora.email && <p className="text-sm text-gray-600">E-mail: {construtora.email}</p>}
                </div>
                <span className="rounded-full border px-3 py-1 text-sm text-gray-600">
                  {construtoraAberta ? "Recolher" : "Expandir"}
                </span>
              </button>

              {construtoraAberta && (
                <div className="space-y-3 border-t bg-gray-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => editarConstrutora(construtora)}
                      className="rounded-xl border bg-white px-4 py-2 text-sm text-blue-600 shadow-sm"
                    >
                      Editar Construtora
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirNovaObra(construtora)}
                      className="rounded-xl border bg-white px-4 py-2 text-sm text-blue-600 shadow-sm"
                    >
                      Nova Obra nesta Construtora
                    </button>
                  </div>

                  {obrasDaConstrutora.length === 0 ? (
                    <p className="rounded-xl border bg-white p-3 text-sm text-gray-500">
                      Nenhuma obra vinculada a esta construtora.
                    </p>
                  ) : (
                    obrasDaConstrutora.map((obra) => {
                      const resumoAtivos = obterResumoEquipamentosAtivos(obra, atividades);
                      const totalAtivosObra = obterTotalEquipamentosAtivos(obra, atividades);
                      const obraAberta = String(obraAbertaId) === String(obra.id || obra.nome);
                      const contatoObra = obterContatoPrincipal(obra);
                      const responsavel = texto(obra.responsavel) || texto(obra.engenheiro);

                      return (
                        <article key={obra.id || obra.nome} className="rounded-xl border bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-1">
                              <p className="text-base font-semibold">{obra.nome || "Obra sem nome"}</p>
                              <p className="text-sm text-gray-500">
                                Situacao: {situacaoObra(obra)} | {totalAtivosObra} ativo(s)
                              </p>
                              {resumoAtivos.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {resumoAtivos.map((item) => (
                                    <span key={item.grupo} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                                      {item.grupo}: {item.total}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {responsavel && <p className="text-sm text-gray-600">Responsavel: {responsavel}</p>}
                              {contatoObra && <p className="text-sm text-gray-600">Contato: {contatoObra}</p>}
                              {obra.cidade && <p className="text-sm text-gray-600">Cidade: {obra.cidade}</p>}
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                              <button
                                type="button"
                                onClick={() => alternarObraGestao(obra.id || obra.nome)}
                                className="rounded-xl border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                              >
                                {obraAberta ? "Recolher" : "Expandir"}
                              </button>
                              <button
                                type="button"
                                onClick={() => editarObra(obra)}
                                className="rounded-xl border bg-white px-4 py-2 text-sm text-blue-600 shadow-sm"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirNovaAtividade(obra, construtora)}
                                className="rounded-xl border bg-white px-4 py-2 text-sm text-blue-600 shadow-sm"
                              >
                                Nova Atividade
                              </button>
                            </div>
                          </div>

                          {obraAberta && (
                            <div className="mt-4">
                              {renderDetalheObra({ obra, construtora, resumo: resumoAtivos })}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );

  return (
    <div className="p-3 space-y-3 sm:p-4">
      <div>
        <h2 className="text-xl font-semibold">Construtoras e Obras</h2>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-100 p-1 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setVisualizacao("ativos")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            visualizacao === "ativos" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"
          }`}
        >
          Equipamentos Ativos
        </button>
        <button
          type="button"
          onClick={() => setVisualizacao("gestao")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            visualizacao === "gestao" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"
          }`}
        >
          Gestão
        </button>
        <button
          type="button"
          onClick={() => setVisualizacao("detalhes")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            visualizacao === "detalhes"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-gray-600"
          }`}
        >
          Detalhes da Obra
        </button>
      </div>

      {visualizacao === "ativos"
        ? renderEquipamentosAtivos()
        : visualizacao === "gestao"
          ? renderGestao()
          : renderDetalhesCompletosObra()}
    </div>
  );
}
