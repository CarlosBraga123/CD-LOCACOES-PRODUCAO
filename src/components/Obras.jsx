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

export default function Obras() {
  const [obras, setObras] = useState([]);
  const [construtoras, setConstrutoras] = useState([]);
  const [novaObra, setNovaObra] = useState({
    nome: "",
    construtora: "",
    engenheiro: "",
    endereco: "",
    observacoes: "",
  });
  const [editandoId, setEditandoId] = useState(null);
  const [obraEditada, setObraEditada] = useState(null);
  const [camposTabelaEmEdicao, setCamposTabelaEmEdicao] = useState({});

  useEffect(() => {
    setConstrutoras(JSON.parse(localStorage.getItem("construtoras") || "[]"));
    setObras(JSON.parse(localStorage.getItem("obras") || "[]"));
  }, []);

  const copiarTabelaComercialDaConstrutora = (nomeConstrutora) => {
    const construtora = construtoras.find((c) => c.nome === nomeConstrutora);
    const tabelaPadraoSalva = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null");
    const tabelaPadrao = normalizarTabelaComercial(tabelaPadraoSalva || tabelaComercialInicial);
    const tabelaOrigem = construtora?.tabelaComercial || tabelaPadrao;

    return {
      origem: "construtora",
      construtoraId: construtora?.id || null,
      atualizadoEm: new Date().toISOString(),
      servicos: { ...tabelaPadrao.servicos, ...(tabelaOrigem.servicos || {}) },
      locacoes: { ...tabelaPadrao.locacoes, ...(tabelaOrigem.locacoes || {}) },
    };
  };

  const normalizarTabelaComercial = (tabela = {}) => ({
    ...tabela,
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

  const atualizarValorTabelaObra = (grupo, chave, valor) => {
    const numero = converterMoedaParaNumero(valor);
    if (numero === null) return;

    setObraEditada((obraAtual) => {
      const tabelaAtual =
        obraAtual.tabelaComercial ||
        copiarTabelaComercialDaConstrutora(obraAtual.construtora);

      return {
        ...obraAtual,
        tabelaComercial: {
          ...tabelaAtual,
          atualizadoEm: new Date().toISOString(),
          [grupo]: {
            ...normalizarTabelaComercial(tabelaAtual)[grupo],
            [chave]: numero,
          },
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
    atualizarValorTabelaObra(grupo, chave, camposTabelaEmEdicao[chaveCampo]);
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
    const tabela = normalizarTabelaComercial(
      obraEditada?.tabelaComercial ||
      copiarTabelaComercialDaConstrutora(obraEditada?.construtora)
    );

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

  const salvar = () => {
    if (!novaObra.nome.trim() || !novaObra.construtora) return;

    const nova = {
      ...novaObra,
      id: Date.now(),
      tabelaComercial: copiarTabelaComercialDaConstrutora(novaObra.construtora),
    };

    const atualizadas = [...obras, nova];
    setObras(atualizadas);
    localStorage.setItem("obras", JSON.stringify(atualizadas));
    setNovaObra({ nome: "", construtora: "", engenheiro: "", endereco: "", observacoes: "" });
  };

  const iniciarEdicao = (obra) => {
    setEditandoId(obra.id);
    setCamposTabelaEmEdicao({});
    setObraEditada({
      ...obra,
      tabelaComercial:
        obra.tabelaComercial ||
        copiarTabelaComercialDaConstrutora(obra.construtora),
    });
  };

  const salvarEdicao = () => {
    const atualizadas = obras.map((o) =>
      o.id === editandoId
        ? {
            ...obraEditada,
            tabelaComercial:
              normalizarTabelaParaSalvar(
                obraEditada.tabelaComercial ||
                copiarTabelaComercialDaConstrutora(obraEditada.construtora)
              ),
          }
        : o
    );
    setObras(atualizadas);
    localStorage.setItem("obras", JSON.stringify(atualizadas));
    setEditandoId(null);
    setObraEditada(null);
    setCamposTabelaEmEdicao({});
  };

  const excluir = (id) => {
    if (confirm("Deseja realmente excluir esta obra?")) {
      const atualizadas = obras.filter((o) => o.id !== id);
      setObras(atualizadas);
      localStorage.setItem("obras", JSON.stringify(atualizadas));
      setEditandoId(null);
      setCamposTabelaEmEdicao({});
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">🧱 Obras</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={novaObra.construtora}
          onChange={(e) => setNovaObra({ ...novaObra, construtora: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Construtora</option>
          {construtoras.map((c) => (
            <option key={c.id} value={c.nome}>{c.nome}</option>
          ))}
        </select>
        <input
          type="text"
          value={novaObra.nome}
          onChange={(e) => setNovaObra({ ...novaObra, nome: e.target.value })}
          placeholder="Nome da Obra"
          className="border p-2 rounded"
        />
        <input
          type="text"
          value={novaObra.engenheiro}
          onChange={(e) => setNovaObra({ ...novaObra, engenheiro: e.target.value })}
          placeholder="Engenheiro responsável"
          className="border p-2 rounded"
        />
        <input
          type="text"
          value={novaObra.endereco}
          onChange={(e) => setNovaObra({ ...novaObra, endereco: e.target.value })}
          placeholder="Endereço"
          className="border p-2 rounded"
        />
        <input
          type="text"
          value={novaObra.observacoes}
          onChange={(e) => setNovaObra({ ...novaObra, observacoes: e.target.value })}
          placeholder="Observações"
          className="border p-2 rounded"
        />
      </div>

      <button onClick={salvar} className="bg-blue-600 text-white px-4 py-2 rounded">
        Salvar
      </button>

      <ul className="mt-4 space-y-2">
        {obras.map((obra) => (
          <li key={obra.id} className="border p-3 rounded space-y-2 bg-white shadow-sm">
            {editandoId === obra.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={obraEditada.nome}
                  onChange={(e) => setObraEditada({ ...obraEditada, nome: e.target.value })}
                  placeholder="Nome da Obra"
                  className="border p-2 rounded w-full"
                />
                <select
                  value={obraEditada.construtora}
                  onChange={(e) => setObraEditada({ ...obraEditada, construtora: e.target.value })}
                  className="border p-2 rounded w-full"
                >
                  <option value="">Construtora</option>
                  {construtoras.map((c) => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={obraEditada.engenheiro || ""}
                  onChange={(e) => setObraEditada({ ...obraEditada, engenheiro: e.target.value })}
                  placeholder="Engenheiro responsável"
                  className="border p-2 rounded w-full"
                />
                <input
                  type="text"
                  value={obraEditada.endereco || ""}
                  onChange={(e) => setObraEditada({ ...obraEditada, endereco: e.target.value })}
                  placeholder="Endereço"
                  className="border p-2 rounded w-full"
                />
                <input
                  type="text"
                  value={obraEditada.observacoes || ""}
                  onChange={(e) => setObraEditada({ ...obraEditada, observacoes: e.target.value })}
                  placeholder="Observações"
                  className="border p-2 rounded w-full"
                />
                <div className="border rounded p-3 space-y-4 bg-gray-50">
                  <h3 className="font-semibold">Tabela Comercial da Obra</h3>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Serviços</h4>
                    {renderCamposTabela("servicos")}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Locações</h4>
                    {renderCamposTabela("locacoes")}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={salvarEdicao} className="text-green-600 text-sm underline">Salvar</button>
                  <button onClick={() => excluir(obra.id)} className="text-red-600 text-sm underline">Excluir</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <strong>{obra.nome}</strong> <small className="text-gray-500">({obra.construtora})</small><br />
                  👷 {obra.engenheiro || "—"}<br />
                  📍 {obra.endereco || "—"}<br />
                  📝 {obra.observacoes || "—"}
                </div>
                <button onClick={() => iniciarEdicao(obra)} className="text-blue-600 text-sm underline">Editar</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
