import dados from '../../../data/obras.json';
import detalhes from '../../../data/detalhes-obras.json';

export const runtime = 'nodejs';

const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const palavrasNumero = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12
};
const rotulos = {
  'EM ANDAMENTO': 'Em andamento',
  'CONCLUÍDA': 'Concluídas',
  PARALISADA: 'Paralisadas',
  'NÃO INFORMADA': 'Sem situação informada'
};

function contagemPor(campo) {
  return Object.entries(dados.obras.reduce((acc, obra) => {
    const valor = obra[campo] || 'NÃO INFORMADA';
    acc[valor] = (acc[valor] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
}

function numeroMoeda(valor) {
  if (!valor) return null;
  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function anoData(valor) {
  return String(valor || '').match(/\d{2}\/\d{2}\/(\d{4})/)?.[1] || null;
}

function dataOrdenavel(valor) {
  const partes = String(valor || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : null;
}

function dataBrasilParaDate(valor) {
  const partes = String(valor || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!partes) return null;
  const data = new Date(Date.UTC(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1])));
  return Number.isNaN(data.getTime()) ? null : data;
}

function formatarDataBrasil(data) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(data);
}

function extrairPeriodo(pergunta) {
  const texto = normalizar(pergunta);
  const matchMeses = texto.match(/ultim(?:o|os|a|as)\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+mes(?:es)?/);
  if (matchMeses) {
    const bruto = matchMeses[1];
    const meses = Number(bruto) || palavrasNumero[bruto] || null;
    if (meses) return { meses, rotulo: `últimos ${meses} meses` };
  }

  if (/ultim(?:o|os|a|as)\s+ano/.test(texto)) {
    return { meses: 12, rotulo: 'últimos 12 meses' };
  }

  if (/ultim(?:o|os|a|as)\s+semestre/.test(texto)) {
    return { meses: 6, rotulo: 'últimos 6 meses' };
  }

  return null;
}

function obraDentroDoPeriodo(obra, periodo, referencia) {
  if (!periodo) return true;
  const dataBase = dataBrasilParaDate(obra.inicioObra) || dataBrasilParaDate(obra.dataContrato);
  if (!dataBase) return false;
  const inicioJanela = new Date(Date.UTC(
    referencia.getUTCFullYear(),
    referencia.getUTCMonth() - periodo.meses,
    referencia.getUTCDate()
  ));
  return dataBase >= inicioJanela && dataBase <= referencia;
}

function resumoContratos(situacoes, periodo) {
  const permitidas = new Set(situacoes);
  const cadastro = new Map(dados.obras.map((obra) => [obra.codigo, obra]));
  const referencia = dados.sincronizadoEm ? new Date(dados.sincronizadoEm) : new Date();
  const registros = Object.values(detalhes.obras || {}).filter((detalhe) => {
    const situacao = cadastro.get(detalhe.codigo)?.situacao || 'NÃO INFORMADA';
    return permitidas.has(situacao) && obraDentroDoPeriodo(detalhe, periodo, referencia);
  });
  const somar = (campo) => registros.reduce((total, obra) => total + (numeroMoeda(obra[campo]) || 0), 0);
  const porAno = registros.reduce((acc, obra) => {
    const ano = anoData(obra.inicioObra) || anoData(obra.dataContrato);
    if (ano) acc[ano] = (acc[ano] || 0) + 1;
    return acc;
  }, {});
  const inicios = registros.map((obra) => obra.inicioObra || obra.dataContrato).filter(dataOrdenavel).sort((a, b) => dataOrdenavel(a).localeCompare(dataOrdenavel(b)));
  const terminos = registros.map((obra) => obra.terminoContrato || obra.dataLimiteExecucao).filter(dataOrdenavel).sort((a, b) => dataOrdenavel(a).localeCompare(dataOrdenavel(b)));
  return {
    cobertura: registros.length,
    periodo: periodo ? {
      meses: periodo.meses,
      rotulo: periodo.rotulo,
      de: formatarDataBrasil(new Date(Date.UTC(
        referencia.getUTCFullYear(),
        referencia.getUTCMonth() - periodo.meses,
        referencia.getUTCDate()
      ))),
      ate: formatarDataBrasil(referencia)
    } : null,
    inicioMaisAntigo: inicios[0] || null,
    terminoMaisRecente: terminos.at(-1) || null,
    valorContratado: somar('valorContratado'),
    valorExecutado: somar('valorExecutado'),
    saldoContrato: somar('saldoContrato'),
    obrasPorAno: Object.entries(porAno).sort((a, b) => a[0].localeCompare(b[0])).map(([ano, quantidade]) => ({ ano, quantidade }))
  };
}

function selecionarSituacoes(pergunta, situacoes) {
  const texto = normalizar(pergunta);
  const citadas = situacoes.filter(([situacao]) => {
    if (situacao === 'EM ANDAMENTO') return /andamento|andando|ativa/.test(texto);
    if (situacao === 'CONCLUÍDA') return /concluid|finaliz|entregue/.test(texto);
    if (situacao === 'PARALISADA') return /paralis|parada|suspensa/.test(texto);
    return /sem situacao|nao informada/.test(texto);
  });
  return citadas.length ? citadas : situacoes;
}

function resumoLocal(cards, total) {
  const maior = [...cards].sort((a, b) => b.quantidade - a.quantidade)[0];
  const comparacao = cards.map((card) => `${card.rotulo.toLowerCase()}: ${card.quantidade} (${card.percentual}%)`).join('; ');
  return `Na base oficial consultada, ${comparacao}. ${maior.rotulo} é o maior grupo desta comparação, com ${maior.quantidade} de ${total} obras publicadas.`;
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resumoLocalComContratos(cards, total, contratos) {
  const base = resumoLocal(cards, total);
  if (!contratos.periodo) return base;
  return `${base} Para ${contratos.periodo.rotulo}, considerando obras com início ou contrato entre ${contratos.periodo.de} e ${contratos.periodo.ate}, a cobertura é de ${contratos.cobertura} obras, com valor contratado de R$ ${formatarMoeda(contratos.valorContratado)} e valor executado de R$ ${formatarMoeda(contratos.valorExecutado)}.`;
}

function extrairTexto(resposta) {
  if (typeof resposta.output_text === 'string') return resposta.output_text.trim();
  return resposta.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join('\n').trim();
}

async function explicarComIA(pergunta, fatos) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      max_output_tokens: 220,
      input: [
        { role: 'system', content: 'Você explica dados públicos de obras para cidadãos. Use somente os fatos fornecidos, não invente causas, prazos ou valores. Escreva um parágrafo curto, objetivo e em português do Brasil. Diferencie claramente contagem de interpretação. Quando houver um período em contratos.periodo, trate esse recorte temporal como referência principal da resposta.' },
        { role: 'user', content: JSON.stringify({ pergunta, fatos }) }
      ]
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`OpenAI respondeu com ${response.status}`);
  return extrairTexto(await response.json()) || null;
}

export async function POST(request) {
  try {
    const corpo = await request.json();
    const pergunta = String(corpo?.pergunta || '').trim().slice(0, 400);
    if (pergunta.length < 5) return Response.json({ erro: 'Escreva uma pergunta um pouco mais detalhada.' }, { status: 400 });

    const total = dados.obras.length;
    const todasSituacoes = contagemPor('situacao');
    const cards = selecionarSituacoes(pergunta, todasSituacoes).map(([situacao, quantidade]) => ({
      situacao,
      rotulo: rotulos[situacao] || situacao,
      quantidade,
      percentual: Number(((quantidade / total) * 100).toFixed(1))
    }));
    const secretarias = contagemPor('secretaria').slice(0, 5).map(([nome, quantidade]) => ({ nome, quantidade }));
    const tipos = contagemPor('intervencao').slice(0, 5).map(([nome, quantidade]) => ({ nome, quantidade }));
    const periodo = extrairPeriodo(pergunta);
    const contratos = resumoContratos(cards.map((card) => card.situacao), periodo);
    const fatos = { total, situacoes: cards, maioresSecretarias: secretarias, principaisTipos: tipos, contratos, periodo, sincronizadoEm: dados.sincronizadoEm };
    let resumo = resumoLocalComContratos(cards, total, contratos);
    let modo = 'análise automática';
    try {
      const textoIA = await explicarComIA(pergunta, fatos);
      if (textoIA) { resumo = textoIA; modo = 'IA + dados oficiais'; }
    } catch (error) {
      console.error('Falha opcional na explicação por IA:', error.message);
    }

    return Response.json({ titulo: 'Comparação solicitada', pergunta, resumo, modo, total, cards, secretarias, tipos, contratos, sincronizadoEm: dados.sincronizadoEm });
  } catch {
    return Response.json({ erro: 'Não foi possível analisar a solicitação.' }, { status: 400 });
  }
}
