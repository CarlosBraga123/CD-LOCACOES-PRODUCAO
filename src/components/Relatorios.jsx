import { Boxes, CalendarRange, FileBarChart, PackageSearch, Wallet } from "lucide-react";

const relatorios = [
  {
    titulo: "Fechamento Mensal",
    descricao: "Consolidação mensal de serviços e locações por obra.",
    pagina: "fechamentomensal",
    Icone: CalendarRange,
    cor: "bg-indigo-50 text-indigo-700",
  },
  {
    titulo: "Serviços",
    descricao: "Consulta e fechamento das atividades de serviço.",
    pagina: "relatorioservicos",
    Icone: FileBarChart,
    cor: "bg-blue-50 text-blue-700",
  },
  {
    titulo: "Locação",
    descricao: "Posição mensal dos equipamentos em locação.",
    pagina: "relatoriolocacao",
    Icone: Boxes,
    cor: "bg-emerald-50 text-emerald-700",
  },
  {
    titulo: "Financeiro",
    descricao: "Visão financeira detalhada de serviços e locações.",
    pagina: "relatoriofinanceiro",
    Icone: Wallet,
    cor: "bg-amber-50 text-amber-700",
  },
  {
    titulo: "Equipamentos por Obra",
    descricao: "Fotografia atual dos equipamentos instalados em cada obra.",
    pagina: "relatorioequipamentosobra",
    Icone: PackageSearch,
    cor: "bg-cyan-50 text-cyan-700",
  },
];

export default function Relatorios({ navegar }) {
  return (
    <section className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
        <p className="mt-1 text-sm text-gray-500">
          Selecione a visão que deseja consultar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {relatorios.map(({ titulo, descricao, pagina, Icone, cor }) => (
          <button
            key={pagina}
            type="button"
            onClick={() => navegar(pagina)}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <span className={`inline-flex rounded-lg p-3 ${cor}`}>
              <Icone size={24} aria-hidden="true" />
            </span>
            <strong className="mt-4 block text-base text-gray-800">{titulo}</strong>
            <span className="mt-1 block text-sm leading-5 text-gray-500">{descricao}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
