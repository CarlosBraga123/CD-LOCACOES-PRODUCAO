import { useState } from "react";
import Dashboard from "./components/Dashboard";
import ConstrutorasObras from "./components/ConstrutorasObras";
import Atividades from "./components/Atividades";
import Agenda from "./components/Agenda.tsx";
import RelatorioFinanceiro from "./components/RelatorioFinanceiro";
import RelatorioServicos from "./components/RelatorioServicos";
import RelatorioLocacao from "./components/RelatorioLocacao";
import BackupImportacao from "./components/BackupImportacao";
import Configuracoes from "./components/Configuracoes";
import TabelaComercial from "./components/TabelaComercial";
import Usuarios from "./components/Usuarios";
import Login from "./components/Login";
import ListaDeTarefas from "./components/ListaDeTarefas";
import ControlePatrimonios from "./components/ControlePatrimonios";
import {
  BadgeDollarSign,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  DatabaseBackup,
  FileBarChart,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

// 👇 Simula um login automático como admin
const usuarioAdminSimulado = {
  nome: "Admin (acesso automático)",
  tipo: "admin",
};

export default function App() {
  const [selectedPage, setSelectedPage] = useState("dashboard");
  const [contextoNavegacao, setContextoNavegacao] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [usuarioLogado, setUsuarioLogado] = useState(usuarioAdminSimulado);

  const navegar = (pagina, contexto = null) => {
    setContextoNavegacao(contexto);
    setSelectedPage(pagina);
    setMenuAberto(false);
  };

  const limparContextoNavegacao = () => {
    setContextoNavegacao(null);
  };

  const abrirAtividade = (id) => {
    if (!id) return;

    navegar("atividades", {
      origem: "atividade-relacionada",
      destino: "atividades",
      acao: "localizar-atividade",
      atividadeId: id,
    });
  };

  const renderTitle = () => {
    switch (selectedPage) {
      case "dashboard": return "Painel de Controle";
      case "construtorasobras": return "Construtoras e Obras";
      case "controlepatrimonios": return "Controle de Patrimônios";
      case "atividades": return "Atividades";
      case "relatoriofinanceiro": return "Relatório Financeiro";
      case "relatorioservicos": return "Relatório de Serviços";
      case "relatoriolocacao": return "Relatório de Locação";
      case "backup": return "Backup";
      case "configuracoes": return "Configurações";
      case "tabelacomercial": return "Tabela Comercial";
      case "usuarios": return "Usuários";
      case "tarefas": return "Lista de Tarefas";
      default: return "CD Locações";
    }
  };

  const renderContent = () => {
    switch (selectedPage) {
      case "dashboard": return <Dashboard abrirAtividade={abrirAtividade} navegar={navegar} />;
      case "construtorasobras": return <ConstrutorasObras navegar={navegar} abrirAtividade={abrirAtividade} contextoNavegacao={contextoNavegacao} limparContextoNavegacao={limparContextoNavegacao} />;
      case "controlepatrimonios": return <ControlePatrimonios />;
      case "atividades": return <Atividades contextoNavegacao={contextoNavegacao} limparContextoNavegacao={limparContextoNavegacao} />;
      case "agenda": return <Agenda />;
      case "relatoriofinanceiro": return <RelatorioFinanceiro />;
      case "relatorioservicos": return <RelatorioServicos />;
      case "relatoriolocacao": return <RelatorioLocacao />;
      case "backup": return <BackupImportacao />;
      case "configuracoes": return <Configuracoes />;
      case "tabelacomercial": return <TabelaComercial />;
      case "usuarios": return <Usuarios />;
      case "tarefas": return <ListaDeTarefas usuario={usuarioLogado?.nome || "Usuário"} />;
      default: return <div className="p-4">Página não encontrada</div>;
    }
  };

  return (
    <div className="flex h-screen text-gray-800">
      <button
        className="sm:hidden fixed top-4 left-4 z-50 bg-white border shadow-md p-2 rounded"
        onClick={() => setMenuAberto(!menuAberto)}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <aside
        className={
          "sm:block " +
          (menuAberto ? "block fixed inset-0 bg-white z-40 w-64 p-4" : "hidden")
        }
      >
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo da empresa" className="h-12 w-auto mb-2" />
          <h1 className="text-xl font-semibold">CD Locações</h1>
        </div>
        <nav className="flex flex-col space-y-2">
          {(usuarioLogado.tipo === "admin" || usuarioLogado.tipo === "gestor") && (
            <button onClick={() => { setSelectedPage("dashboard"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><LayoutDashboard size={20} aria-hidden="true" />Início</button>
          )}
          {usuarioLogado.tipo === "admin" && (
            <>
              <button onClick={() => navegar("construtorasobras")} className="flex items-center gap-2 text-left hover:text-blue-600"><Building2 size={20} aria-hidden="true" />Construtoras e Obras</button>
              <button onClick={() => navegar("controlepatrimonios")} className="flex items-center gap-2 text-left hover:text-blue-600"><PackageSearch size={20} aria-hidden="true" />Controle de Patrimônios</button>
            </>
          )}
          <button onClick={() => navegar("atividades")} className="flex items-center gap-2 text-left hover:text-blue-600"><ClipboardList size={20} aria-hidden="true" />Atividades</button>
          <button
  onClick={() => { setSelectedPage("agenda"); setMenuAberto(false); }}
  className="flex items-center gap-2 text-left hover:text-blue-600"
>
  <CalendarDays size={20} aria-hidden="true" />Agenda
</button>

          <button onClick={() => { setSelectedPage("tarefas"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><ListTodo size={20} aria-hidden="true" />Lista de Tarefas</button>
          {(usuarioLogado.tipo === "admin" || usuarioLogado.tipo === "gestor") && (
            <>
              <button onClick={() => { setSelectedPage("relatoriofinanceiro"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><Wallet size={20} aria-hidden="true" />Relatório Financeiro</button>
              <button onClick={() => { setSelectedPage("relatorioservicos"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><FileBarChart size={20} aria-hidden="true" />Relatório de Serviços</button>
              <button onClick={() => { setSelectedPage("relatoriolocacao"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><Boxes size={20} aria-hidden="true" />Relatório de Locação</button>
            </>
          )}
          {usuarioLogado.tipo === "admin" && (
            <>
              <button onClick={() => { setSelectedPage("backup"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><DatabaseBackup size={20} aria-hidden="true" />Backup</button>
              <button onClick={() => { setSelectedPage("usuarios"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><Users size={20} aria-hidden="true" />Usuários</button>
              <button onClick={() => { setSelectedPage("tabelacomercial"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><BadgeDollarSign size={20} aria-hidden="true" />Tabela Comercial</button>
              <button onClick={() => { setSelectedPage("configuracoes"); setMenuAberto(false); }} className="flex items-center gap-2 text-left hover:text-blue-600"><Settings size={20} aria-hidden="true" />Configurações</button>
            </>
          )}
          <button
            onClick={() => {
              localStorage.removeItem("usuarioLogado");
              setUsuarioLogado(null);
              location.reload();
            }}
            className="flex items-center gap-2 text-left text-red-500 hover:text-red-700"
          >
            <LogOut size={20} aria-hidden="true" />Sair
          </button>
        </nav>
      </aside>

      <main className="flex-1 bg-white overflow-auto pt-16 sm:pt-0 relative">
        <div className="sm:hidden fixed top-0 left-0 right-0 bg-white z-40 py-4 shadow-md">
          <h1 className="text-center font-semibold text-lg">{renderTitle()}</h1>
        </div>
        <div className="sm:hidden h-16" />
        {renderContent()}
      </main>
    </div>
  );
}
