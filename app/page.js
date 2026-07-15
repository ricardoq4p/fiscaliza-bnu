'use client';

import { useMemo, useState } from 'react';

const obras = [
  { id: 1, nome: 'Ampliação da Escola Municipal', bairro: 'Garcia', rua: 'Rua Amazonas', categoria: 'Educação', status: 'Em andamento', fisico: 72, pago: 68, valor: 'R$ 4,2 milhões', atualizacao: 34 },
  { id: 2, nome: 'Nova Unidade de Saúde', bairro: 'Fortaleza', rua: 'Rua Francisco Vahldieck', categoria: 'Saúde', status: 'Em andamento', fisico: 64, pago: 61, valor: 'R$ 6,8 milhões', atualizacao: 8 },
  { id: 3, nome: 'Pavimentação e drenagem urbana', bairro: 'Itoupava Central', rua: 'Rua Dr. Pedro Zimmermann', categoria: 'Mobilidade', status: 'Atrasada', fisico: 48, pago: 57, valor: 'R$ 3,1 milhões', atualizacao: 71 },
  { id: 4, nome: 'Reforma de Centro de Educação Infantil', bairro: 'Velha', rua: 'Rua dos Caçadores', categoria: 'Educação', status: 'Concluída', fisico: 100, pago: 100, valor: 'R$ 1,9 milhão', atualizacao: 12 },
  { id: 5, nome: 'Construção de ponte municipal', bairro: 'Ponta Aguda', rua: 'Rua República Argentina', categoria: 'Mobilidade', status: 'Em andamento', fisico: 39, pago: 35, valor: 'R$ 12,4 milhões', atualizacao: 19 },
  { id: 6, nome: 'Revitalização de praça pública', bairro: 'Água Verde', rua: 'Rua General Osório', categoria: 'Lazer', status: 'Paralisada', fisico: 31, pago: 46, valor: 'R$ 980 mil', atualizacao: 96 }
];

const normalizar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Home() {
  const [busca, setBusca] = useState('');
  const [bairro, setBairro] = useState('Todos');
  const [status, setStatus] = useState('Todos');

  const bairros = useMemo(() => [...new Set(obras.map((obra) => obra.bairro))].sort(), []);
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return obras.filter((obra) => {
      const conteudo = normalizar(`${obra.nome} ${obra.bairro} ${obra.rua} ${obra.categoria}`);
      return (!termo || conteudo.includes(termo))
        && (bairro === 'Todos' || obra.bairro === bairro)
        && (status === 'Todos' || obra.status === status);
    });
  }, [busca, bairro, status]);

  const limparFiltros = () => {
    setBusca('');
    setBairro('Todos');
    setStatus('Todos');
  };

  const emAndamento = obras.filter((obra) => obra.status === 'Em andamento').length;
  const concluidas = obras.filter((obra) => obra.status === 'Concluída').length;
  const atencao = obras.filter((obra) => obra.status === 'Atrasada' || obra.status === 'Paralisada' || obra.atualizacao > 60).length;

  return <main>
    <header><div className="nav"><strong>Fiscaliza <span>BNU</span></strong><nav>Visão geral　 Explorar obras　 Metodologia</nav></div></header>
    <section className="hero">
      <div className="tag">TRANSPARÊNCIA PARA TODOS</div>
      <h1>Descubra as obras públicas<br/><em>perto de você.</em></h1>
      <p>Pesquise pelo nome da sua rua ou bairro e acompanhe a situação, a execução e os pagamentos das obras de Blumenau.</p>
      <div className="search"><span aria-hidden="true">⌕</span><label className="srOnly" htmlFor="busca-obras">Pesquisar obras</label><input id="busca-obras" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Digite uma rua, bairro ou nome da obra..."/></div>
      <div className="demo">ⓘ Versão demonstrativa — os dados exibidos são fictícios.</div>
    </section>

    <section className="content">
      <div className="cards">
        <article><small>OBRAS CADASTRADAS</small><b>{obras.length}</b><span>Na base demonstrativa</span></article>
        <article><small>EM ANDAMENTO</small><b>{emAndamento}</b><span>Com execução ativa</span></article>
        <article><small>CONCLUÍDAS</small><b>{concluidas}</b><span>Entregues à população</span></article>
        <article className="warn"><small>PRECISAM DE ATENÇÃO</small><b>{atencao}</b><span>Atrasadas, paralisadas ou desatualizadas</span></article>
      </div>

      <div className="sectionTitle"><div><h2>Obras na sua região</h2><p>Use um ou mais filtros para encontrar rapidamente o que procura.</p></div></div>
      <div className="filters" aria-label="Filtros de obras">
        <label>Bairro<select value={bairro} onChange={(event) => setBairro(event.target.value)}><option>Todos</option>{bairros.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Situação<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option><option>Em andamento</option><option>Atrasada</option><option>Paralisada</option><option>Concluída</option></select></label>
        <button className="clear" type="button" onClick={limparFiltros}>Limpar filtros</button>
        <strong className="resultCount">{filtradas.length} {filtradas.length === 1 ? 'obra encontrada' : 'obras encontradas'}</strong>
      </div>

      {filtradas.length > 0 ? <div className="grid">{filtradas.map((obra) => <article className="obra" key={obra.id}>
        <div className="obraTop"><span className={`pill ${normalizar(obra.status).replace(/\s/g, '')}`}>{obra.status}</span><small>{obra.categoria}</small></div>
        <h3>{obra.nome}</h3>
        <p className="address"><b>{obra.rua}</b><span>{obra.bairro}, Blumenau</span></p>
        <div className="metrics"><div><label>Execução física <b>{obra.fisico}%</b></label><i><u style={{ width: `${obra.fisico}%` }}/></i></div><div><label>Pagamento <b>{obra.pago}%</b></label><i><u style={{ width: `${obra.pago}%` }}/></i></div></div>
        {obra.pago === 100 && obra.status !== 'Concluída' && <div className="alert">⚠ Pagamento concluído, obra ainda em andamento</div>}
        {obra.atualizacao > 60 && <div className="alert">⚠ Sem atualização há mais de 60 dias</div>}
        <footer><div><small>VALOR ATUAL</small><b>{obra.valor}</b></div><button type="button">Ver detalhes →</button></footer>
      </article>)}</div> : <div className="empty"><b>Nenhuma obra encontrada</b><p>Tente pesquisar outra rua ou remover algum filtro.</p><button type="button" onClick={limparFiltros}>Limpar filtros</button></div>}
    </section>
    <footer className="footer"><b>Fiscaliza BNU</b><p>Dados públicos com contexto para fortalecer a participação cidadã.</p></footer>
  </main>;
}
