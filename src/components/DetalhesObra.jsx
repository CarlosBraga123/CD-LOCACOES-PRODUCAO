import { useEffect, useState } from "react";
import { atividadePertenceObra } from "../utils/obras";
import { atividadeEncerraLocacao, atividadeIniciaLocacao, obterMovimentosLocacao } from "../utils/locacaoFinanceira";

export default function DetalhesObra({ abrirAtividade }) {
  const [obras, setObras] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [obraSelecionada, setObraSelecionada] = useState(null);

  useEffect(() => {
    const obrasSalvas = JSON.parse(localStorage.getItem("obras") || "[]");
    setObras(obrasSalvas);

    const atividadesSalvas = JSON.parse(localStorage.getItem("atividades") || "[]");
    setAtividades(atividadesSalvas);
  }, []);

  const formatarData = (data) => {
    if (!data) return "";
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  };

  const calcularAtivos = (obra, equipamento) => {
    return atividades
      .filter((a) => atividadePertenceObra(a, obra) && a.equipamento === equipamento && a.dataLiberacao)
      .flatMap((atividade) => obterMovimentosLocacao(atividade))
      .filter((atividade) => !atividade.usaContrapeso)
      .reduce((total, atividade) => {
        const quantidade = Number(atividade.quantidade) || 1;
        const iniciaLocacao =
          atividade.iniciaLocacao === true ||
          (atividade.iniciaLocacao === undefined && atividade.servico === "Instalação");
        const encerraLocacao =
          atividade.encerraLocacao === true ||
          (atividade.encerraLocacao === undefined && atividade.servico === "Remoção");

        if (iniciaLocacao) return total + quantidade;
        if (encerraLocacao) return total - quantidade;
        return total;
      }, 0);
  };

  const formatarGrupoBalancinho = (atividade) => {
    if (atividade.usaContrapeso) return "Kit Contrapeso";

    let nome = "Balancinho Elétrico";

    if (atividade.tipoBalancinho === "Manual") nome = "Balancinho Manual";

    return atividade.usaContrapeso ? `${nome} CONTRAPESO` : nome;
  };

  const calcularAtivosBalancinho = (obra) => {
    const totais = atividades
      .filter((a) => atividadePertenceObra(a, obra) && a.equipamento === "Balancinho" && a.dataLiberacao)
      .flatMap((atividade) => obterMovimentosLocacao(atividade))
      .reduce((resultado, atividade) => {
        const quantidade = Number(atividade.quantidade) || 1;
        const iniciaLocacao =
          atividade.iniciaLocacao === true ||
          (atividade.iniciaLocacao === undefined && atividade.servico === "Instalação");
        const encerraLocacao =
          atividade.encerraLocacao === true ||
          (atividade.encerraLocacao === undefined && atividade.servico === "Remoção");
        const grupo = formatarGrupoBalancinho(atividade);

        if (!resultado[grupo]) resultado[grupo] = 0;
        if (iniciaLocacao) resultado[grupo] += quantidade;
        if (encerraLocacao) resultado[grupo] -= quantidade;

        return resultado;
      }, {});

    const ordem = [
      "Balancinho Elétrico",
      "Balancinho Manual",
      "Kit Contrapeso",
    ];

    return Object.entries(totais)
      .filter(([, total]) => total !== 0)
      .sort(([grupoA], [grupoB]) => {
        const posicaoA = ordem.indexOf(grupoA);
        const posicaoB = ordem.indexOf(grupoB);

        if (posicaoA === -1 && posicaoB === -1) return grupoA.localeCompare(grupoB);
        if (posicaoA === -1) return 1;
        if (posicaoB === -1) return -1;
        return posicaoA - posicaoB;
      })
      .map(([grupo, total]) => ({ grupo, total }));
  };

  const formatarGrupoMiniGrua = (atividade) => {
    return atividade.tipoMiniGrua ? `Mini Grua ${atividade.tipoMiniGrua}` : "Mini Grua";
  };

  const calcularAtivosMiniGrua = (obra) => {
    const totais = atividades
      .filter((a) => atividadePertenceObra(a, obra) && a.equipamento === "Mini Grua" && a.dataLiberacao)
      .reduce((resultado, atividade) => {
        const quantidade = Number(atividade.quantidade) || 1;
        const iniciaLocacao =
          atividade.iniciaLocacao === true ||
          (atividade.iniciaLocacao === undefined && atividade.servico === "Instalação");
        const encerraLocacao =
          atividade.encerraLocacao === true ||
          (atividade.encerraLocacao === undefined && atividade.servico === "Remoção");
        const grupo = formatarGrupoMiniGrua(atividade);

        if (!resultado[grupo]) resultado[grupo] = 0;
        if (iniciaLocacao) resultado[grupo] += quantidade;
        if (encerraLocacao) resultado[grupo] -= quantidade;

        return resultado;
      }, {});

    const ordem = ["Mini Grua 500kg", "Mini Grua 1T", "Mini Grua"];

    return Object.entries(totais)
      .filter(([, total]) => total !== 0)
      .sort(([grupoA], [grupoB]) => {
        const posicaoA = ordem.indexOf(grupoA);
        const posicaoB = ordem.indexOf(grupoB);

        if (posicaoA === -1 && posicaoB === -1) return grupoA.localeCompare(grupoB);
        if (posicaoA === -1) return 1;
        if (posicaoB === -1) return -1;
        return posicaoA - posicaoB;
      })
      .map(([grupo, total]) => ({ grupo, total }));
  };

  const contarServicos = (obra, equipamento, servico) => {
    return atividades
      .filter((a) =>
        atividadePertenceObra(a, obra) &&
        a.equipamento === equipamento &&
        a.servico === servico &&
        a.dataLiberacao
      )
      .reduce((total, atividade) => total + (Number(atividade.quantidade) || 1), 0);
  };

  const selecionarObra = (obra) => {
    setObraSelecionada(obra);
  };

  const servicosExecutados = (obra) => {
    return atividades
      .filter((a) => atividadePertenceObra(a, obra) && a.dataLiberacao)
      .sort((a, b) => new Date(b.dataLiberacao) - new Date(a.dataLiberacao));
  };

  const formatarEquipamento = (item) => {
    if (item.equipamento === "Mini Grua") {
      return item.tipoMiniGrua ? `Mini Grua ${item.tipoMiniGrua}` : "Mini Grua";
    }

    if (item.equipamento !== "Balancinho") return item.equipamento;
    const tipo = item.tipoBalancinho === "Manual" ? "Manual" : "Elétrico";
    return `Balancinho ${tipo}`;
  };

  const obrasOrdenadas = [...obras].sort((a, b) => {
    const ativosA =
      calcularAtivos(a, "Balancinho") + calcularAtivos(a, "Mini Grua");
    const ativosB =
      calcularAtivos(b, "Balancinho") + calcularAtivos(b, "Mini Grua");

    return ativosB - ativosA;
  });

  const resumoBalancinhosSelecionados = obraSelecionada
    ? calcularAtivosBalancinho(obraSelecionada)
    : [];
  const resumoMiniGruasSelecionadas = obraSelecionada
    ? calcularAtivosMiniGrua(obraSelecionada)
    : [];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">📌 Detalhes da Obra</h2>

      {!obraSelecionada ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {obrasOrdenadas.map((obra) => (
            <div
              key={obra.id}
              className="p-4 border rounded shadow cursor-pointer bg-white"
              onClick={() => selecionarObra(obra)}
            >
              <p className="text-sm text-gray-500">{obra.construtora}</p>
              <p className="text-lg font-semibold">{obra.nome}</p>
              <p className="text-sm">Balancinhos ativos: {calcularAtivos(obra, "Balancinho")}</p>
              {calcularAtivosBalancinho(obra).map((item) => (
                <p key={item.grupo} className="text-sm">
                  {item.grupo}: {item.total}
                </p>
              ))}
              {calcularAtivos(obra, "Mini Grua") > 0 && (
                <>
                  <p className="text-sm">Mini Gruas ativas: {calcularAtivos(obra, "Mini Grua")}</p>
                  {calcularAtivosMiniGrua(obra).map((item) => (
                    <p key={item.grupo} className="text-sm">
                      {item.grupo}: {item.total}
                    </p>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setObraSelecionada(null)}
            className="text-blue-600 underline"
          >
            ← Voltar
          </button>

          <div className="space-y-2">
            <p><strong>Nome:</strong> {obraSelecionada.nome}</p>
            <p><strong>Construtora:</strong> {obraSelecionada.construtora}</p>
            {obraSelecionada.engenheiro && <p><strong>Engenheiro:</strong> {obraSelecionada.engenheiro}</p>}
            {obraSelecionada.endereco && <p><strong>Endereço:</strong> {obraSelecionada.endereco}</p>}
            {obraSelecionada.observacoes && <p><strong>Observações:</strong> {obraSelecionada.observacoes}</p>}
            <div>
              <p><strong>Balancinhos ativos:</strong> {calcularAtivos(obraSelecionada, "Balancinho")}</p>
              {resumoBalancinhosSelecionados.map((item) => (
                <p key={item.grupo} className="text-sm">
                  {item.grupo}: {item.total}
                </p>
              ))}
            </div>
            <div>
              <p><strong>Mini Gruas ativas:</strong> {calcularAtivos(obraSelecionada, "Mini Grua")}</p>
              {resumoMiniGruasSelecionadas.map((item) => (
                <p key={item.grupo} className="text-sm">
                  {item.grupo}: {item.total}
                </p>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-md font-semibold mt-2">📊 Quantidade de Serviços</h3>
            <p className="text-sm mt-1">
              <strong>Balancinho:</strong><br />
              • Instalação: {contarServicos(obraSelecionada, "Balancinho", "Instalação")}<br />
              • Deslocamento: {contarServicos(obraSelecionada, "Balancinho", "Deslocamento")}<br />
              • Manutenção: {contarServicos(obraSelecionada, "Balancinho", "Manutenção")}<br />
              • Remoção: {contarServicos(obraSelecionada, "Balancinho", "Remoção")}<br />
              <br />
              <strong>Movimentações de locação:</strong><br />
              • Somente aluguel / entrega: {contarServicos(obraSelecionada, "Balancinho", "Somente aluguel / entrega")}<br />
              • Recolhimento / devolução: {contarServicos(obraSelecionada, "Balancinho", "Recolhimento / devolução")}
            </p>
            <p className="text-sm mt-2">
              <strong>Mini Grua:</strong><br />
              • Instalação: {contarServicos(obraSelecionada, "Mini Grua", "Instalação")}<br />
              • Ascensão: {contarServicos(obraSelecionada, "Mini Grua", "Ascensão")}<br />
              • Remoção: {contarServicos(obraSelecionada, "Mini Grua", "Remoção")}<br />
              <br />
              <strong>Movimentações de locação:</strong><br />
              • Somente aluguel / entrega: {contarServicos(obraSelecionada, "Mini Grua", "Somente aluguel / entrega")}<br />
              • Recolhimento / devolução: {contarServicos(obraSelecionada, "Mini Grua", "Recolhimento / devolução")}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mt-4">🛠️ Serviços Executados</h3>
            <ul className="mt-2 space-y-2">
              {servicosExecutados(obraSelecionada).map((s) => (
                <li
                  key={s.id}
                  className="border p-2 rounded bg-gray-50 cursor-pointer hover:bg-blue-50"
                  onClick={() => abrirAtividade?.(s.id)}
                >
                  <strong>{s.servico}</strong> - {formatarEquipamento(s)}
                  {s.usaContrapeso && (
                    <span className="ml-2 inline-block rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                      CONTRAPESO
                    </span>
                  )}
                  {s.tamanho && s.equipamento === "Balancinho" ? ` [${s.tamanho}m]` : ""} | Quantidade: {s.quantidade || 1}<br />
                  Agendado: {formatarData(s.dataAgendamento)} — Liberado: {s.dataLiberacao ? formatarData(s.dataLiberacao) : "—"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
