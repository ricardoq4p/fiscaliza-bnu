'use client';

import { useEffect, useMemo, useState } from 'react';
import dados from '../data/obras.json';

const POR_PAGINA = 12;

const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titulo = (texto = '') => texto.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => `${espaco}${letra.toLocaleUpperCase('pt-BR')}`);
const rotuloSituacao = (situacao) => situacao ? titulo(situacao) : 'Não informada';

export default function Home() {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('Todas');
  const [secretaria, setSecretaria] = useState('Todas');
  const [pagina, setPagina] = useState(1);

  const situacoes = useMemo(() => [...new Set(dados.obras.map((obra) => obra.situacao).filter(Boolean))].sort(), []);
  const secretarias = useMemo(() => [...new Set(dados.obras.map((obra) => obra.secretaria).filter(Boolean))].sort(), []);
  const contagens = useMemo(() => dados.obras.reduce((acc, obra) => {
    acc[obra.situacao || 'NÃO INFORMADA'] = (acc[obra.situacao || 'NÃO INFORMADA'] || 0) + 1;
    return acc;
  }, {}), []);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return dados.obras.filter((obra) => {
      const conteudo = normalizar(`${obra.codigo} ${obra.descricao} ${obra.logradouro} ${obra.secretaria} ${obra.intervencao} ${obra.situacao}`);
      return (!termo || conteudo.includes(termo))
        && (situacao === 'Todas' || obra.situacao === situacao)
        && (secretaria === 'Todas' || obra.secretaria === secretaria);
    });
  }, [busca, situacao, secretaria]);

  useEffect(() => setPagina(1), [busca, situacao, secretaria]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const obrasDaPagina = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const sincronizadoEm = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(dados.sincronizadoEm));
  const limparFiltros = () => { setBusca(''); setSituacao('Todas'); setSecretaria('Todas'); };

  return <main>
    <header><div className="nav"><strong>Fiscaliza <span>BNU</span></strong><nav><a href="#obras">Pesquisar obras</a><a href="#fonte">Sobre os dados</a></nav></div></header>

    <section className="hero">
      <div className="tag">OBRAS PÚBLICAS DE BLUMENAU</div>
      <h1>O que está acontecendo<br/><em>perto de você?</em></h1>
      <p>Digite o nome da sua rua, bairro ou uma palavra da obra para consultar informações publicadas pela Prefeitura.</p>
      <div className="search"><span aria-hidden="true">⌕</span><label className="srOnly" htmlFor="busca-obras">Pesquisar obras</label><input id="busca-obras" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Ex.: Rua Amazonas, Garcia, escola..." autoComplete="off"/></div>
      <div className="sourceNote">Dados reais do Portal de Transparência em Obras Públicas · Sincronizados em {sincronizadoEm}</div>
    </section>

    <section className="content" id="obras">
      <div className="cards">
        <article><small>TODAS AS OBRAS</small><b>{dados.total}</b><span>Registros publicados</span></article>
        <article><small>EM ANDAMENTO</small><b>{contagens['EM ANDAMENTO'] || 0}</b><span>Obras e projetos ativos</span></article>
        <article><small>CONCLUÍDAS</small><b>{contagens['CONCLUÍDA'] || 0}</b><span>Marcadas como finalizadas</span></article>
        <article className="warn"><small>PARALISADAS</small><b>{contagens.PARALISADA || 0}</b><span>Precisam de atenção</span></article>
      </div>

      <div className="sectionTitle"><div><h2>Encontre uma obra</h2><p>Pesquise pelo endereço e refine por situação ou órgão responsável.</p></div></div>
      <div className="filters" aria-label="Filtros de obras">
        <label>Situação<select value={situacao} onChange={(event) => setSituacao(event.target.value)}><option>Todas</option>{situacoes.map((item) => <option key={item} value={item}>{rotuloSituacao(item)}</option>)}</select></label>
        <label>Órgão responsável<select value={secretaria} onChange={(event) => setSecretaria(event.target.value)}><option>Todas</option>{secretarias.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="clear" type="button" onClick={limparFiltros}>Limpar filtros</button>
        <strong className="resultCount">{filtradas.length} {filtradas.length === 1 ? 'obra encontrada' : 'obras encontradas'}</strong>
      </div>

      {obrasDaPagina.length > 0 ? <>
        <div className="grid">{obrasDaPagina.map((obra, indice) => <article className="obra" key={`${obra.codigo}-${indice}`}>
          <div className="obraTop"><span className={`pill ${normalizar(obra.situacao).replace(/\s/g, '')}`}>{rotuloSituacao(obra.situacao)}</span><small>Código {obra.codigo || 'não informado'}</small></div>
          <h3>{titulo(obra.descricao)}</h3>
          <p className="address"><b>{titulo(obra.logradouro || 'Endereço não informado')}</b><span>Blumenau, SC</span></p>
          <dl><div><dt>Tipo</dt><dd>{obra.intervencao || 'Não informado'}</dd></div><div><dt>Responsável</dt><dd>{obra.secretaria || 'Não informado'}</dd></div></dl>
          <footer><span>Fonte oficial</span><a href={dados.fonte} target="_blank" rel="noreferrer">Consultar no EngeGOV ↗</a></footer>
        </article>)}</div>
        <nav className="pagination" aria-label="Paginação"><button type="button" disabled={pagina === 1} onClick={() => setPagina((atual) => atual - 1)}>← Anterior</button><span>Página <b>{pagina}</b> de {totalPaginas}</span><button type="button" disabled={pagina === totalPaginas} onClick={() => setPagina((atual) => atual + 1)}>Próxima →</button></nav>
      </> : <div className="empty"><b>Nenhuma obra encontrada</b><p>Confira o nome da rua ou tente remover algum filtro.</p><button type="button" onClick={limparFiltros}>Limpar filtros</button></div>}
    </section>

    <section className="about" id="fonte"><div><h2>De onde vêm essas informações?</h2><p>Os registros são publicados pela Prefeitura de Blumenau no Portal de Transparência em Obras Públicas (EngeGOV). O Fiscaliza BNU organiza a listagem oficial para facilitar a pesquisa por cidadãos.</p><p><b>Importante:</b> situação, descrição e endereço são apresentados como constam na fonte. Consulte o portal oficial para documentos e informações detalhadas.</p><a href={dados.fonte} target="_blank" rel="noreferrer">Acessar a fonte oficial ↗</a></div></section>
    <footer className="footer"><b>Fiscaliza BNU</b><p>Informação pública em linguagem simples para fortalecer a participação cidadã.</p></footer>
  </main>;
}
