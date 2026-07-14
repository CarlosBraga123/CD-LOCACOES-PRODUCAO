import { useEffect, useState } from "react";
import {
  converterMoedaParaNumero,
  formatarMoeda,
  formatarNumeroParaEdicao,
  normalizarValoresMonetarios,
} from "../utils/moeda";

const tabelaComercialInicial = {
  versao: 1,
  servicos: {
    "Balancinho-Eletrico-Instalação": 1000,
    "Balancinho-Eletrico-Deslocamento": 1000,
    "Balancinho-Eletrico-Manutenção": 0,
    "Balancinho-Eletrico-Remoção": 1000,
    "Balancinho-Manual-Instalação": 900,
    "Balancinho-Manual-Deslocamento": 900,
    "Balancinho-Manual-Manutenção": 0,
    "Balancinho-Manual-Remoção": 900,
    "Balancinho-Contrapeso-Instalação": 0,
    "Balancinho-Contrapeso-Deslocamento": 0,
    "Balancinho-Contrapeso-Manutenção": 0,
    "Balancinho-Contrapeso-Remoção": 0,
    "Mini Grua-500kg-Instalação": 4000,
    "Mini Grua-500kg-Ascensão": 900,
    "Mini Grua-500kg-Manutenção": 0,
    "Mini Grua-500kg-Remoção": 4000,
    "Mini Grua-1T-Instalação": 8500,
    "Mini Grua-1T-Ascensão": 1000,
    "Mini Grua-1T-Manutenção": 0,
    "Mini Grua-1T-Remoção": 8500,
  },
  locacoes: {
    "Balancinho-Eletrico": 1200,
    "Balancinho-Manual": 1000,
    "Balancinho-Contrapeso": 600,
    "Mini Grua-500kg": 0,
    "Mini Grua-1T": 0,
  },
};

export default function Construtoras() {
  const [construtoras, setConstrutoras] = useState([]);
  const [nova, setNova] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [tabelaEditada, setTabelaEditada] = useState(null);
  const [camposTabelaEmEdicao, setCamposTabelaEmEdicao] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const salvas = JSON.parse(localStorage.getItem("construtoras") || "[]");
    setConstrutoras(salvas);
    setIsLoading(false);
  }, []);

  const copiarTabelaComercialPadrao = () => {
    const tabelaPadraoSalva = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null");
    const tabelaPadrao = normalizarTabelaComercial(tabelaPadraoSalva || tabelaComercialInicial);

    return {
      origem: "padrao",
      versaoBase: tabelaPadrao.versao,
      atualizadoEm: new Date().toISOString(),
      servicos: { ...tabelaPadrao.servicos },
      locacoes: { ...tabelaPadrao.locacoes },
    };
  };

  const normalizarTabelaComercial = (tabela = {}) => ({
    ...tabela,
    versao: tabela.versao || 1,
    servicos: {
      ...tabelaComercialInicial.servicos,
      ...(tabela.servicos || {}),
    },
    locacoes: {
      ...tabelaComercialInicial.locacoes,
      ...(tabela.locacoes || {}),
    },
  });

  const obterChaveCampoTabela = (grupo, chave) => `${grupo}:${chave}`;

  const atualizarValorTabela = (grupo, chave, valor) => {
    const numero = converterMoedaParaNumero(valor);
    if (numero === null) return;

    setTabelaEditada((tabelaAtual) => {
      const tabela = normalizarTabelaComercial(tabelaAtual || copiarTabelaComercialPadrao());

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
    atualizarValorTabela(grupo, chave, camposTabelaEmEdicao[chaveCampo]);
    setCamposTabelaEmEdicao((atuais) => {
      const novos = { ...atuais };
      delete novos[chaveCampo];
      return novos;
    });
  };

  const normalizarTabelaParaSalvar = (tabela) => ({
    ...normalizarTabelaComercial(tabela),
    servicos: normalizarValoresMonetarios(normalizarTabelaComercial(tabela).servicos),
    locacoes: normalizarValoresMonetarios(normalizarTabelaComercial(tabela).locacoes),
  });

  const renderCamposTabela = (grupo) => {
    const tabela = normalizarTabelaComercial(tabelaEditada || copiarTabelaComercialPadrao());

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(tabela[grupo]).map(([chave, valor]) => {
          const chaveCampo = obterChaveCampoTabela(grupo, chave);

          return (
            <div key={chave}>
              <label className="block text-sm font-medium">{chave}</label>
              <input
                type="text"
                inputMode="decimal"
                value={camposTabelaEmEdicao[chaveCampo] ?? formatarMoeda(valor)}
                onFocus={() => iniciarEdicaoValorTabela(grupo, chave, valor)}
                onChange={(e) => alterarValorTabelaEditado(grupo, chave, e.target.value)}
                onBlur={() => finalizarEdicaoValorTabela(grupo, chave)}
                className="border p-2 rounded w-full text-sm"
              />
            </div>
          );
        })}
      </div>
    );
  };

  const salvarNova = () => {
    if (!nova.trim()) return;
    const novaConstrutora = {
      id: Date.now(),
      nome: nova.trim(),
      tabelaComercial: copiarTabelaComercialPadrao(),
    };
    const atualizadas = [...construtoras, novaConstrutora];
    setConstrutoras(atualizadas);
    localStorage.setItem("construtoras", JSON.stringify(atualizadas));
    setNova("");
  };

  const iniciarEdicao = (id, nome) => {
    const construtora = construtoras.find((c) => c.id === id);

    setEditandoId(id);
    setNomeEditado(nome);
    setCamposTabelaEmEdicao({});
    setTabelaEditada(
      normalizarTabelaComercial(construtora?.tabelaComercial || copiarTabelaComercialPadrao())
    );
  };

  const salvarEdicao = () => {
    const atualizadas = construtoras.map((c) =>
      c.id === editandoId
        ? {
            ...c,
            nome: nomeEditado,
            tabelaComercial: {
              ...normalizarTabelaParaSalvar(tabelaEditada || c.tabelaComercial || copiarTabelaComercialPadrao()),
              origem: "padrao",
              atualizadoEm: new Date().toISOString(),
            },
          }
        : c
    );
    setConstrutoras(atualizadas);
    localStorage.setItem("construtoras", JSON.stringify(atualizadas));
    setEditandoId(null);
    setNomeEditado("");
    setTabelaEditada(null);
    setCamposTabelaEmEdicao({});
  };

  const excluir = (id) => {
    if (confirm("Tem certeza que deseja excluir esta construtora?")) {
      const atualizadas = construtoras.filter((c) => c.id !== id);
      setConstrutoras(atualizadas);
      localStorage.setItem("construtoras", JSON.stringify(atualizadas));
      setEditandoId(null);
      setTabelaEditada(null);
      setCamposTabelaEmEdicao({});
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">🏗️ Construtoras</h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Nova Construtora"
          className="border p-2 rounded flex-1"
        />
        <button onClick={salvarNova} className="bg-blue-600 text-white px-4 py-2 rounded">
          Salvar
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">🔄 Carregando construtoras...</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {construtoras.map((c) => (
            <li key={c.id} className="border p-2 rounded">
              {editandoId === c.id ? (
                <div className="flex flex-col w-full gap-3">
                  <input
                    type="text"
                    value={nomeEditado}
                    onChange={(e) => setNomeEditado(e.target.value)}
                    className="border p-1 rounded flex-1"
                  />
                  <div className="border rounded p-3 space-y-4 bg-gray-50">
                    <h3 className="font-semibold">Tabela Comercial da Construtora</h3>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Serviços</h4>
                      {renderCamposTabela("servicos")}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Locações</h4>
                      {renderCamposTabela("locacoes")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={salvarEdicao} className="text-green-600 text-sm underline">
                      Salvar
                    </button>
                    <button onClick={() => excluir(c.id)} className="text-red-600 text-sm underline">
                      Excluir
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span>{c.nome}</span>
                  <button
                    onClick={() => iniciarEdicao(c.id, c.nome)}
                    className="text-blue-600 text-sm underline"
                  >
                    Editar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
