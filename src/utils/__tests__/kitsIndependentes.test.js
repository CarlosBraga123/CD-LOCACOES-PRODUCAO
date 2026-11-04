import {beforeEach, describe, it, expect} from 'vitest';
import {validarKitIndependente, saldoKitsIndependentes} from '../kitsIndependentes';
import {obterOperacoes} from '../regrasOperacao';
import {calcularPeriodosFinanceirosLocacao} from '../locacaoFinanceira';
import {obterValorMensalLocacaoEfetivo, formatarEquipamentoFinanceiro, atividadeEhServicoFaturavel} from '../financeiroAtividades';
import {consolidarFechamentoMensal} from '../fechamentoMensal';
import {montarEquipamentosPorObra} from '../equipamentosPorObra';
import {obterPendenciasOperacionais} from '../pendenciasOperacionais';
const obra={id:'obra-kit-teste',nome:'Obra sintética',construtora:'Construtora sintética',tabelaComercial:{locacoes:{'Balancinho-Contrapeso':600}}};
const entrada=(extra={})=>({id:'entrega',obraId:obra.id,equipamento:'Kit Contrapeso',servico:'Somente aluguel',quantidade:1,dataLiberacao:'2026-07-16',iniciaLocacao:true,encerraLocacao:false,cobraServico:false,usaContrapeso:false,valoresCongelados:{locacaoMensalUnitario:600,totalLocacaoMensal:600,totalServico:0},...extra});
const saida=(extra={})=>entrada({id:'retirada',servico:'Somente recolhimento',iniciaLocacao:false,encerraLocacao:true,dataLiberacao:'2026-07-25',...extra});
const periodos=(atividades,mes='2026-07',obras=[obra])=>{
 const [ano,m]=mes.split('-').map(Number),dia=new Date(ano,m,0).getDate();
 return calcularPeriodosFinanceirosLocacao({atividadesBase:atividades,inicioMes:mes+'-01',fimMes:mes+'-'+dia,diasNoMes:dia,obras,formatarEquipamento:formatarEquipamentoFinanceiro,obterValorMensalLocacao:a=>obterValorMensalLocacaoEfetivo(a,{obras})}).periodos;
};
const total=ps=>ps.reduce((n,p)=>n+p.valorProporcional,0);
beforeEach(()=>{const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};});
describe('locação quantitativa independente de kit contrapeso',()=>{
 it('autoriza apenas aluguel/recolhimento',()=>expect(obterOperacoes('Kit Contrapeso').map(o=>o.nome)).toEqual(['Somente aluguel','Somente recolhimento']));
 it('entrega no meio do mês: 16 dias a 600/30',()=>{const ps=periodos([entrada()]);expect(ps).toHaveLength(1);expect(ps[0].categoria).toBe('Kit Contrapeso');expect(total(ps)).toBe(320);});
 it('multiplica por três kits',()=>expect(total(periodos([entrada({quantidade:3})]))).toBe(960));
 it('recolhimento parcial encerra somente um dos três kits',()=>{const as=[entrada({quantidade:3}),saida()];expect(total(periodos(as))).toBe(840);expect(saldoKitsIndependentes(as,obra)).toBe(2);});
 it('recolhimento total encerra todos os períodos',()=>{const as=[entrada({quantidade:3}),saida({quantidade:3})];expect(total(periodos(as))).toBe(600);expect(total(periodos(as,'2026-08'))).toBe(0);});
 it('passa ao mês seguinte com mensalidade integral',()=>expect(total(periodos([entrada({quantidade:2})],'2026-08'))).toBe(1200));
 it('entrega e retirada no mesmo dia independem da ordem de armazenamento',()=>{
  const as=[saida({dataLiberacao:'2026-07-16'}),entrada()];expect(total(periodos(as))).toBe(20);expect(montarEquipamentosPorObra({obra,atividades:as}).linhas).toHaveLength(0);
 });
 it('lotes com preços distintos mantêm FIFO entre competências',()=>{
  const as=[entrada({id:'lote-antigo',dataLiberacao:'2026-06-01'}),entrada({id:'lote-novo',dataLiberacao:'2026-07-01',valoresCongelados:{locacaoMensalUnitario:900}}),saida({dataLiberacao:'2026-07-25'})];
  expect(periodos(as).find(p=>p.atividadeFimId==='retirada').atividadeInicioId).toBe('lote-antigo');
  expect(periodos(as,'2026-08').map(p=>p.valorMensalUnitario)).toEqual([900]);
 });
 it('consulta comercial usa a chave existente sem preço fixo no código',()=>{const a=entrada({valoresCongelados:undefined});expect(obterValorMensalLocacaoEfetivo(a,{obras:[obra]})).toEqual({valor:600,origem:'Estimado obra'});});
 it('respeita zero explícito da obra mesmo com padrão maior',()=>{const zero={...obra,tabelaComercial:{locacoes:{'Balancinho-Contrapeso':0}}};expect(obterValorMensalLocacaoEfetivo(entrada({valoresCongelados:undefined}),{obras:[zero],tabelaComercialPadrao:{locacoes:{'Balancinho-Contrapeso':900}}}).valor).toBe(0);});
 it('preserva zero congelado',()=>expect(total(periodos([entrada({valoresCongelados:{locacaoMensalUnitario:0,totalLocacaoMensal:0,totalServico:0}})]))).toBe(0));
 it('alteração posterior da tabela não muda preço congelado',()=>expect(total(periodos([entrada()],'2026-07',[{...obra,tabelaComercial:{locacoes:{'Balancinho-Contrapeso':999}}}]))).toBe(320));
 it.each(['Somente aluguel','Somente recolhimento'])('%s nunca é serviço faturável',servico=>expect(atividadeEhServicoFaturavel(entrada({servico,cobraServico:true,valoresCongelados:{totalServico:999}}))).toBe(false));
 it('fechamento soma somente a locação',()=>{const as=[entrada(),saida()];const result=consolidarFechamentoMensal({atividadesServicos:as.filter(atividadeEhServicoFaturavel),periodosLocacao:periodos(as),obras:[obra],obterValorServico:()=>({valor:999})});expect(result.totais).toEqual({totalServicos:0,totalLocacoes:200,totalGeral:200});});
 it.each([0,-1,1.5,'',NaN])('rejeita quantidade inválida %s',quantidade=>expect(()=>validarKitIndependente(entrada({quantidade}),[],obra)).toThrow('inteira'));
 it('rejeita serviço de instalação',()=>expect(()=>validarKitIndependente(entrada({servico:'Instalação'}),[],obra)).toThrow('somente'));
 it('bloqueia retirada maior e retirada antes da entrega',()=>{expect(()=>validarKitIndependente(saida({quantidade:2}),[entrada()],obra)).toThrow('saldo');expect(()=>validarKitIndependente(saida({dataLiberacao:'2026-07-01'}),[entrada()],obra)).toThrow('saldo');});
 it('não utiliza saldo de outra obra',()=>expect(()=>validarKitIndependente(saida(),[entrada({obraId:'outra'})],obra)).toThrow('saldo'));
 it('agendamento não movimenta saldo e liberação é validada',()=>{const ag=saida({dataLiberacao:''});expect(()=>validarKitIndependente(ag,[],obra)).not.toThrow();expect(saldoKitsIndependentes([entrada({dataLiberacao:''})],obra)).toBe(0);expect(()=>validarKitIndependente({...ag,dataLiberacao:'2026-07-25'},[],obra)).toThrow('saldo');});
 it('edição retroativa não pode invalidar retirada posterior',()=>expect(()=>validarKitIndependente(entrada({quantidade:1}),[entrada({quantidade:3}),saida({quantidade:3})],obra)).toThrow('saldo'));
 it('acessórios não financiam retirada independente nem são encerrados por ela',()=>{
  const acessorio=entrada({id:'balancinho',equipamento:'Balancinho',tipoBalancinho:'Eletrico',servico:'Instalação',usaContrapeso:true,valoresCongelados:{locacaoMensalUnitario:1200,adicionalContrapesoLocacao:300,totalLocacaoMensal:1500},quantidade:1});
  expect(()=>validarKitIndependente(saida(),[acessorio],obra)).toThrow('saldo');
  const ps=periodos([acessorio,entrada(),saida()]);expect(ps.filter(p=>p.categoria==='Kit Contrapeso' && p.atividadeInicioId==='balancinho').reduce((n,p)=>n+p.valorProporcional,0)).toBe(160);
  const eq=montarEquipamentosPorObra({obra,atividades:[acessorio,entrada({quantidade:2}),saida()]});expect(eq.resumo).toMatchObject({eletricos:1,kitsContrapeso:2,totalEquipamentos:1,totalGeral:3});
 });
 it('equipamentos por obra sem duplicidade e sem pendência patrimonial',()=>{const as=[entrada({quantidade:3}),saida()];const eq=montarEquipamentosPorObra({obra,atividades:as});expect(eq.linhas).toHaveLength(2);expect(eq.resumo).toMatchObject({kitsContrapeso:2,totalEquipamentos:0,totalGeral:2});expect(obterPendenciasOperacionais(as,{obras:[obra]})).toHaveLength(0);});
});

it('consolida um acessório em Therezinha e um kit independente em José Rocha', () => {
 const therezinha = {...obra, id:'obra-teste-a', nome:'Therezinha'};
 const jose = {...obra, id:'obra-teste-b', nome:'José Rocha'};
 const atividades = [
  entrada({id:'acessorio', obraId:therezinha.id, equipamento:'Balancinho', tipoBalancinho:'Eletrico', servico:'Instalação', usaContrapeso:true}),
  entrada({obraId:jose.id, quantidade:3}),
  saida({obraId:jose.id, quantidade:2}),
  entrada({id:'agendado', obraId:jose.id, dataLiberacao:'', quantidade:9}),
 ];
 const contar = obra => montarEquipamentosPorObra({obra, atividades}).totalKitsContrapeso;
 expect([contar(therezinha), contar(jose)]).toEqual([1, 1]);
 expect(contar({...jose, id:'obra-homonima'})).toBe(0);
});
