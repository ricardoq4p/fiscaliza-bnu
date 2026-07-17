'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const STATUS = [
  { valor: 'Todas', rotulo: 'Todas', simbolo: '', classe: '' },
  { valor: 'EM ANDAMENTO', rotulo: 'Em andamento', simbolo: '↗', classe: 'andamento' },
  { valor: 'CONCLUÍDA', rotulo: 'Concluída', simbolo: '✓', classe: 'concluida' },
  { valor: 'PARALISADA', rotulo: 'Paralisada', simbolo: '×', classe: 'paralisada' }
];
const escaparHtml = (valor = '') => String(valor).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const titulo = (texto = '') => texto.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => `${espaco}${letra.toLocaleUpperCase('pt-BR')}`);
const rotuloSituacao = (situacao) => titulo(situacao || 'Não informada');
const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const categoria = (obra) => {
  const texto = normalizar(`${obra.descricao} ${obra.logradouro}`);
  if (/mercado|feira|comerc|abastecimento/.test(texto)) return 'Mercados e comércio';
  if (/escola|educa|creche|cei\b|ebm\b|quadra escolar|centro infantil/.test(texto)) return 'Escolas e educação';
  if (/saude|hospital|ambulator|ubs\b|esf\b|policlin|farmacia/.test(texto)) return 'Saúde';
  if (/parque|praca|esport|ginasio|campo|lazer|pista|ciclov/.test(texto)) return 'Lazer e esporte';
  if (/rua|ponte|passarela|viaduto|paviment|drenagem|calcada|sinaliza|terminal|corredor|ribeirao/.test(texto)) return 'Mobilidade e infraestrutura';
  if (/centro comunit|assistencia|cras\b|abrigo|habitacao/.test(texto)) return 'Atendimento social';
  if (/museu|teatro|cultura|turismo|biblioteca/.test(texto)) return 'Cultura e turismo';
  if (/sede|predio|administr|secretaria|arquivo publico/.test(texto)) return 'Prédios públicos';
  return 'Outros estabelecimentos';
};

export default function WorksMap({ works, sourceUrl }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [status, setStatus] = useState('Todas');
  const [secretaria, setSecretaria] = useState('Todas');
  const [tipo, setTipo] = useState('Todas');
  const [fullscreen, setFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const geolocalizadas = useMemo(() => works.filter((obra) => Number.isFinite(obra.latitude) && Number.isFinite(obra.longitude)), [works]);
  const secretarias = useMemo(() => [...new Set(geolocalizadas.map((obra) => obra.secretaria).filter(Boolean))].sort(), [geolocalizadas]);
  const categorias = useMemo(() => [...new Set(geolocalizadas.map(categoria))].sort(), [geolocalizadas]);
  const contagens = useMemo(() => geolocalizadas.reduce((total, obra) => ({ ...total, [obra.situacao]: (total[obra.situacao] || 0) + 1 }), {}), [geolocalizadas]);
  const visiveis = useMemo(() => geolocalizadas.filter((obra) => (status === 'Todas' || obra.situacao === status) && (secretaria === 'Todas' || obra.secretaria === secretaria) && (tipo === 'Todas' || categoria(obra) === tipo)), [geolocalizadas, secretaria, status, tipo]);

  useEffect(() => {
    let ativo = true;
    async function iniciarMapa() {
      if (!mapNodeRef.current || mapRef.current) return;
      const modulo = await import('leaflet');
      if (!ativo || !mapNodeRef.current) return;
      const L = modulo.default || modulo;
      leafletRef.current = L;
      const map = L.map(mapNodeRef.current, { scrollWheelZoom: false }).setView([-26.9187, -49.066], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    }
    iniciarMapa();
    return () => { ativo = false; mapRef.current?.remove(); mapRef.current = null; markersLayerRef.current = null; };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const limites = [];
    visiveis.forEach((obra) => {
      const configuracao = STATUS.find((item) => item.valor === obra.situacao) || { simbolo: '•', classe: 'outra' };
      const marcador = L.marker([obra.latitude, obra.longitude], { icon: L.divIcon({ className: `obraMapMarker obraMapMarker--${configuracao.classe}`, html: `<span>${configuracao.simbolo}</span>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -15] }) });
      const osmUrl = `https://www.openstreetmap.org/?mlat=${obra.latitude}&mlon=${obra.longitude}#map=18/${obra.latitude}/${obra.longitude}`;
      marcador.bindPopup(`<article class="obraMapPopup"><small>${escaparHtml(rotuloSituacao(obra.situacao))} · Código ${escaparHtml(obra.codigo)}</small><strong>${escaparHtml(titulo(obra.descricao))}</strong><span>${escaparHtml(titulo(obra.logradouro || 'Endereço não informado'))}</span><span>${escaparHtml(obra.secretaria || 'Órgão não informado')}</span><div><a href="${osmUrl}" target="_blank" rel="noreferrer">Abrir no mapa</a><a href="${escaparHtml(sourceUrl)}" target="_blank" rel="noreferrer">Ver no EngeGOV</a></div></article>`, { maxWidth: 310, minWidth: 240 });
      marcador.addTo(layer);
      limites.push([obra.latitude, obra.longitude]);
    });
    if (limites.length) map.fitBounds(limites, { padding: [28, 28], maxZoom: 15 });
  }, [mapReady, sourceUrl, visiveis]);

  useEffect(() => { const timeout = window.setTimeout(() => mapRef.current?.invalidateSize(), 120); return () => window.clearTimeout(timeout); }, [fullscreen]);
  useEffect(() => {
    if (!fullscreen) return undefined;
    const fechar = (event) => { if (event.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', fechar); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', fechar); document.body.style.overflow = ''; };
  }, [fullscreen]);

  return <div className={`worksMapShell ${fullscreen ? 'fullscreen' : ''}`}>
    <div className="worksMapToolbar">
      <div className="mapStatusButtons">{STATUS.map((item) => <button type="button" key={item.valor} className={status === item.valor ? 'active' : ''} onClick={() => setStatus(item.valor)}>{item.simbolo && <i className={item.classe}>{item.simbolo}</i>}<span>{item.rotulo}<small>{item.valor === 'Todas' ? geolocalizadas.length : contagens[item.valor] || 0}</small></span></button>)}</div>
      <div className="mapSelectFilters"><label><span>Secretaria</span><select value={secretaria} onChange={(event) => setSecretaria(event.target.value)}><option>Todas</option>{secretarias.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Tipo de estabelecimento</span><select value={tipo} onChange={(event) => setTipo(event.target.value)}><option>Todas</option>{categorias.map((item) => <option key={item}>{item}</option>)}</select><small>Categoria estimada pelo nome da obra.</small></label><button className="mapFullscreenButton" type="button" onClick={() => setFullscreen((atual) => !atual)}>⛶ {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button><button className="mapClearButton" type="button" onClick={() => { setStatus('Todas'); setSecretaria('Todas'); setTipo('Todas'); }}>Limpar filtros</button><strong>{visiveis.length} no mapa</strong></div>
    </div>
    <div ref={mapNodeRef} className="worksMapCanvas" aria-label="Mapa interativo das obras públicas de Blumenau" />
  </div>;
}
