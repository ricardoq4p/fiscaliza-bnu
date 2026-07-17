'use client';

import { useEffect, useMemo, useState } from 'react';
import WorksMap from './components/WorksMap';

const POR_PAGINA = 12;
const RAIO_PADRAO_KM = 5;
const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titulo = (texto = '') => texto.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => `${espaco}${letra.toLocaleUpperCase('pt-BR')}`);
const rotuloSituacao = (situacao) => situacao ? titulo(situacao) : 'Não informada';
const dataBrTimestamp = (valor) => {
  const partes = String(valor || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return partes ? Date.UTC(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1])) : null;
};
const obraNoPeriodo = (obra, campoData, dataDe, dataAte) => {
  if (!dataDe && !dataAte) return true;
  const inicioSelecionado = dataDe ? Date.parse(`${dataDe}T00:00:00Z`) : -Infinity;
  const fimSelecionado = dataAte ? Date.parse(`${dataAte}T23:59:59Z`) : Infinity;
  if (inicioSelecionado > fimSelecionado) return false;
  if (campoData === 'periodoExecucao') {
    const inicioObra = dataBrTimestamp(obra.inicioObra) ?? dataBrTimestamp(obra.dataContrato);
    const fimObra = dataBrTimestamp(obra.terminoContrato) ?? dataBrTimestamp(obra.dataLimiteExecucao) ?? inicioObra;
    return inicioObra !== null && fimObra !== null && inicioObra <= fimSelecionado && fimObra >= inicioSelecionado;
  }
  const dataObra = dataBrTimestamp(obra[campoData]);
  return dataObra !== null && dataObra >= inicioSelecionado && dataObra <= fimSelecionado;
};
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

export default function HomeClient({ dados }) {
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');
  const [local, setLocal] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [situacao, setSituacao] = useState('Todas');
  const [secretaria, setSecretaria] = useState('Todas');
  const [raio, setRaio] = useState(String(RAIO_PADRAO_KM));
  const [campoData, setCampoData] = useState('inicioObra');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [pagina, setPagina] = useState(1);
  const [detalhes, setDetalhes] = useState({});
  const [obraAberta, setObraAberta] = useState(null);
  const [mapaAberto, setMapaAberto] = useState(null);
  const [mapaMaximizado, setMapaMaximizado] = useState(false);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(null);
  const [erroDetalhes, setErroDetalhes] = useState('');
  const [perguntaAnalise, setPerguntaAnalise] = useState('');
  const [analise, setAnalise] = useState(null);
  const [carregandoAnalise, setCarregandoAnalise] = useState(false);
  const [erroAnalise, setErroAnalise] = useState('');

  const situacoes = useMemo(() => [...new Set(dados.obras.map((obra) => obra.situacao).filter(Boolean))].sort(), [dados.obras]);
  const secretarias = useMemo(() => [...new Set(dados.obras.map((obra) => obra.secretaria).filter(Boolean))].sort(), [dados.obras]);
  const obrasDoPeriodo = useMemo(() => dados.obras.filter((obra) => obraNoPeriodo(obra, campoData, dataDe, dataAte)), [campoData, dados.obras, dataAte, dataDe]);
  const contagens = useMemo(() => obrasDoPeriodo.reduce((acc, obra) => {
    acc[obra.situacao || 'NÃO INFORMADA'] = (acc[obra.situacao || 'NÃO INFORMADA'] || 0) + 1;
    return acc;
  }, {}), [obrasDoPeriodo]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    let resultado = dados.obras.map((obra) => ({ ...obra }));
    if (raio === 'todas') {
      resultado = resultado.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
    } else if (local) {
      const limiteKm = Number(raio);
      resultado = resultado
        .filter((obra) => Number.isFinite(obra.latitude) && Number.isFinite(obra.longitude))
        .map((obra) => ({ ...obra, distancia: distanciaKm(local, obra) }))
        .filter((obra) => obra.distancia <= limiteKm)
        .sort((a, b) => a.distancia - b.distancia);
    } else if (termo) {
      resultado = resultado.filter((obra) => normalizar(`${obra.codigo} ${obra.descricao} ${obra.logradouro} ${obra.secretaria} ${obra.intervencao} ${obra.situacao}`).includes(termo));
    }
    resultado = resultado.filter((obra) => (situacao === 'Todas' || obra.situacao === situacao) && (secretaria === 'Todas' || obra.secretaria === secretaria));
    return resultado.filter((obra) => obraNoPeriodo(obra, campoData, dataDe, dataAte));
  }, [busca, campoData, dados.obras, dataAte, dataDe, local, raio, situacao, secretaria]);

  useEffect(() => setPagina(1), [busca, campoData, dataAte, dataDe, local, raio, situacao, secretaria]);

  useEffect(() => {
    if (!mapaAberto) return undefined;
    const fecharComEscape = (event) => { if (event.key === 'Escape') setMapaAberto(null); };
    document.addEventListener('keydown', fecharComEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', fecharComEscape);
      document.body.style.overflow = '';
    };
  }, [mapaAberto]);

  async function pesquisar(event) {
    event.preventDefault();
    const termo = digitado.trim();
    if (termo.length < 3) { setMensagem('Digite uma rua, bairro ou o código completo da obra.'); return; }
    if (/^(?:\d+|C\d+)$/i.test(termo)) {
      setLocal(null); setBusca(termo); setMensagem(`Resultado para o código de obra ${termo}.`);
      document.getElementById('obras')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setCarregando(true); setMensagem(''); setLocal(null); setBusca(termo);
    try {
      const response = await fetch(`/api/geocodificar?q=${encodeURIComponent(termo)}`);
      const resultado = await response.json();
      if (resultado.encontrado) {
        setLocal({ latitude: resultado.latitude, longitude: resultado.longitude, nome: `${resultado.nome}${resultado.bairro ? `, ${resultado.bairro}` : ''}` });
        setMensagem('');
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

  async function gerarPdfContrato(obra, detalhe) {
    const { jsPDF } = await import('jspdf');
    const documento = new jsPDF({ unit: 'mm', format: 'a4' });
    const margem = 18;
    const largura = 210 - margem * 2;
    let y = 20;

    const novaPaginaSeNecessario = (altura = 12) => {
      if (y + altura <= 278) return;
      documento.addPage();
      y = 20;
    };
    const adicionarCampo = (rotulo, valor) => {
      novaPaginaSeNecessario(16);
      documento.setFont('helvetica', 'bold');
      documento.setFontSize(9);
      documento.setTextColor(8, 122, 101);
      documento.text(rotulo.toUpperCase(), margem, y);
      y += 5;
      documento.setFont('helvetica', 'normal');
      documento.setFontSize(11);
      documento.setTextColor(21, 38, 59);
      const linhas = documento.splitTextToSize(String(valor || 'Não informado'), largura);
      documento.text(linhas, margem, y);
      y += linhas.length * 5 + 5;
    };

    documento.setFillColor(8, 122, 101);
    documento.rect(0, 0, 210, 8, 'F');
    documento.setFont('helvetica', 'bold');
    documento.setFontSize(20);
    documento.setTextColor(21, 38, 59);
    documento.text('Fiscaliza BNU', margem, y);
    y += 9;
    documento.setFontSize(14);
    const descricao = documento.splitTextToSize(titulo(obra.descricao), largura);
    documento.text(descricao, margem, y);
    y += descricao.length * 6 + 5;
    documento.setDrawColor(223, 231, 237);
    documento.line(margem, y, 210 - margem, y);
    y += 8;

    adicionarCampo('Código da obra', obra.codigo);
    adicionarCampo('Situação', rotuloSituacao(obra.situacao));
    adicionarCampo('Endereço', `${titulo(obra.logradouro || 'Não informado')} — Blumenau, SC`);
    adicionarCampo('Órgão responsável', obra.secretaria);
    adicionarCampo('Tipo de intervenção', obra.intervencao);
    adicionarCampo('Execução publicada', `${detalhe.percentualExecutado || '0'}%`);
    adicionarCampo('Valor contratado', `R$ ${detalhe.valorContratado || 'Não informado'}`);
    adicionarCampo('Valor medido', `R$ ${detalhe.valorExecutado || 'Não informado'}`);
    adicionarCampo('Saldo do contrato', `R$ ${detalhe.saldoContrato || 'Não informado'}`);
    adicionarCampo('Empresa', detalhe.empresa);
    adicionarCampo('CNPJ', detalhe.cnpj);
    adicionarCampo('Contrato', detalhe.contrato);
    adicionarCampo('Licitação', detalhe.licitacao);
    adicionarCampo('Início da obra', detalhe.inicioObra);
    adicionarCampo('Limite de execução', detalhe.dataLimiteExecucao);
    adicionarCampo('Término do contrato', detalhe.terminoContrato);
    adicionarCampo('Ordem de serviço', detalhe.ordemServico);
    adicionarCampo('Origem do recurso', detalhe.tipoRecurso);

    if (detalhe.medicoes?.length) {
      novaPaginaSeNecessario(18);
      documento.setFont('helvetica', 'bold');
      documento.setFontSize(13);
      documento.text('Medições publicadas', margem, y);
      y += 8;
      detalhe.medicoes.forEach((medicao) => {
        adicionarCampo(`Medição ${medicao.numero}`, `${medicao.data || 'Data não informada'} · ${medicao.percentual || 'Percentual não informado'} · R$ ${medicao.valor || 'Valor não informado'}`);
      });
    }

    novaPaginaSeNecessario(24);
    documento.setDrawColor(223, 231, 237);
    documento.line(margem, y, 210 - margem, y);
    y += 6;
    documento.setFont('helvetica', 'normal');
    documento.setFontSize(8);
    documento.setTextColor(96, 113, 128);
    const aviso = documento.splitTextToSize('Documento informativo gerado pelo Fiscaliza BNU com dados consultados no EngeGOV. Confirme contratos, aditivos, prazos, medições e demais documentos na fonte oficial.', largura);
    documento.text(aviso, margem, y);
    documento.save(`fiscaliza-bnu-obra-${obra.codigo}.pdf`);
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

  const limparFiltros = () => { setDigitado(''); setBusca(''); setLocal(null); setMensagem(''); setSituacao('Todas'); setSecretaria('Todas'); setRaio(String(RAIO_PADRAO_KM)); setCampoData('inicioObra'); setDataDe(''); setDataAte(''); };
  const verTodasAsObras = () => { setDigitado(''); setBusca(''); setLocal(null); setMensagem('Mostrando todas as obras publicadas em Blumenau.'); setRaio('todas'); };
  const filtrarPeloResumo = (novaSituacao) => {
    setDigitado(''); setBusca(''); setLocal(null); setMensagem(''); setSecretaria('Todas'); setRaio('todas'); setSituacao(novaSituacao);
    requestAnimationFrame(() => document.getElementById('obras')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const obrasDaPagina = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const sincronizadoEm = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(dados.sincronizadoEm));
  const descricaoBusca = local
    ? raio === 'todas'
      ? 'Mostrando todas as obras publicadas em Blumenau.'
      : `Mostrando obras em um raio de ${raio} km de ${local.nome}.`
    : mensagem || 'Pesquise pelo endereço e refine por situação, órgão responsável ou área da busca.';
  const periodoAtivo = Boolean(dataDe || dataAte);
  const periodoInvalido = Boolean(dataDe && dataAte && dataDe > dataAte);
  const rotulosData = { dataContrato: 'data do contrato', inicioObra: 'início da obra', dataLimiteExecucao: 'limite de execução', terminoContrato: 'término do contrato', periodoExecucao: 'período de execução' };
  const coberturaDatas = dados.obras.filter((obra) => campoData === 'periodoExecucao' ? obra.inicioObra || obra.dataContrato : obra[campoData]).length;
  const linkMapa = (obra) => `https://www.openstreetmap.org/?mlat=${obra.latitude}&mlon=${obra.longitude}#map=18/${obra.latitude}/${obra.longitude}`;
  const mapaIncorporado = (obra) => {
    const margem = 0.004;
    const bbox = [obra.longitude - margem, obra.latitude - margem, obra.longitude + margem, obra.latitude + margem].join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${obra.latitude},${obra.longitude}`;
  };

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
      <div className="summaryHead"><div><h2>Resumo das obras</h2><p>{periodoAtivo ? 'Indicadores calculados para o período selecionado.' : 'Selecione um período para recalcular os indicadores.'}</p></div></div>
      <div className="periodFilters summaryPeriod" aria-label="Período dos indicadores"><label>Data considerada<select value={campoData} onChange={(event) => setCampoData(event.target.value)}><option value="inicioObra">Início da obra</option><option value="dataContrato">Data do contrato</option><option value="dataLimiteExecucao">Limite de execução</option><option value="terminoContrato">Término do contrato</option><option value="periodoExecucao">Período de execução</option></select></label><label>De<input type="date" value={dataDe} onChange={(event) => setDataDe(event.target.value)} /></label><label>Até<input type="date" value={dataAte} onChange={(event) => setDataAte(event.target.value)} /></label>{periodoAtivo && <button type="button" onClick={() => { setDataDe(''); setDataAte(''); }}>Limpar período</button>}<small className={periodoInvalido ? 'periodError' : ''}>{periodoInvalido ? 'A data inicial deve ser anterior à data final.' : `${coberturaDatas} de ${dados.total} obras possuem ${rotulosData[campoData]}.`}</small></div>
      <div className="cards" aria-label="Atalhos por situação"><button type="button" className={situacao === 'Todas' ? 'active' : ''} aria-pressed={situacao === 'Todas'} onClick={() => filtrarPeloResumo('Todas')}><small>TODAS AS OBRAS</small><b>{obrasDoPeriodo.length}</b><span>{periodoAtivo ? 'Registros no período' : 'Ver todos os registros'}</span></button><button type="button" className={situacao === 'EM ANDAMENTO' ? 'active' : ''} aria-pressed={situacao === 'EM ANDAMENTO'} onClick={() => filtrarPeloResumo('EM ANDAMENTO')}><small>EM ANDAMENTO</small><b>{contagens['EM ANDAMENTO'] || 0}</b><span>Filtrar obras ativas</span></button><button type="button" className={situacao === 'CONCLUÍDA' ? 'active' : ''} aria-pressed={situacao === 'CONCLUÍDA'} onClick={() => filtrarPeloResumo('CONCLUÍDA')}><small>CONCLUÍDAS</small><b>{contagens['CONCLUÍDA'] || 0}</b><span>Filtrar obras finalizadas</span></button><button type="button" className={`warn ${situacao === 'PARALISADA' ? 'active' : ''}`} aria-pressed={situacao === 'PARALISADA'} onClick={() => filtrarPeloResumo('PARALISADA')}><small>PARALISADAS</small><b>{contagens.PARALISADA || 0}</b><span>Filtrar obras que precisam de atenção</span></button></div>
      <div className="sectionTitle"><div><h2>{local && raio !== 'todas' ? 'Obras próximas ao endereço' : 'Encontre uma obra'}</h2><p>{descricaoBusca}</p></div></div>
      <div className="filters" aria-label="Filtros de obras"><label>Situação<select value={situacao} onChange={(event) => setSituacao(event.target.value)}><option>Todas</option>{situacoes.map((item) => <option key={item} value={item}>{rotuloSituacao(item)}</option>)}</select></label><label>Órgão responsável<select value={secretaria} onChange={(event) => setSecretaria(event.target.value)}><option>Todas</option>{secretarias.map((item) => <option key={item}>{item}</option>)}</select></label><label>Área da busca<select value={raio} onChange={(event) => setRaio(event.target.value)}><option value="1">Até 1 km</option><option value="5">Até 5 km</option><option value="10">Até 10 km</option><option value="todas">Toda Blumenau</option></select></label><button className="clear" type="button" onClick={limparFiltros}>Limpar busca</button><strong className="resultCount">{filtradas.length} {filtradas.length === 1 ? 'obra encontrada' : 'obras encontradas'}</strong></div>

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
              <button className="pdfButton" type="button" onClick={() => gerarPdfContrato(obra, detalhes[obra.codigo])}>Gerar PDF deste contrato</button>
            </>}
          </section>}
          <footer><button className="mapLink" type="button" onClick={() => { setMapaAberto(obra); setMapaMaximizado(false); }}>Ver no mapa</button><a href={dados.fonte} target="_blank" rel="noreferrer">Abrir EngeGOV ↗</a></footer>
        </article>;
      })}</div><nav className="pagination" aria-label="Paginação"><button type="button" disabled={pagina === 1} onClick={() => setPagina((atual) => atual - 1)}>← Anterior</button><span>Página <b>{pagina}</b> de {totalPaginas}</span><button type="button" disabled={pagina === totalPaginas} onClick={() => setPagina((atual) => atual + 1)}>Próxima →</button></nav></> : <div className="empty"><b>Nenhuma obra encontrada</b><p>Não há obra publicada com os filtros selecionados.</p><div className="emptyActions"><button type="button" onClick={limparFiltros}>Limpar busca</button><button type="button" onClick={verTodasAsObras}>Ver todas as {dados.total} obras</button></div></div>}
    </section>
    <section className="citizenGuide"><div><h2>Fiscalizar pode ser simples</h2><div><article><b>1. Localize</b><p>Pesquise uma rua e veja primeiro as obras realmente mais próximas.</p></article><article><b>2. Observe</b><p>Compare a situação publicada com o que você vê no local.</p></article><article><b>3. Confira</b><p>Use o código para consultar contrato, valores, prazos, medições e fotos no EngeGOV.</p></article></div></div></section>
    <section className="about" id="fonte"><div><h2>De onde vêm essas informações?</h2><p>Os registros e as coordenadas das obras são publicados pela Prefeitura de Blumenau no EngeGOV. A localização do endereço pesquisado usa dados do OpenStreetMap; a distância é aproximada, em linha reta.</p><p><b>Importante:</b> consulte o portal oficial para documentos e informações detalhadas.</p><a href={dados.fonte} target="_blank" rel="noreferrer">Acessar a fonte oficial ↗</a></div></section>
    <section className="mapSection" id="mapa-obras"><div className="mapSectionIntro"><span>VISÃO POR TERRITÓRIO</span><h2>Localização<br/>real das<br/>obras</h2><p>Filtre o mapa por situação, secretaria ou tipo de estabelecimento. Use o zoom, mova o mapa e clique em um ícone para abrir os detalhes.</p><div className="mapIntroLegend"><span><i className="andamento">↗</i>Em andamento</span><span><i className="concluida">✓</i>Concluída</span><span><i className="paralisada">×</i>Paralisada</span></div><a href="#obras">Alterar filtros da consulta →</a></div><WorksMap works={dados.obras} sourceUrl={dados.fonte}/></section>
    {mapaAberto && <div className="mapModalBackdrop" role="presentation" onMouseDown={() => setMapaAberto(null)}>
      <section className={`mapModal ${mapaMaximizado ? 'maximized' : ''}`} role="dialog" aria-modal="true" aria-labelledby="mapa-titulo" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>LOCALIZAÇÃO DA OBRA</small><h2 id="mapa-titulo">{titulo(mapaAberto.logradouro || mapaAberto.descricao)}</h2></div><div className="mapModalActions"><button type="button" aria-label={mapaMaximizado ? 'Restaurar tamanho do mapa' : 'Maximizar mapa'} title={mapaMaximizado ? 'Restaurar' : 'Maximizar'} onClick={() => setMapaMaximizado((atual) => !atual)}>{mapaMaximizado ? '❐' : '⛶'}</button><button type="button" aria-label="Fechar mapa" title="Fechar" onClick={() => setMapaAberto(null)}>×</button></div></header>
        <iframe title={`Mapa da obra ${mapaAberto.codigo}`} src={mapaIncorporado(mapaAberto)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <footer><span>Código {mapaAberto.codigo}</span><a href={linkMapa(mapaAberto)} target="_blank" rel="noreferrer">Abrir mapa completo ↗</a></footer>
      </section>
    </div>}
    <footer className="footer"><b>Fiscaliza BNU</b><p>Informação pública em linguagem simples para fortalecer a participação cidadã.</p></footer>
  </main>;
}


