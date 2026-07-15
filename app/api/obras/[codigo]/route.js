import { NextResponse } from 'next/server';
import https from 'node:https';
import { getObraByCodigo } from '../../../../lib/obras-data';

const PORTAL = 'https://engegov.blumenau.sc.gov.br/portal-engegov/dashboard.xhtml?cidade=4898';
const cache = new Map();
const TTL = 60 * 60 * 1000;

function requestPortal(url, { method = 'GET', body = null, headers = {} } = {}) {
  const target = new URL(url);
  if (target.hostname !== 'engegov.blumenau.sc.gov.br') throw new Error('Destino não permitido.');
  return new Promise((resolve, reject) => {
    const request = https.request(target, { method, headers, rejectUnauthorized: false }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if ((response.statusCode || 500) >= 400) return reject(new Error(`EngeGOV respondeu ${response.statusCode}`));
        resolve({ text: Buffer.concat(chunks).toString('utf8'), headers: response.headers });
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function plainText(xml) {
  return decodeEntities(xml)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\]\]>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function valueBetween(text, start, end) {
  const expression = new RegExp(`${start}\\s*(.*?)\\s*${end}`);
  return text.match(expression)?.[1]?.trim() || null;
}

function parseDetails(xml, codigo) {
  const text = plainText(xml);
  const money = (label) => text.match(new RegExp(`${label}\\s*R\\$\\s*([\\d.,]+)`))?.[1] || null;
  const measurements = [...text.matchAll(/NÚMERO DA MEDIÇÃO:\s*(\S+)\s*Percentual Medido:\s*([\d,.]+%)\s*Valor Medido:\s*R\$\s*([\d.,]+)\s*DATA DA MEDIÇÃO:\s*([\d/]+)\s*Percentual Acumulado:\s*([\d,.]+%)\s*Valor Acumulado:\s*R\$\s*([\d.,]+)/g)].map((match) => ({
    numero: match[1], percentual: match[2], valor: match[3], data: match[4], percentualAcumulado: match[5], valorAcumulado: match[6]
  }));
  return {
    codigo,
    percentualExecutado: xml.match(/class="knob"[^>]*data-min/)?.[0]?.match(/value="([\d,.]+)"/)?.[1] || xml.match(/class="knob"[^>]*value="([\d,.]+)"/)?.[1] || xml.match(/disabled="disabled" value="([\d,.]+)"[^>]*class="knob"/)?.[1] || null,
    valorContratado: money('Valor Total Contratado'),
    valorExecutado: money('Valor Executado \\(Medido\\)'),
    saldoContrato: money('Saldo do Contrato'),
    empresa: valueBetween(text, 'Empresa:', 'CNPJ:'),
    cnpj: valueBetween(text, 'CNPJ:', 'Dados da contratação'),
    licitacao: valueBetween(text, 'Número da licitação:', 'Número do Contrato:'),
    contrato: valueBetween(text, 'Número do Contrato:', 'Data do Contrato:'),
    dataContrato: valueBetween(text, 'Data do Contrato:', 'Nº Ordem de Serviço:'),
    ordemServico: valueBetween(text, 'Nº Ordem de Serviço:', 'Valor Total Contratado:'),
    inicioObra: valueBetween(text, 'Início da obra:', 'Data Limite Execução:'),
    dataLimiteExecucao: valueBetween(text, 'Data Limite Execução:', 'Término Contrato:'),
    terminoContrato: valueBetween(text, 'Término Contrato:', 'Tipo de Recurso:'),
    tipoRecurso: valueBetween(text, 'Tipo de Recurso:', 'Local da obra'),
    medicoes: measurements,
    consultadoEm: new Date().toISOString(),
    fonte: PORTAL
  };
}

async function fetchDetails(codigo) {
  const initial = await requestPortal(PORTAL, { headers: { 'User-Agent': 'FiscalizaBNU/1.0' } });
  const html = initial.text;
  const viewState = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/)?.[1];
  const form = html.match(/<form id="frmListaObras"[\s\S]*?<\/form>/)?.[0];
  const action = form?.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!viewState || !action) throw new Error('Estrutura JSF não reconhecida.');
  const cookie = initial.headers['set-cookie']?.map((item) => item.split(';')[0]).join('; ');
  const body = new URLSearchParams({
    'javax.faces.partial.ajax': 'true',
    'javax.faces.source': 'frmListaObras:tblListaObras',
    'javax.faces.partial.execute': 'frmListaObras:tblListaObras',
    'javax.faces.partial.render': 'frmAndamentoObra frmDadosContratoObra frmDadosMedicoesObra frmInfObraEmRevisao',
    'javax.faces.behavior.event': 'rowSelect',
    'javax.faces.partial.event': 'rowSelect',
    frmListaObras: 'frmListaObras',
    'frmListaObras:tblListaObras_selection': codigo,
    'javax.faces.ViewState': viewState
  });
  const encodedBody = body.toString();
  const response = await requestPortal(new URL(action, PORTAL), {
    method: 'POST', body: encodedBody,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Content-Length': Buffer.byteLength(encodedBody), 'Faces-Request': 'partial/ajax', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'FiscalizaBNU/1.0', ...(cookie ? { Cookie: cookie } : {}) }
  });
  return parseDetails(response.text, codigo);
}

export async function GET(_request, context) {
  const { codigo } = await context.params;
  const obra = /^(?:\d+|C\d+)$/i.test(codigo) ? await getObraByCodigo(codigo) : null;
  if (!obra) return NextResponse.json({ erro: 'Obra não encontrada.' }, { status: 404 });
  const codigoOficial = obra.codigo;
  const cached = cache.get(codigoOficial);
  if (cached && Date.now() - cached.time < TTL) return NextResponse.json(cached.data);
  try {
    const data = await fetchDetails(codigoOficial);
    cache.set(codigoOficial, { time: Date.now(), data });
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Falha ao consultar detalhes da obra ${codigoOficial}:`, error);
    return NextResponse.json({ erro: 'Os detalhes do EngeGOV estão temporariamente indisponíveis.' }, { status: 502 });
  }
}
