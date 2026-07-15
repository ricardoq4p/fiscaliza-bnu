'use client';

import { useEffect, useMemo, useState } from 'react';
import dados from '../data/obras.json';

const POR_PAGINA = 12;
const RAIO_KM = 1;
const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titulo = (texto = '') => texto.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => `${espaco}${letra.toLocaleUpperCase('pt-BR')}`);
const rotuloSituacao = (situacao) => situacao ? titulo(situacao) : 'Não informada';
const orientacaoSituacao = {
  'EM ANDAMENTO': { titulo: 'Acompanhe o avanço', texto: 'Compare o andamento observado no local com as medições e o prazo publicados no portal oficial.' },
  'CONCLUÍDA': { titulo: 'Confira a entrega', texto: 'Observe acabamento, acessibilidade e se a obra entregue corresponde ao que foi anunciado.' },
  'PARALISADA': { titulo: 'Procure o motivo', texto: 'Verifique no portal oficial a justificativa da paralisação e se existe previsão pública de retomada.' }
};

function distanciaKm(a, b) {
  const rad = (graus) => graus * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const calculo = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(calculo), Math.sqrt(1 - calculo));
}

export default function Home() {
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');
  const [local, setLocal] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [situacao, setSituacao] = useState('Todas');
  const [secretaria, setSecretaria] = useState('Todas');
  const [pagina, setPagina] = useState(1);
  const [detalhes, setDetalhes] = useState({});
  const [obraAberta, setObraAberta] = useState(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(null);
  const [erroDetalhes, setErroDetalhes] = useState('');
  const [perguntaAnalise, setPerguntaAnalise] = useState('');
  const [analise, setAnalise] = useState(null);
  const [carregandoAnalise, setCarregandoAnalise] = useState(false);
  const [erroAnalise, setErroAnalise] = useState('');

  const situacoes = useMemo(() => [...new Set(dados.obras.map((obra) => obra.situacao).filter(Boolean))].sort(), []);
  const secretarias = useMemo(() => [...new Set(dados.obras.map((obra) => obra.secretaria).filter(Boolean))].sort(), []);
  const contagens = useMemo(() => dados.obras.reduce((acc, obra) => {
    acc[obra.situacao || 'NÃO INFORMADA'] = (acc[obra.situacao || 'NÃO INFORMADA'] || 0) + 1;
    return acc;
  }, {}), []);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    let resultado = dados.obras.map((obra) => ({ ...obra }));
    if (local) {
      resultado = resultado
        .filter((obra) => Number.isFinite(obra.latitude) && Number.isFinite(obra.longitude))
        .map((obra) => ({ ...obra, distancia: distanciaKm(local, obra) }))
        .filter((obra) => obra.distancia <= RAIO_KM)
        .sort((a, b) => a.distancia - b.distancia);
    } else if (termo) {
      resultado = resultado.filter((obra) => normalizar(`${obra.codigo} ${obra.descricao} ${obra.logradouro} ${obra.secretaria} ${obra.intervencao} ${obra.situacao}`).includes(termo));
    }
    return resultado.filter((obra) => (situacao === 'Todas' || obra.situacao === situacao) && (secretaria === 'Todas' || obra.secretaria === secretaria));
  }, [busca, local, situacao, secretaria]);

  useEffect(() => setPagina(1), [busca, local, situacao, secretaria]);

  async function pesquisar(event) {
    event.preventDefault();
    const termo = digitado.trim();
    if (termo.length < 3) { setMensagem('Digite uma rua, bairro ou o código completo da obra.'); return; }
    if (/^\d+$/.test(termo)) {
      setLocal(null); setBusca(termo); setMensagem(`Resultado para o código de obra ${termo}.`);
      document.getElementById('obras')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setCarregando(true); setMensagem(''); setLocal(null); setBusca(termo);
    try {
      const response = await fetch(`/api/geocodificar?q=${encodeURIComponent(termo)}`);
      const resultado = await response.json();
      if (resultado.encontrado) {
        setLocal({ latitude: resultado.latitude, longitude: resultado.longitude });
        setMensagem(`Mostrando obras em um raio de ${RAIO_KM} km de ${resultado.nome}${resultado.bairro ? `, ${resultado.bairro}` : ''}.`);
      } else {
        setMensagem('Endereço não localizado. Mostrando correspondências de texto na base oficial.');
      }
    } catch {
      setMensagem('A localização está indisponível agora. Mostrando correspondências de texto.');
    } finally {
      setCarregando(false);
      document.getElementById('obras')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function abrirDetalhes(codigo) {
    if (obraAberta === codigo) { setObraAberta(null); return; }
    setObraAberta(codigo); setErroDetalhes('');
    if (detalhes[codigo]) return;
    setCarregandoDetalhes(codigo);
    try {
      const response = await fetch(`/api/obras/${codigo}`);
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.erro);
      setDetalhes((atuais) => ({ ...atuais, [codigo]: resultado }));
    } catch (error) {
      setErroDetalhes(error.message || 'Não foi possível carregar os detalhes.');
    } finally {
      setCarregandoDetalhes(null);
    }
  }

  async function gerarAnalise(event) {
    event.preventDefault();
    if (perguntaAnalise.trim().length < 5) { setErroAnalise('Escreva o que você deseja comparar.'); return; }
    setCarregandoAnalise(true); setErroAnalise('');
    try {
      const response = await fetch('/api/analise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta: perguntaAnalise }) });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.erro);
      setAnalise(resultado);
      requestAnimationFrame(() => document.getElementById('painel-comparativo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (error) {
      setErroAnalise(error.message || 'Não foi possível gerar a comparação.');
    } finally {
      setCarregandoAnalise(false);
    }
  }

  const limparFiltros = () => { setDigitado(''); setBusca(''); setLocal(null); setMensagem(''); setSituacao('Todas'); setSecretaria('Todas'); };
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const obrasDaPagina = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const sincronizadoEm = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(dados.sincronizadoEm));
  const linkMapa = (obra) => `https://www.openstreetmap.org/?mlat=${obra.latitude}&mlon=${obra.longitude}#map=18/${obra.latitude}/${obra.longitude}`;

  return <main>
    <header><div className="nav"><strong>Fiscaliza <span>BNU</span></strong><nav><a href="#obras">Pesquisar obras</a><a href="#fonte">Sobre os dados</a></nav></div></header>
    <section className="hero">
      <div className="tag">OBRAS PÚBLICAS DE BLUMENAU</div><h1>O que está acontecendo<br/><em>perto de você?</em></h1>
      <p>Digite o nome da sua rua, bairro ou o código da obra para consultar as informações públicas.</p>
      <div className="heroTools">
        <form className="toolCard" onSubmit={pesquisar}><label htmlFor="busca-obras"><b>Encontre uma obra</b><span>Por rua, bairro ou código</span></label><div className="search"><span aria-hidden="true">⌕</span><input id="busca-obras" value={digitado} onChange={(event) => setDigitado(event.target.value)} placeholder="Ex.: Rua Cuba, Garcia ou 3913..." autoComplete="off" inputMode="search"/><button type="submit" disabled={carregando}>{carregando ? 'Buscando...' : 'Buscar'}</button></div></form>
        <form className="toolCard aiTool" onSubmit={gerarAnalise}><label htmlFor="pergunta-analise"><b>Compare os dados</b><span>Faça uma pergunta ao painel</span></label><div className="aiSearch"><textarea id="pergunta-analise" value={perguntaAnalise} onChange={(event) => setPerguntaAnalise(event.target.value)} placeholder="Ex.: compare obras em andamento, concluídas e paralisadas" maxLength={400}/><button type="submit" disabled={carregandoAnalise}>{carregandoAnalise ? 'Analisando...' : 'Gerar painel'}</button></div>{erroAnalise && <small className="aiError">{erroAnalise}</small>}</form>
      </div>
      <div className="sourceNote">Dados reais do Portal de Transparência em Obras Públicas · Sincronizados em {sincronizadoEm}</div>
    </section>

    {analise && <section className="analysisDashboard" id="painel-comparativo" aria-live="polite"><div className="analysisInner"><div className="analysisHead"><div><span className="analysisEyebrow">PAINEL COMPARATIVO</span><h2>{analise.titulo}</h2><p>“{analise.pergunta}”</p></div><span className="analysisMode">{analise.modo}</span></div><p className="analysisSummary">{analise.resumo}</p><div className="analysisGrid">{analise.cards.map((card) => <article key={card.situacao}><small>{card.rotulo}</small><b>{card.quantidade}</b><span>{card.percentual}% do total</span><div><i style={{ width: `${card.percentual}%` }}/></div></article>)}</div>{analise.contratos?.cobertura > 0 && <><div className="financeSummary"><article><small>VALOR CONTRATADO</small><b>{analise.contratos.valorContratado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></article><article><small>VALOR MEDIDO</small><b>{analise.contratos.valorExecutado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></article><article><small>PERÍODO PUBLICADO</small><b>{analise.contratos.inicioMaisAntigo || 'Não informado'} — {analise.contratos.terminoMaisRecente || 'Não informado'}</b></article></div><div className="yearTimeline"><h3>Obras por ano de início ou contratação</h3>{analise.contratos.obrasPorAno.map((item) => <p key={item.ano}><span>{item.ano}</span><i style={{ width: `${Math.max(4, item.quantidade / analise.contratos.cobertura * 100)}%` }}/><b>{item.quantidade}</b></p>)}</div></>}<div className="analysisRankings"><div><h3>Órgãos com mais registros</h3>{analise.secretarias.map((item) => <p key={item.nome}><span>{item.nome}</span><b>{item.quantidade}</b></p>)}</div><div><h3>Principais tipos publicados</h3>{analise.tipos.map((item) => <p key={item.nome}><span>{item.nome}</span><b>{item.quantidade}</b></p>)}</div></div><small className="analysisNotice">Comparação calculada sobre {analise.total} registros da base oficial. Dados de prazo e valores disponíveis para {analise.contratos?.cobertura || 0} obras sincronizadas; os totais financeiros consideram somente essa cobertura. A explicação não substitui a consulta aos documentos do EngeGOV.</small></div></section>}

    <section className="content" id="obras">
      <div className="cards"><article><small>TODAS AS OBRAS</small><b>{dados.total}</b><span>Registros publicados</span></article><article><small>EM ANDAMENTO</small><b>{contagens['EM ANDAMENTO'] || 0}</b><span>Obras e projetos ativos</span></article><article><small>CONCLUÍDAS</small><b>{contagens['CONCLUÍDA'] || 0}</b><span>Marcadas como finalizadas</span></article><article className="warn"><small>PARALISADAS</small><b>{contagens.PARALISADA || 0}</b><span>Precisam de atenção</span></article></div>
      <div className="sectionTitle"><div><h2>{local ? 'Obras próximas ao endereço' : 'Encontre uma obra'}</h2><p>{mensagem || 'Pesquise pelo endereço e refine por situação ou órgão responsável.'}</p></div></div>
      <div className="filters" aria-label="Filtros de obras"><label>Situação<select value={situacao} onChange={(event) => setSituacao(event.target.value)}><option>Todas</option>{situacoes.map((item) => <option key={item} value={item}>{rotuloSituacao(item)}</option>)}</select></label><label>Órgão responsável<select value={secretaria} onChange={(event) => setSecretaria(event.target.value)}><option>Todas</option>{secretarias.map((item) => <option key={item}>{item}</option>)}</select></label><button className="clear" type="button" onClick={limparFiltros}>Limpar busca</button><strong className="resultCount">{filtradas.length} {filtradas.length === 1 ? 'obra encontrada' : 'obras encontradas'}</strong></div>

      {obrasDaPagina.length > 0 ? <><div className="grid">{obrasDaPagina.map((obra, indice) => {
        const orientacao = orientacaoSituacao[obra.situacao] || { titulo: 'Confira a informação', texto: 'Use o código da obra para consultar documentos e detalhes no portal oficial.' };
        return <article className="obra" key={`${obra.codigo}-${indice}`}>
          <div className="obraTop"><span className={`pill ${normalizar(obra.situacao).replace(/\s/g, '')}`}>{rotuloSituacao(obra.situacao)}</span><small>Código {obra.codigo || 'não informado'}</small></div>
          {Number.isFinite(obra.distancia) && <div className="distance">A aproximadamente {obra.distancia < 1 ? `${Math.round(obra.distancia * 1000)} m` : `${obra.distancia.toFixed(1).replace('.', ',')} km`} do endereço buscado</div>}
          <h3>{titulo(obra.descricao)}</h3>
          <p className="address"><b>{titulo(obra.logradouro || 'Endereço não informado')}</b><span>Blumenau, SC</span></p>
          <dl><div><dt>Tipo</dt><dd>{obra.intervencao || 'Não informado'}</dd></div><div><dt>Responsável</dt><dd>{obra.secretaria || 'Não informado'}</dd></div></dl>
          <details className="fiscaliza"><summary>Como fiscalizar esta obra</summary><div><strong>{orientacao.titulo}</strong><p>{orientacao.texto}</p><small>No EngeGOV, procure pelo código <b>{obra.codigo}</b> para ver contrato, valores, medições, prazos, empresa, aditivos e fotos.</small></div></details>
          <button className="detailsButton" type="button" onClick={() => abrirDetalhes(obra.codigo)}>{carregandoDetalhes === obra.codigo ? 'Consultando EngeGOV...' : obraAberta === obra.codigo ? 'Ocultar contrato e andamento' : 'Ver contrato e andamento'}</button>
          {obraAberta === obra.codigo && <section className="officialDetails" aria-live="polite">
            {carregandoDetalhes === obra.codigo && <p>Buscando os dados mais recentes no portal oficial...</p>}
            {erroDetalhes && <p className="detailsError">{erroDetalhes}</p>}
            {detalhes[obra.codigo] && <>
              <div className="progressTitle"><span>Execução publicada</span><b>{detalhes[obra.codigo].percentualExecutado || '0'}%</b></div>
              <div className="progressTrack"><i style={{ width: `${Math.min(Number(String(detalhes[obra.codigo].percentualExecutado).replace(',', '.')) || 0, 100)}%` }}/></div>
              <div className="moneyGrid"><div><small>Valor contratado</small><b>R$ {detalhes[obra.codigo].valorContratado || 'Não informado'}</b></div><div><small>Valor medido</small><b>R$ {detalhes[obra.codigo].valorExecutado || 'Não informado'}</b></div><div><small>Saldo do contrato</small><b>R$ {detalhes[obra.codigo].saldoContrato || 'Não informado'}</b></div></div>
              <h4>Empresa e contrato</h4><div className="contractGrid"><div><small>Empresa</small><b>{detalhes[obra.codigo].empresa || 'Não informada'}</b></div><div><small>CNPJ</small><b>{detalhes[obra.codigo].cnpj || 'Não informado'}</b></div><div><small>Contrato</small><b>{detalhes[obra.codigo].contrato || 'Não informado'}</b></div><div><small>Licitação</small><b>{detalhes[obra.codigo].licitacao || 'Não informada'}</b></div><div><small>Início da obra</small><b>{detalhes[obra.codigo].inicioObra || 'Não informado'}</b></div><div><small>Limite de execução</small><b>{detalhes[obra.codigo].dataLimiteExecucao || 'Não informado'}</b></div><div><small>Término do contrato</small><b>{detalhes[obra.codigo].terminoContrato || 'Não informado'}</b></div><div><small>Ordem de serviço</small><b>{detalhes[obra.codigo].ordemServico || 'Não informada'}</b></div></div>
              <div className="resource"><small>Origem do recurso</small><b>{detalhes[obra.codigo].tipoRecurso || 'Não informada'}</b></div>
              {detalhes[obra.codigo].medicoes?.length > 0 && <><h4>Medições publicadas</h4>{detalhes[obra.codigo].medicoes.map((medicao) => <div className="measurement" key={medicao.numero}><b>Medição {medicao.numero}</b><span>{medicao.data}</span><span>{medicao.percentual} · R$ {medicao.valor}</span></div>)}</>}
              <small className="detailSource">Consulta realizada no EngeGOV. Confirme documentos, aditivos, paralisações, etapas e fotos na fonte oficial.</small>
            </>}
          </section>}
          <footer><a href={linkMapa(obra)} target="_blank" rel="noreferrer">Ver no mapa</a><a href={dados.fonte} target="_blank" rel="noreferrer">Abrir EngeGOV ↗</a></footer>
        </article>;
      })}</div><nav className="pagination" aria-label="Paginação"><button type="button" disabled={pagina === 1} onClick={() => setPagina((atual) => atual - 1)}>← Anterior</button><span>Página <b>{pagina}</b> de {totalPaginas}</span><button type="button" disabled={pagina === totalPaginas} onClick={() => setPagina((atual) => atual + 1)}>Próxima →</button></nav></> : <div className="empty"><b>Nenhuma obra encontrada</b><p>Não há obra publicada nesse raio com os filtros selecionados.</p><button type="button" onClick={limparFiltros}>Limpar busca</button></div>}
    </section>
    <section className="citizenGuide"><div><h2>Fiscalizar pode ser simples</h2><div><article><b>1. Localize</b><p>Pesquise uma rua e veja primeiro as obras realmente mais próximas.</p></article><article><b>2. Observe</b><p>Compare a situação publicada com o que você vê no local.</p></article><article><b>3. Confira</b><p>Use o código para consultar contrato, valores, prazos, medições e fotos no EngeGOV.</p></article></div></div></section>
    <section className="about" id="fonte"><div><h2>De onde vêm essas informações?</h2><p>Os registros e as coordenadas das obras são publicados pela Prefeitura de Blumenau no EngeGOV. A localização do endereço pesquisado usa dados do OpenStreetMap; a distância é aproximada, em linha reta.</p><p><b>Importante:</b> consulte o portal oficial para documentos e informações detalhadas.</p><a href={dados.fonte} target="_blank" rel="noreferrer">Acessar a fonte oficial ↗</a></div></section>
    <footer className="footer"><b>Fiscaliza BNU</b><p>Informação pública em linguagem simples para fortalecer a participação cidadã.</p></footer>
  </main>;
}
