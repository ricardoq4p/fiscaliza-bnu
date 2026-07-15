'use client';
import { useMemo, useState } from 'react';

const obras = [
 {id:1,nome:'Ampliação da Escola Municipal',bairro:'Garcia',categoria:'Educação',status:'Em andamento',fisico:72,pago:100,valor:'R$ 4,2 milhões',atualizacao:34},
 {id:2,nome:'Nova Unidade de Saúde',bairro:'Fortaleza',categoria:'Saúde',status:'Em andamento',fisico:64,pago:61,valor:'R$ 6,8 milhões',atualizacao:8},
 {id:3,nome:'Pavimentação e drenagem urbana',bairro:'Itoupava Central',categoria:'Mobilidade',status:'Atrasada',fisico:48,pago:57,valor:'R$ 3,1 milhões',atualizacao:71},
 {id:4,nome:'Reforma de Centro de Educação Infantil',bairro:'Velha',categoria:'Educação',status:'Concluída',fisico:100,pago:100,valor:'R$ 1,9 milhão',atualizacao:12},
 {id:5,nome:'Construção de ponte municipal',bairro:'Ponta Aguda',categoria:'Mobilidade',status:'Em andamento',fisico:39,pago:35,valor:'R$ 12,4 milhões',atualizacao:19},
 {id:6,nome:'Revitalização de praça pública',bairro:'Água Verde',categoria:'Lazer',status:'Paralisada',fisico:31,pago:46,valor:'R$ 980 mil',atualizacao:96}
];

export default function Home(){
 const [busca,setBusca]=useState(''); const [status,setStatus]=useState('Todos');
 const filtradas=useMemo(()=>obras.filter(o=>(status==='Todos'||o.status===status)&&`${o.nome} ${o.bairro} ${o.categoria}`.toLowerCase().includes(busca.toLowerCase())),[busca,status]);
 const atencao=obras.filter(o=>(o.pago===100&&o.status!=='Concluída')||o.status==='Atrasada'||o.status==='Paralisada'||o.atualizacao>60).length;
 return <main>
  <header><div className="nav"><strong>Fiscaliza <span>BNU</span></strong><nav>Visão geral　 Explorar obras　 Metodologia</nav></div></header>
  <section className="hero"><div className="tag">TRANSPARÊNCIA PARA TODOS</div><h1>Entenda as obras públicas<br/><em>sem complicação.</em></h1><p>Pesquise, compare prazos e pagamentos e acompanhe onde os recursos públicos estão sendo aplicados em Blumenau.</p><div className="search"><span>⌕</span><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquise por obra, bairro ou categoria..."/></div><div className="demo">ⓘ Versão demonstrativa — os dados exibidos são fictícios.</div></section>
  <section className="content">
   <div className="period"><div><b>Período analisado</b><small>Os indicadores abaixo consideram o período selecionado.</small></div><select><option>Últimos 12 meses</option><option>Ano atual</option><option>Últimos 4 anos</option><option>Todo o histórico</option></select></div>
   <div className="cards"><article><small>OBRAS NO PERÍODO</small><b>24</b><span>↗ 6 iniciadas recentemente</span></article><article><small>EM ANDAMENTO</small><b>14</b><span>58% das obras do período</span></article><article><small>CONCLUÍDAS</small><b>7</b><span>Dentro do período selecionado</span></article><article className="warn"><small>PRECISAM DE ATENÇÃO</small><b>{atencao}</b><span>Ver situações que merecem análise →</span></article></div>
   <div className="sectionTitle"><div><h2>Explore as obras</h2><p>Consulte informações de execução, pagamentos e atualização.</p></div><select value={status} onChange={e=>setStatus(e.target.value)}><option>Todos</option><option>Em andamento</option><option>Atrasada</option><option>Paralisada</option><option>Concluída</option></select></div>
   <div className="grid">{filtradas.map(o=><article className="obra" key={o.id}><div className="obraTop"><span className={'pill '+o.status.replace(' ','').toLowerCase()}>{o.status}</span><small>{o.categoria}</small></div><h3>{o.nome}</h3><p>⌖ {o.bairro}, Blumenau</p><div className="metrics"><div><label>Execução física <b>{o.fisico}%</b></label><i><u style={{width:o.fisico+'%'}}/></i></div><div><label>Pagamento <b>{o.pago}%</b></label><i><u style={{width:o.pago+'%'}}/></i></div></div>{o.pago===100&&o.status!=='Concluída'&&<div className="alert">⚠ Pagamento concluído, obra ainda em andamento</div>}{o.atualizacao>60&&<div className="alert">⚠ Sem atualização há mais de 60 dias</div>}<footer><div><small>VALOR ATUAL</small><b>{o.valor}</b></div><button>Ver detalhes →</button></footer></article>)}</div>
  </section>
  <footer className="footer"><b>Fiscaliza BNU</b><p>Dados públicos com contexto para fortalecer a participação cidadã.</p></footer>
 </main>
}
