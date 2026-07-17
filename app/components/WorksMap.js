'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const CORES = { 'EM ANDAMENTO': '#087a65', 'CONCLUÍDA': '#246b9c', PARALISADA: '#d97706' };
const escaparHtml = (valor = '') => String(valor).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const titulo = (texto = '') => texto.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => `${espaco}${letra.toLocaleUpperCase('pt-BR')}`);
const rotuloSituacao = (situacao) => titulo(situacao || 'Não informada');

export default function WorksMap({ works, sourceUrl }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [status, setStatus] = useState('Todas');
  const [secretaria, setSecretaria] = useState('Todas');
  const [fullscreen, setFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const geolocalizadas = useMemo(() => works.filter((obra) => Number.isFinite(obra.latitude) && Number.isFinite(obra.longitude)), [works]);
  const secretarias = useMemo(() => [...new Set(geolocalizadas.map((obra) => obra.secretaria).filter(Boolean))].sort(), [geolocalizadas]);
  const visiveis = useMemo(() => geolocalizadas.filter((obra) => (status === 'Todas' || obra.situacao === status) && (secretaria === 'Todas' || obra.secretaria === secretaria)), [geolocalizadas, secretaria, status]);

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
      const cor = CORES[obra.situacao] || '#64748b';
      const marcador = L.marker([obra.latitude, obra.longitude], { icon: L.divIcon({ className: 'obraMapMarkerWrapper', html: `<span class="obraMapMarker" style="--marker-color:${cor}"><i></i></span>`, iconSize: [28, 36], iconAnchor: [14, 34], popupAnchor: [0, -31] }) });
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
    <div className="worksMapToolbar"><div><b>{visiveis.length} obras no mapa</b><span>{geolocalizadas.length} registros possuem coordenadas publicadas</span></div><label>Situação<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todas</option><option value="EM ANDAMENTO">Em andamento</option><option value="CONCLUÍDA">Concluídas</option><option value="PARALISADA">Paralisadas</option></select></label><label>Órgão responsável<select value={secretaria} onChange={(event) => setSecretaria(event.target.value)}><option>Todas</option>{secretarias.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={() => setFullscreen((atual) => !atual)}>{fullscreen ? 'Sair da tela cheia' : 'Ampliar mapa'}</button></div>
    <div ref={mapNodeRef} className="worksMapCanvas" aria-label="Mapa interativo das obras públicas de Blumenau" />
    <div className="worksMapLegend" aria-label="Legenda do mapa"><span><i className="andamento"/>Em andamento</span><span><i className="concluida"/>Concluída</span><span><i className="paralisada"/>Paralisada</span></div>
  </div>;
}
