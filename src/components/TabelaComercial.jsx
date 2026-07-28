import { useEffect, useState } from "react";
import {
  converterMoedaParaNumero,
  formatarMoeda,
  formatarNumeroParaEdicao,
} from "../utils/moeda";
import {
  criarTabelaComercialInicial,
  normalizarTabelaComercial,
  normalizarTabelaComercialParaSalvar,
} from "../utils/tabelaComercial";

export default function TabelaComercial() {
  const [tabela, setTabela] = useState(() =>
    criarTabelaComercialInicial({ atualizadoEm: "" })
  );
  const [camposEmEdicao, setCamposEmEdicao] = useState({});

  useEffect(() => {
    const salva = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null");

    if (!salva) return;

    setTabela(
      normalizarTabelaComercial(
        { ...salva, atualizadoEm: salva.atualizadoEm || "" },
        { incluirVersaoPadrao: true }
      )
    );
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

  const salvarTabela = () => {
    const tabelaAtualizada = {
      ...normalizarTabelaComercialParaSalvar(tabela, {
        incluirVersaoPadrao: true,
      }),
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
