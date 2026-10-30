import React, {useState,useEffect} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import Formulario from '../../components/Atividades';

const captured=vi.hoisted(()=>({buttons:[],selects:[],effects:[]}));
vi.mock('react',async()=>{const real=await vi.importActual('react');return {...real,useState:vi.fn(real.useState),useEffect:vi.fn()};});
function capture(type,props){if(type==='button')captured.buttons.push(props);if(type==='select')captured.selects.push(props);}
vi.mock('react/jsx-runtime',async()=>{const real=await vi.importActual('react/jsx-runtime');return {...real,jsx:(t,p,...r)=>{capture(t,p);return real.jsx(t,p,...r);},jsxs:(t,p,...r)=>{capture(t,p);return real.jsxs(t,p,...r);}};});
vi.mock('react/jsx-dev-runtime',async()=>{const real=await vi.importActual('react/jsx-dev-runtime');return {...real,jsxDEV:(t,p,...r)=>{capture(t,p);return real.jsxDEV(t,p,...r);}};});
const obra={id:'o-kit',nome:'Obra teste',construtora:'Construtora teste',tabelaComercial:{locacoes:{'Balancinho-Contrapeso':600}}};
const form={construtora:obra.construtora,obra:obra.nome,obraId:obra.id,equipamento:'Kit Contrapeso',servico:'Somente aluguel',quantidade:1,dataLiberacao:'2026-07-16',dataAgendamento:'',usaContrapeso:false,numerosPatrimonio:[],valorMensalLocacao:600,valorTotalMensalLocacao:600};
function render(extra={},atividades=[]){
 captured.buttons=[];captured.selects=[];captured.effects=[];
 const draft={...form,...extra},setters=[];let i=0;
 useState.mockImplementation(initial=>{const index=i++,setter=vi.fn();setters[index]=setter;return [index===0?[{id:'c',nome:obra.construtora}]:index===1?[obra]:index===2?atividades:index===14?draft:initial,setter];});
 useEffect.mockImplementation(effect=>captured.effects.push(effect));
 const html=renderToStaticMarkup(<Formulario/>);
 return {draft,html,setters,save:captured.buttons.find(b=>b.children==='Salvar'),equipment:captured.selects.find(s=>s.children?.[0]?.props?.children==='Equipamento')};
}
beforeEach(()=>{const data=new Map();vi.stubGlobal('localStorage',{getItem:k=>data.get(k)??null,setItem:vi.fn((k,v)=>data.set(k,v)),removeItem:k=>data.delete(k)});vi.stubGlobal('alert',vi.fn());});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('formulário local de kits independentes',()=>{
 it('exibe kit só em aluguel/recolhimento e sem patrimônio',()=>{
  const v=render();expect(v.html).not.toContain('Números de patrimônio');expect(v.html).not.toContain('Equipamentos cadastrados disponíveis');expect(v.html).toContain('<option selected="">Kit Contrapeso</option>');
  expect(render({equipamento:'Balancinho',servico:'Instalação'}).html).not.toContain('<option>Kit Contrapeso</option>');
  expect(render({servico:'Somente recolhimento'}).html).not.toContain('Equipamentos ativos desta obra');
 });
 it('permite escolher aluguel antes do equipamento e então revela o kit',()=>{
  expect(render({equipamento:'',servico:''}).html).toContain('<option>Somente aluguel</option>');
  expect(render({equipamento:'',servico:'Somente aluguel'}).html).toContain('<option>Kit Contrapeso</option>');
 });
 it('salva entrada sem serviço e sem patrimônio com valor congelado',()=>{
  const persist=vi.spyOn(localStorage,'setItem');const v=render();v.save.onClick();
  expect(persist).toHaveBeenCalledTimes(1);const a=JSON.parse(localStorage.getItem("atividades"))[0];expect(a).toMatchObject({equipamento:'Kit Contrapeso',quantidade:1,iniciaLocacao:true,cobraServico:false,numerosPatrimonio:[],valorTotalServico:0,statusVinculoPatrimonio:'NAO_APLICAVEL',valoresCongelados:{locacaoMensalUnitario:600,totalLocacaoMensal:600,totalServico:0}});
 });
 it('bloqueia recolhimento superior sem persistir e preserva formulário',()=>{
  globalThis.alert=vi.fn();const persist=vi.spyOn(localStorage,'setItem');const v=render({servico:'Somente recolhimento',quantidade:2});v.save.onClick();expect(persist).not.toHaveBeenCalled();expect(alert).toHaveBeenCalledWith(expect.stringContaining('saldo'));expect(v.setters[14]).not.toHaveBeenCalled();
 });
 it('quantidade fracionária é rejeitada antes de salvar',()=>{globalThis.alert=vi.fn();const persist=vi.spyOn(localStorage,'setItem');render({quantidade:1.5}).save.onClick();expect(persist).not.toHaveBeenCalled();expect(alert).toHaveBeenCalledWith(expect.stringContaining('inteira'));});
 it('preço automático vem da tabela de obra',()=>{
  const v=render({valorMensalLocacao:'',valorTotalMensalLocacao:''});const effect=captured.effects.find(fn=>fn.toString().includes('obterPrecoLocacaoDaTabela'));expect(effect).toBeTruthy();effect();const update=v.setters[14].mock.calls[0][0];expect(update(v.draft)).toMatchObject({valorMensalLocacao:600,valorTotalMensalLocacao:600});
 });

 it('persistência mantém os registros antigos e permite reabrir os novos dados',()=>{
  const anterior={id:'registro-antigo',equipamento:'Balancinho',servico:'Instalação',quantidade:1,valoresCongelados:{locacaoMensalUnitario:123,totalServico:77}};
  render({},[anterior]).save.onClick();const reabertos=JSON.parse(localStorage.getItem('atividades'));
  expect(reabertos).toHaveLength(2);expect(reabertos[1]).toEqual(anterior);expect(reabertos[0].valoresCongelados.locacaoMensalUnitario).toBe(600);
 });
 it('recolhimento parcial persiste sem alterar entrada e sem movimentar patrimônio',()=>{
  const entrada={...form,id:'entrada-anterior',quantidade:3,iniciaLocacao:true,encerraLocacao:false,cobraServico:false,valoresCongelados:{locacaoMensalUnitario:600,totalLocacaoMensal:1800,totalServico:0}};
  render({servico:'Somente recolhimento',quantidade:1,dataLiberacao:'2026-07-25'},[entrada]).save.onClick();
  const salvos=JSON.parse(localStorage.getItem('atividades'));expect(salvos[1]).toEqual(entrada);expect(salvos[0]).toMatchObject({quantidade:1,iniciaLocacao:false,encerraLocacao:true,cobraServico:false,statusVinculoPatrimonio:'NAO_APLICAVEL'});
  expect(localStorage.setItem.mock.calls.map(c=>c[0])).toEqual(['atividades']);
 });
 it('congela zero explícito sem substituir por preço padrão',()=>{
  const v=render({valorMensalLocacao:0,valorTotalMensalLocacao:0});v.save.onClick();expect(JSON.parse(localStorage.getItem('atividades'))[0].valoresCongelados).toMatchObject({locacaoMensalUnitario:0,totalLocacaoMensal:0,totalServico:0});
 });
});
