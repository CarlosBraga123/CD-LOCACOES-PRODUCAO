import { useEffect, useState } from "react";
import {
  converterMoedaParaNumero,
  formatarMoeda,
  formatarNumeroParaEdicao,
  normalizarValoresMonetarios,
} from "../utils/moeda";

const tabelaComercialInicial = {
  versao: 1,
  atualizadoEm: "",
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

export default function TabelaComercial() {
  const [tabela, setTabela] = useState(tabelaComercialInicial);
  const [camposEmEdicao, setCamposEmEdicao] = useState({});

  useEffect(() => {
    const salva = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null");

    if (!salva) return;

    setTabela({
      versao: salva.versao || 1,
      atualizadoEm: salva.atualizadoEm || "",
      servicos: {
        ...tabelaComercialInicial.servicos,
        ...(salva.servicos || {}),
      },
      locacoes: {
        ...tabelaComercialInicial.locacoes,
        ...(salva.locacoes || {}),
      },
    });
  }, []);

  const obterChaveCampo = (grupo, chave) => `${grupo}:${chave}`;

  const atualizarValor = (grupo, chave, valor) => {
    const numero = converterMoedaParaNumero(valor);
    if (numero === null) return;

    setTabela((atual) => ({
      ...atual,
      [grupo]: {
        ...atual[grupo],
        [chave]: numero,
      },
    }));
  };

  const iniciarEdicaoValor = (grupo, chave, valor) => {
    setCamposEmEdicao((atuais) => ({
      ...atuais,
      [obterChaveCampo(grupo, chave)]: formatarNumeroParaEdicao(valor),
    }));
  };

  const alterarValorEditado = (grupo, chave, valor) => {
    setCamposEmEdicao((atuais) => ({
      ...atuais,
      [obterChaveCampo(grupo, chave)]: valor,
    }));
  };

  const finalizarEdicaoValor = (grupo, chave) => {
    const chaveCampo = obterChaveCampo(grupo, chave);
    atualizarValor(grupo, chave, camposEmEdicao[chaveCampo]);
    setCamposEmEdicao((atuais) => {
      const novos = { ...atuais };
      delete novos[chaveCampo];
      return novos;
    });
  };

  const normalizarTabelaParaSalvar = (tabelaAtual) => ({
    ...tabelaAtual,
    servicos: normalizarValoresMonetarios(tabelaAtual.servicos),
    locacoes: normalizarValoresMonetarios(tabelaAtual.locacoes),
  });

  const salvarTabela = () => {
    const tabelaAtualizada = {
      ...normalizarTabelaParaSalvar(tabela),
      versao: 1,
      atualizadoEm: new Date().toISOString(),
    };

    localStorage.setItem("tabelaComercialPadrao", JSON.stringify(tabelaAtualizada));
    setTabela(tabelaAtualizada);
    alert("Tabela Comercial salva com sucesso!");
  };

  const formatarDataHora = (data) => {
    if (!data) return "";
    return new Date(data).toLocaleString("pt-BR");
  };

  const renderCampos = (grupo) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(tabela[grupo]).map(([chave, valor]) => {
        const chaveCampo = obterChaveCampo(grupo, chave);

        return (
          <div key={chave}>
            <label className="block text-sm font-medium">{chave}</label>
            <input
              type="text"
              inputMode="decimal"
              value={camposEmEdicao[chaveCampo] ?? formatarMoeda(valor)}
              onFocus={() => iniciarEdicaoValor(grupo, chave, valor)}
              onChange={(e) => alterarValorEditado(grupo, chave, e.target.value)}
              onBlur={() => finalizarEdicaoValor(grupo, chave)}
              className="border p-2 rounded w-full text-sm"
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold">Tabela Comercial</h2>
        {tabela.atualizadoEm && (
          <p className="text-sm text-gray-500">
            Última atualização: {formatarDataHora(tabela.atualizadoEm)}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold">Serviços</h3>
        {renderCampos("servicos")}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Locações</h3>
        {renderCampos("locacoes")}
      </section>

      <button
        onClick={salvarTabela}
        className="bg-green-600 text-white px-4 py-2 rounded w-full md:w-auto"
      >
        Salvar Tabela Comercial
      </button>
    </div>
  );
}
