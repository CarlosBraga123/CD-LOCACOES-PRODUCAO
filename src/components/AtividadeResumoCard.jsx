const texto = (valor) => String(valor ?? "").trim();

const formatarDataAtividade = (data) => {
  const valor = texto(data);
  if (!valor) return "Sem data";

  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
};

const obterItens = (atividade) =>
  Array.isArray(atividade?.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];

const obterQuantidade = (atividade) => {
  const itens = obterItens(atividade);
  if (itens.length > 0) return itens.length;

  const quantidade = Number(atividade?.quantidade);
  return quantidade > 0 ? quantidade : 1;
};

const formatarEquipamento = (atividade) => {
  if (atividade?.equipamento === "Balancinho") {
    return atividade.tipoBalancinho === "Manual"
      ? "Balancinho Manual"
      : "Balancinho Elétrico";
  }

  if (atividade?.equipamento === "Mini Grua") {
    if (atividade.tipoMiniGrua === "1T") return "Mini Grua 1 T";
    if (atividade.tipoMiniGrua === "500kg") return "Mini Grua 500 kg";
    return "Mini Grua";
  }

  return texto(atividade?.equipamento) || "Equipamento";
};

const formatarTamanho = (valor) => {
  const tamanho = texto(valor);
  if (!tamanho) return "";
  return /\bm$/i.test(tamanho) ? tamanho : `${tamanho} m`;
};

const obterResumoTamanhos = (atividade) => {
  if (atividade?.equipamento !== "Balancinho") return "";

  const itens = obterItens(atividade);
  const tamanhos =
    itens.length > 0
      ? itens.map((item) => formatarTamanho(item.tamanho)).filter(Boolean)
      : [formatarTamanho(atividade.tamanho)].filter(Boolean);

  if (tamanhos.length === 0) return "";

  const contagens = tamanhos.reduce((acc, tamanho) => {
    acc.set(tamanho, (acc.get(tamanho) || 0) + 1);
    return acc;
  }, new Map());
  const possuiRepeticao = [...contagens.values()].some(
    (quantidade) => quantidade > 1
  );

  return [...contagens.entries()]
    .map(([tamanho, quantidade]) =>
      possuiRepeticao ? `${tamanho} (${quantidade})` : tamanho
    )
    .join(" • ");
};

const obterResumoDeslocamentos = (atividade) => {
  if (
    atividade?.servico !== "Deslocamento" ||
    atividade?.equipamento !== "Balancinho"
  ) {
    return "";
  }

  const itens = obterItens(atividade);
  const movimentos =
    itens.length > 0
      ? itens.map((item) => ({
          anterior: formatarTamanho(item.tamanhoAnterior || item.tamanho),
          novo: formatarTamanho(item.tamanhoNovo),
        }))
      : [
          {
            anterior: formatarTamanho(
              atividade.tamanhoAnterior || atividade.tamanho
            ),
            novo: formatarTamanho(atividade.tamanhoNovo),
          },
        ];

  return movimentos
    .map(({ anterior, novo }) => {
      if (anterior && novo) return `${anterior} → ${novo}`;
      return novo || anterior;
    })
    .filter(Boolean)
    .join(" • ");
};

const obterResumoContrapeso = (atividade) => {
  if (atividade?.servico !== "Deslocamento") return "";

  const itens = obterItens(atividade);
  const alteracoes =
    itens.length > 0
      ? itens.map((item) => texto(item.alteracaoContrapeso).toLowerCase())
      : [texto(atividade.alteracaoContrapeso).toLowerCase()];
  const contagens = alteracoes.reduce(
    (acc, alteracao) => {
      if (alteracao === "adicionar") acc.adicionar += 1;
      if (alteracao === "remover") acc.remover += 1;
      return acc;
    },
    { adicionar: 0, remover: 0 }
  );
  const resumos = [];

  if (contagens.adicionar > 0) {
    resumos.push(
      `+ Kit Contrapeso${contagens.adicionar > 1 ? ` (${contagens.adicionar})` : ""}`
    );
  }
  if (contagens.remover > 0) {
    resumos.push(
      `− Kit Contrapeso${contagens.remover > 1 ? ` (${contagens.remover})` : ""}`
    );
  }

  return resumos.join(" • ");
};

export default function AtividadeResumoCard({
  atividade,
  onClick,
  disabled = false,
  className = "",
  title,
  informacoesAdicionais,
}) {
  const quantidade = obterQuantidade(atividade);
  const data =
    atividade?.dataLiberacao || atividade?.dataAgendamento || "";
  const deslocamentos = obterResumoDeslocamentos(atividade);
  const tamanhos =
    atividade?.servico === "Deslocamento"
      ? ""
      : obterResumoTamanhos(atividade);
  const contrapeso = obterResumoContrapeso(atividade);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded border bg-white p-3 text-left shadow-sm transition-colors ${className}`}
      title={title}
    >
      <div className="flex items-start justify-between gap-3">
        <strong className="min-w-0 text-sm text-gray-900">
          {atividade?.servico || "Serviço"}
        </strong>
        <span className="shrink-0 text-xs text-gray-500">
          {formatarDataAtividade(data)}
        </span>
      </div>

      <p className="mt-1 text-sm font-medium text-gray-700">
        {formatarEquipamento(atividade)}
      </p>
      <p className="text-xs text-gray-600">
        {quantidade} {quantidade === 1 ? "equipamento" : "equipamentos"}
      </p>

      {(deslocamentos || tamanhos) && (
        <p className="mt-1 text-xs text-gray-600">
          {deslocamentos || tamanhos}
        </p>
      )}
      {contrapeso && (
        <p className="mt-1 text-xs font-medium text-amber-700">{contrapeso}</p>
      )}
      {informacoesAdicionais}
      {atividade?.equipeResponsavel && (
        <p className="mt-1 text-xs text-gray-600">
          Equipe: {atividade.equipeResponsavel}
        </p>
      )}
      {atividade?.observacoes && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-600">
          Observação: {atividade.observacoes}
        </p>
      )}
    </button>
  );
}
