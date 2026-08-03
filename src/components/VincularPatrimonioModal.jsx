import { useMemo, useState } from "react";
import { obterUnidadesEquipamentosAtivos } from "../utils/equipamentosAtivos";
import { atividadeIniciaLocacao } from "../utils/locacaoFinanceira";
import {
  obterEquipamentosPatrimonio,
  reconciliarSituacoesEquipamentos,
  salvarEquipamentosPatrimonio,
} from "../utils/equipamentosPatrimonio";
import {
  aplicarVinculoPatrimonialPosterior,
  criarItensProvisoriosVinculo,
  equipamentoCompativelComAtividade,
  itemPossuiVinculoPatrimonial,
  obterResumoVinculoPatrimonial,
} from "../utils/pendenciasOperacionais";

const descricao = (item) =>
  item.equipamento === "Balancinho"
    ? `Balancinho ${item.tipoBalancinho === "Manual" ? "Manual" : "Elétrico"}`
    : `Mini Grua ${item.tipoMiniGrua || ""}`;

const dataAtividade = (atividade) =>
  atividade.dataLiberacao || atividade.dataAgendamento || "";

const obterAtividadesAnteriores = (atividades, atividade) => {
  const dataReferencia = dataAtividade(atividade);
  return atividades.filter((item) => {
    if (String(item.id) === String(atividade.id)) return false;
    const dataItem = dataAtividade(item);
    if (!dataItem || !dataReferencia) return false;
    if (dataItem !== dataReferencia) return dataItem < dataReferencia;
    return String(item.id ?? "") < String(atividade.id ?? "");
  });
};

const mestreParaUnidade = (mestre) => ({
  idUnidade: mestre.idItemOrigem || mestre.idEquipamento,
  idItemOrigem: mestre.idItemOrigem || mestre.idEquipamento,
  idEquipamento: mestre.idEquipamento,
  numeroPatrimonio: mestre.numeroPatrimonioAtual || "",
  equipamento: mestre.equipamento,
  tipoBalancinho: mestre.tipoBalancinho || "",
  tipoMiniGrua: mestre.tipoMiniGrua || "",
  tamanho: "",
  ancoragem: "",
  usaContrapeso: false,
});

export default function VincularPatrimonioModal({
  atividade,
  atividades,
  obras,
  onClose,
  onVinculado,
}) {
  const itens = criarItensProvisoriosVinculo(atividade);
  const pendentes = itens.filter((item) => !itemPossuiVinculoPatrimonial(item));
  const [idItem, setIdItem] = useState(pendentes[0]?.idItem || "");
  const [unidadeId, setUnidadeId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const obra = obras.find(
    (item) =>
      String(item.id || "") === String(atividade.obraId || "") ||
      (!atividade.obraId &&
        item.nome === atividade.obra &&
        item.construtora === atividade.construtora)
  );
  const entrada = atividadeIniciaLocacao(atividade);

  const candidatos = useMemo(() => {
    const anteriores = obterAtividadesAnteriores(atividades, atividade);
    const mestres = obterEquipamentosPatrimonio();
    const idsJaVinculados = new Set(
      itens.map((item) => String(item.idEquipamento || "")).filter(Boolean)
    );
    const ativosPorObra = obras.flatMap((obraAtual) =>
      obterUnidadesEquipamentosAtivos(obraAtual, anteriores, undefined, mestres)
    );

    if (entrada) {
      const idsAtivos = new Set(
        ativosPorObra.map((item) => String(item.idEquipamento || "")).filter(Boolean)
      );
      return mestres
        .filter(
          (item) =>
            item.ativo !== false &&
            item.numeroPatrimonioAtual &&
            !idsJaVinculados.has(String(item.idEquipamento)) &&
            !idsAtivos.has(String(item.idEquipamento))
        )
        .map(mestreParaUnidade)
        .filter((item) => equipamentoCompativelComAtividade(item, atividade));
    }

    return obra
      ? obterUnidadesEquipamentosAtivos(obra, anteriores, undefined, mestres).filter(
          (item) =>
            equipamentoCompativelComAtividade(item, atividade) &&
            item.idEquipamento &&
            item.numeroPatrimonio &&
            !idsJaVinculados.has(String(item.idEquipamento))
        )
      : [];
  }, [atividade, atividades, entrada, obra, obras]);

  const confirmar = () => {
    if (salvando) return;
    const atividadesAtuais = JSON.parse(localStorage.getItem("atividades") || "[]");
    const atividadeAtual = atividadesAtuais.find(
      (item) => String(item.id) === String(atividade.id)
    );
    const anteriores = obterAtividadesAnteriores(atividadesAtuais, atividadeAtual || atividade);
    const mestres = obterEquipamentosPatrimonio();
    const idsJaVinculados = new Set(
      criarItensProvisoriosVinculo(atividadeAtual || atividade)
        .map((item) => String(item.idEquipamento || ""))
        .filter(Boolean)
    );
    let candidatosAtuais;
    if (entrada) {
      const idsAtivos = new Set(
        obras
          .flatMap((obraAtual) =>
            obterUnidadesEquipamentosAtivos(obraAtual, anteriores, undefined, mestres)
          )
          .map((item) => String(item.idEquipamento || ""))
          .filter(Boolean)
      );
      candidatosAtuais = mestres
        .filter(
          (item) =>
            item.ativo !== false &&
            item.numeroPatrimonioAtual &&
            !idsJaVinculados.has(String(item.idEquipamento)) &&
            !idsAtivos.has(String(item.idEquipamento))
        )
        .map(mestreParaUnidade);
    } else {
      candidatosAtuais = obra
        ? obterUnidadesEquipamentosAtivos(obra, anteriores, undefined, mestres)
            .filter(
              (item) => !idsJaVinculados.has(String(item.idEquipamento || ""))
            )
        : [];
    }
    const unidade = candidatosAtuais.find(
      (item) =>
        String(item.idUnidade) === String(unidadeId) &&
        equipamentoCompativelComAtividade(item, atividadeAtual || atividade)
    );
    if (!unidade) {
      alert("O equipamento não estava disponível ou ativo na obra na data da atividade.");
      return;
    }

    setSalvando(true);
    try {
      const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null")?.nome;
      const atualizadas = aplicarVinculoPatrimonialPosterior({
        atividades: atividadesAtuais,
        atividadeId: atividade.id,
        idItem,
        unidade,
        usuario,
      });
      const dataReferencia = dataAtividade(atividadeAtual || atividade);
      const datasParaValidar = [
        ...new Set(
          atualizadas
            .map((item) => item.dataLiberacao)
            .filter((data) => data && data >= dataReferencia)
        ),
      ].sort();
      for (const dataValidacao of datasParaValidar) {
        const atividadesAteData = atualizadas.filter(
          (item) => item.dataLiberacao && item.dataLiberacao <= dataValidacao
        );
        const ocorrenciasEquipamento = obras
          .flatMap((obraAtual) =>
            obterUnidadesEquipamentosAtivos(
              obraAtual,
              atividadesAteData,
              undefined,
              mestres
            )
          )
          .filter(
            (item) =>
              String(item.idEquipamento) === String(unidade.idEquipamento)
          );
        const obrasAtivas = new Set(
          ocorrenciasEquipamento.map((item) =>
            String(item.obraId || item.obra || "")
          )
        );
        if (obrasAtivas.size > 1) {
          throw new Error(
            `O vínculo produziria o mesmo patrimônio ativo em mais de uma obra em ${dataValidacao.split("-").reverse().join("/")}.`
          );
        }
      }
      const ativosAtualizados = obras.flatMap((obraAtual) =>
        obterUnidadesEquipamentosAtivos(obraAtual, atualizadas)
      );
      localStorage.setItem("atividades", JSON.stringify(atualizadas));
      const reconciliacao = reconciliarSituacoesEquipamentos({
        equipamentos: mestres,
        equipamentosAtivos: ativosAtualizados,
        data: dataAtividade(atividade) || new Date().toISOString().slice(0, 10),
        obraOrigemId: atividade.obraId || "",
      });
      if (reconciliacao.alterado) salvarEquipamentosPatrimonio(reconciliacao.equipamentos);
      onVinculado(atualizadas, reconciliacao.equipamentos);
    } catch (erro) {
      alert(erro.message || "Não foi possível concluir o vínculo.");
    } finally {
      setSalvando(false);
    }
  };

  const resumo = obterResumoVinculoPatrimonial(atividade);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-xl sm:rounded-2xl">
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="font-bold">Vincular patrimônio</h3>
            <p className="text-sm text-gray-500">{atividade.construtora} • {atividade.obra}</p>
            <p className="text-xs text-amber-700">Vinculados: {resumo.vinculados} • Pendentes: {resumo.pendentes}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1">Fechar</button>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold">Unidade pendente</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {pendentes.map((item, indice) => (
              <button key={item.idItem} type="button" onClick={() => { setIdItem(item.idItem); setUnidadeId(""); }} className={`rounded border p-2 text-left text-sm ${idItem === item.idItem ? "border-amber-500 bg-amber-50" : ""}`}>
                Unidade {itens.indexOf(item) + 1} • Patrimônio pendente
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">Equipamento compatível na data da atividade</p>
          {candidatos.length === 0 ? (
            <p className="rounded border bg-gray-50 p-3 text-sm">Nenhum equipamento compatível disponível para o vínculo temporal.</p>
          ) : candidatos.map((item) => (
            <label key={item.idUnidade} className={`block rounded border p-3 ${unidadeId === item.idUnidade ? "border-blue-500 bg-blue-50" : ""}`}>
              <input type="radio" name="unidadeVinculo" checked={unidadeId === item.idUnidade} onChange={() => setUnidadeId(item.idUnidade)} /> <strong className="font-mono">{item.numeroPatrimonio}</strong> • {descricao(item)}
              <span className="block text-xs text-gray-600">{item.dataEntrada ? `Entrada: ${item.dataEntrada.split("-").reverse().join("/")} • ` : ""}{item.tamanho ? `${item.tamanho} metros` : "Tamanho não informado"}{item.ancoragem ? ` • ${item.ancoragem}` : ""}{item.usaContrapeso ? " • Com contrapeso" : ""}</span>
            </label>
          ))}
        </div>
        <button type="button" disabled={!idItem || !unidadeId || salvando} onClick={confirmar} className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{salvando ? "Vinculando..." : "Confirmar vínculo"}</button>
      </div>
    </div>
  );
}
