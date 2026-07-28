const icones = {
  Construtora: "▫",
  Obra: "▥",
  Endereço: "⌖",
  Responsável: "●",
  Telefone: "☎",
  "E-mail": "✉",
  "CPF/CNPJ": "▣",
  Equipamento: "⚒",
  Quantidade: "▥",
  Tamanho: "◆",
  Contrapeso: "▰",
  Ancoragem: "⚓",
  Capacidade: "▣",
  "Tipo específico": "▤",
};

const TituloBloco = ({ children, compacto }) => (
  <div
    className={`ml-3 w-fit rounded-b-sm bg-black font-bold uppercase tracking-wide text-white ${
      compacto ? "px-2 py-[1px] text-[7.5px]" : "px-3 py-0.5 text-[9px]"
    }`}
  >
    <span className="flex items-center justify-center leading-none">{children}</span>
  </div>
);

const BlocoOS = ({ titulo, compacto, children }) => (
  <section
    className={`overflow-hidden rounded border border-black bg-white ${
      compacto ? "mt-1.5 pb-1.5" : "mt-3 pb-2.5"
    }`}
  >
    <div><TituloBloco compacto={compacto}>{titulo}</TituloBloco></div>
    <div className={compacto ? "px-2.5 pt-1" : "px-3 pt-1.5"}>{children}</div>
  </section>
);

const InfoItem = ({ label, valor, compacto }) => (
  <div className={`flex items-center ${compacto ? "gap-1" : "gap-2"}`}>
    <span className={`shrink-0 text-center ${compacto ? "w-3.5 text-[9px]" : "w-4 text-[12px]"}`}>
      {icones[label] || "▪"}
    </span>
    <span className="flex min-w-0 flex-col justify-center leading-[1.15]">
      <span className={`block font-bold uppercase ${compacto ? "text-[6.2px]" : "text-[7px]"}`}>{label}</span>
      <span className="break-words font-bold">{valor}</span>
    </span>
  </div>
);

const InfoGrid = ({ itens, compacto }) => (
  <div className={`grid grid-cols-2 ${compacto ? "gap-x-3 gap-y-1.5" : "gap-x-5 gap-y-2"}`}>
    {itens.map(([label, valor]) => (
      <InfoItem key={label} label={label} valor={valor} compacto={compacto} />
    ))}
  </div>
);

const BlocoAssinatura = ({ titulo, children, compacto }) => (
  <div className={`rounded border border-black text-center leading-[1.15] ${compacto ? "px-2 py-1" : "px-3 py-2"}`}>
    <div className={`flex items-center justify-center font-bold uppercase ${compacto ? "text-[7px]" : "text-[9px]"}`}>{titulo}</div>
    <div className={`${compacto ? "mt-1" : "mt-2"} flex items-center justify-center`}>{children}</div>
    <div className={compacto ? "mt-1 flex items-center justify-center border-t border-black pt-0.5 text-[6px]" : "mt-2 flex items-center justify-center border-t border-black pt-1 text-[8px]"}>
      Assinatura legível e carimbo
    </div>
  </div>
);

export default function OrdemServicoLayout({
  atividade,
  assinaturaManual,
  assinaturaTipo,
  compacto = true,
  dadosEquipamento,
  dadosObra,
  dataDocumento,
  descricao,
  equipamentosDetalhados,
  modo,
  numeroOSCampo,
  observacoesOS,
  qrDataUrl,
  servicos,
  status,
}) {
  const qrSize = compacto ? 88 : 112;

  return (
    <article
      data-modo={modo}
      className={`box-border bg-white text-black [&_*]:box-border ${
        compacto ? "min-h-[537px] p-[15px] text-[9.2px]" : "min-h-[1066px] p-[38px] text-xs"
      }`}
    >
      <header
        className={`grid rounded border border-black ${
          compacto ? "grid-cols-[86px_1fr_106px] gap-2 p-1.5" : "grid-cols-[120px_1fr_138px] gap-4 p-3"
        }`}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className={`flex items-center justify-center rounded border border-black p-1 ${compacto ? "h-16 w-[84px]" : "h-24 w-[116px]"}`}>
            <img src="/os/LOGO_CD_LOCACOES.png" alt="CD Locações" className="max-h-full max-w-full object-contain" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center leading-tight">
          <h1 className={`${compacto ? "text-xl" : "text-3xl"} font-extrabold tracking-tight`}>ORDEM DE SERVIÇO</h1>
          <p className={`${compacto ? "mx-auto mt-1 w-fit rounded bg-black px-4 py-0.5 text-[11px] text-white" : "mx-auto mt-3 w-fit rounded bg-black px-5 py-1 text-sm text-white"}`}>
            OS: <strong>{atividade.numeroOS || ""}</strong>
          </p>
          <div className={`${compacto ? "mx-auto mt-1 grid max-w-[190px] grid-cols-2 gap-1 text-[8px]" : "mx-auto mt-2 grid max-w-[260px] grid-cols-2 gap-2 text-xs"}`}>
            <div className="flex flex-col justify-center rounded border border-black px-1 py-[2px] text-left leading-[1.15]">
              <strong>DATA:</strong>{dataDocumento}
            </div>
            <div className="flex flex-col justify-center rounded border border-black px-1 py-[2px] text-left leading-[1.15]">
              <strong>STATUS:</strong>{status}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center leading-tight">
          <div className="flex items-center justify-center border border-black bg-white p-1">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code da Ordem de Serviço"
                className="block bg-white object-contain"
                style={{ width: `${qrSize}px`, height: `${qrSize}px` }}
              />
            ) : (
              <div className="bg-white" style={{ width: `${qrSize}px`, height: `${qrSize}px` }} />
            )}
          </div>
          <p className={`${compacto ? "mt-1 text-[7px]" : "mt-1 text-[9px]"} leading-tight`}>
            Escaneie para visualizar os dados desta Ordem de Serviço
          </p>
        </div>
      </header>

      <BlocoOS titulo="Dados da obra" compacto={compacto}>
        <InfoGrid itens={dadosObra} compacto={compacto} />
      </BlocoOS>

      <BlocoOS titulo="Equipamento" compacto={compacto}>
        <div className={`grid ${compacto ? "grid-cols-[118px_1fr] gap-2.5" : "grid-cols-[230px_1fr] gap-4"}`}>
          <div className={`flex items-center justify-center border border-black bg-white ${compacto ? "h-16 p-1" : "h-24 p-2"}`}>
            {(atividade.equipamento === "Mini Grua" || atividade.equipamento === "Balancinho") && (
              <img
                src={atividade.equipamento === "Mini Grua" ? "/os/OS_MINIGRUA_PB.png" : "/os/OS_BALANCINHO_PB.png"}
                alt={atividade.equipamento}
                className="h-full w-full object-contain"
              />
            )}
          </div>
          <InfoGrid itens={dadosEquipamento} compacto={compacto} />
        </div>
      </BlocoOS>

      {equipamentosDetalhados.length > 0 && (
        <BlocoOS titulo="Equipamentos" compacto={compacto}>
          <ol className={`grid grid-cols-1 ${compacto ? "gap-0.5 text-[6.8px]" : "gap-1.5 text-[9px]"}`}>
            {equipamentosDetalhados.map((item, indice) => (
              <li key={`${atividade.id || "atividade"}-layout-equipamento-${indice}`} className="break-inside-avoid leading-[1.15]">
                <strong>{indice + 1}. {item.tipo}</strong>
                <span className="ml-1">{item.detalhes.join(" | ")}</span>
              </li>
            ))}
          </ol>
        </BlocoOS>
      )}

      <BlocoOS titulo="Tipo de serviço" compacto={compacto}>
        <div className={`grid ${compacto ? "grid-cols-4 gap-0.5" : "grid-cols-3 gap-x-8 gap-y-1"}`}>
          {servicos.map((servico) => (
            <span key={servico} className="flex items-center font-semibold leading-[1.15]">
              [{atividade.servico === servico ? "x" : " "}] {servico}
            </span>
          ))}
        </div>
      </BlocoOS>

      <div className={`grid ${
        numeroOSCampo
          ? compacto
            ? "grid-cols-[1.1fr_0.65fr_1fr_0.75fr] gap-2"
            : "grid-cols-[1.05fr_0.65fr_1fr_0.75fr] gap-3"
          : compacto
            ? "grid-cols-[1.2fr_1fr_0.75fr] gap-2"
            : "grid-cols-[1.1fr_1fr_0.75fr] gap-3"
      }`}>
        <BlocoOS titulo="Descrição dos serviços" compacto={compacto}>
          <p className={`${compacto ? "min-h-[28px] py-[2px]" : "min-h-[58px] py-[5px]"} whitespace-pre-wrap font-semibold leading-[1.15]`}>{descricao}</p>
        </BlocoOS>
        {numeroOSCampo && (
          <BlocoOS titulo="Nº da OS de Campo" compacto={compacto}>
            <p className={`${compacto ? "min-h-[28px] py-[2px]" : "min-h-[58px] py-[5px]"} whitespace-pre-wrap font-semibold leading-[1.15]`}>{numeroOSCampo}</p>
          </BlocoOS>
        )}
        <BlocoOS titulo="Observações" compacto={compacto}>
          <p className={`${compacto ? "min-h-[28px] py-[2px]" : "min-h-[58px] py-[5px]"} whitespace-pre-wrap font-semibold leading-[1.15]`}>{observacoesOS || " "}</p>
        </BlocoOS>
        <BlocoOS titulo="Equipe responsável" compacto={compacto}>
          <p className={`${compacto ? "flex min-h-[28px] items-center py-[2px]" : "flex min-h-[58px] items-center py-[5px]"} font-semibold leading-[1.15]`}>
            {atividade.equipeResponsavel || "Equipe CD Locações"}
          </p>
        </BlocoOS>
      </div>

      <section className={`${compacto ? "mt-2" : "mt-3"} grid grid-cols-2 gap-3`}>
        <BlocoAssinatura titulo="Responsável da obra / cliente" compacto={compacto}>
          <div className={compacto ? "h-9" : "h-12"} />
        </BlocoAssinatura>
        <BlocoAssinatura titulo="CD Locações" compacto={compacto}>
          <div className={`${compacto ? "h-9" : "h-12"} flex items-center justify-center leading-[1.15]`}>
            {assinaturaTipo === "fixa" && <span className={`${compacto ? "text-xl" : "text-2xl"} font-serif italic`}>CD Locações</span>}
            {assinaturaTipo === "manual" && assinaturaManual && (
              <img src={assinaturaManual} alt="Assinatura manual" className="mx-auto h-full object-contain" />
            )}
          </div>
        </BlocoAssinatura>
      </section>

      <footer className={`${compacto ? "mt-2 text-[6.5px]" : "mt-3 text-[10px]"} flex items-center justify-center gap-3 border-t border-black pt-1 font-semibold`}>
        <span>☎ (32) 99860-9001</span><span>|</span><span>✉ locacoescd@gmail.com</span><span>|</span>
        <span>⌖ Avenida Sete de Setembro, 773 - Costa Carvalho - Juiz de Fora - MG - CEP: 36070-000</span>
      </footer>
    </article>
  );
}
