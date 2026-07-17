import { getDetalhesDataset, getObrasDataset } from '../../../lib/obras-data';

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

function contagemPor(dados, campo) {
  return Object.entries(dados.obras.reduce((acc, obra) => {
    const valor = obra[campo] || 'NÃO INFORMADA';
    acc[valor] = (acc[valor] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
}

function numeroMoeda(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (!valor) return null;
  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function anoData(valor) {
  if (valor instanceof Date) return String(valor.getUTCFullYear());
  return String(valor || '').match(/\d{2}\/\d{2}\/(\d{4})/)?.[1] || null;
}

function dataOrdenavel(valor) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const partes = String(valor || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : null;
}

function dataBrasilParaDate(valor) {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const partes = String(valor || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!partes) return null;
  const data = new Date(Date.UTC(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1])));
  return Number.isNaN(data.getTime()) ? null : data;
}

function formatarDataBrasil(data) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(data);
}

function extrairPeriodo(pergunta) {
  const texto=normalizar(pergunta),agora=new Date(),hoje=new Date(Date.UTC(agora.getUTCFullYear(),agora.getUTCMonth(),agora.getUTCDate(),23,59,59,999));
  const nomes='janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro',indices={janeiro:0,fevereiro:1,marco:2,abril:3,maio:4,junho:5,julho:6,agosto:7,setembro:8,outubro:9,novembro:10,dezembro:11};
  const encontrados=[...texto.matchAll(new RegExp(`\\b(${nomes})\\s+(?:de\\s+)?(\\d{4})\\b`,'g'))];
  if(encontrados.length){const primeiro=encontrados[0],inicio=new Date(Date.UTC(Number(primeiro[2]),indices[primeiro[1]],1)),ultimo=encontrados.at(-1),fim=/ate agora|ate hoje|atualmente|momento/.test(texto)?hoje:new Date(Date.UTC(Number(ultimo[2]),indices[ultimo[1]]+1,0,23,59,59,999));return{inicio:inicio.toISOString(),fim:fim.toISOString(),rotulo:`${formatarDataBrasil(inicio)} a ${formatarDataBrasil(fim)}`}}
  const anos=[...texto.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));if(anos.length){const inicio=new Date(Date.UTC(anos[0],0,1)),fim=/ate agora|ate hoje|atualmente|momento/.test(texto)?hoje:new Date(Date.UTC(anos.at(-1),11,31,23,59,59,999));return{inicio:inicio.toISOString(),fim:fim.toISOString(),rotulo:`${formatarDataBrasil(inicio)} a ${formatarDataBrasil(fim)}`}}
  const m=texto.match(/ultim(?:o|os|a|as)\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+mes(?:es)?/);if(m){const meses=Number(m[1])||palavrasNumero[m[1]]||null;if(meses)return{meses,rotulo:`últimos ${meses} meses`}}
  if(/ultim(?:o|os|a|as)\s+ano/.test(texto))return{meses:12,rotulo:'últimos 12 meses'};
  if(/ultim(?:o|os|a|as)\s+semestre/.test(texto))return{meses:6,rotulo:'últimos 6 meses'};
  return null;
}

function limitesPeriodo(periodo,referencia){if(!periodo)return null;if(periodo.inicio&&periodo.fim)return{inicio:new Date(periodo.inicio),fim:new Date(periodo.fim)};return{inicio:new Date(Date.UTC(referencia.getUTCFullYear(),referencia.getUTCMonth()-periodo.meses,referencia.getUTCDate())),fim:referencia}}
function obraDentroDoPeriodo(obra,periodo,referencia){if(!periodo)return true;const dataBase=dataBrasilParaDate(obra.inicioObra)||dataBrasilParaDate(obra.dataContrato);if(!dataBase)return false;const limites=limitesPeriodo(periodo,referencia);return dataBase>=limites.inicio&&dataBase<=limites.fim}
function filtrarObrasPeriodo(dados,detalhes,periodo){if(!periodo)return dados;const referencia=dados.sincronizadoEm?new Date(dados.sincronizadoEm):new Date();return{...dados,obras:dados.obras.filter(obra=>obraDentroDoPeriodo(detalhes.obras?.[obra.codigo]||{},periodo,referencia))}}

function resumoContratos(dados, detalhes, situacoes, periodo) {
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
    periodo: periodo ? (() => { const limites=limitesPeriodo(periodo,referencia); return { ...periodo, de:formatarDataBrasil(limites.inicio), ate:formatarDataBrasil(limites.fim) }; })() : null,
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

function analisarEmpresas(pergunta, dados, detalhes, periodo) {
  const texto = normalizar(pergunta);
  if (!/cnpj|empresa|fornecedor|contratada|empreiteira/.test(texto)) return null;
  const referencia = dados.sincronizadoEm ? new Date(dados.sincronizadoEm) : new Date();
  const cadastro = new Map(dados.obras.map((obra) => [obra.codigo, obra]));
  const registrosComEmpresa = Object.values(detalhes.obras || {}).filter((detalhe) =>
    (detalhe.empresa || detalhe.cnpj) && obraDentroDoPeriodo(detalhe, periodo, referencia)
  );
  const cnpjConsultado = pergunta.match(/\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\s/]?(?:\d{4})[-\s]?\d{2}\b/)?.[0] || null;
  const digitosConsultados = cnpjConsultado?.replace(/\D/g, '') || '';
  const nomesConhecidos = [...new Set(registrosComEmpresa.map((item) => item.empresa).filter(Boolean))];
  const nomesCitados = nomesConhecidos.filter((nome) => texto.includes(normalizar(nome)));
  const termos = texto.split(/\s+/).filter((termo) => termo.length >= 4 && !/empresa|cnpj|fornecedor|contratada|empreiteira|quanto|quais|qual|valor|valores|dados|sobre|dessa|desta|contrato|prefeitura|blumenau|ganhou|recebeu|pagou|obras|total/.test(termo));
  let encontrados = registrosComEmpresa.filter((detalhe) => {
    if (digitosConsultados) return String(detalhe.cnpj || '').replace(/\D/g, '') === digitosConsultados;
    if (nomesCitados.length) return nomesCitados.includes(detalhe.empresa);
    const nome = normalizar(detalhe.empresa || '');
    return termos.length > 0 && termos.filter((termo) => nome.includes(termo)).length >= Math.min(2, termos.length);
  });
  if (!digitosConsultados && !nomesCitados.length && !encontrados.length && /quais|maiores|todas|ranking|mais contratos|mais obras/.test(texto)) encontrados = registrosComEmpresa;

  const grupos = new Map();
  encontrados.forEach((detalhe) => {
    const cnpj = String(detalhe.cnpj || '').replace(/\D/g, '');
    const chave = cnpj || normalizar(detalhe.empresa || 'empresa não informada');
    if (!grupos.has(chave)) grupos.set(chave, { empresa: detalhe.empresa || 'Empresa não informada', cnpj: detalhe.cnpj || null, quantidade: 0, valorContratado: 0, valorExecutado: 0, saldoContrato: 0, obras: [] });
    const grupo = grupos.get(chave);
    const obra = cadastro.get(detalhe.codigo);
    grupo.quantidade += 1;
    grupo.valorContratado += numeroMoeda(detalhe.valorContratado) || 0;
    grupo.valorExecutado += numeroMoeda(detalhe.valorExecutado) || 0;
    grupo.saldoContrato += numeroMoeda(detalhe.saldoContrato) || 0;
    grupo.obras.push({ codigo: detalhe.codigo, descricao: obra?.descricao || 'Obra não identificada', situacao: obra?.situacao || 'NÃO INFORMADA', contrato: detalhe.contrato || null, valorContratado: numeroMoeda(detalhe.valorContratado) || 0, valorExecutado: numeroMoeda(detalhe.valorExecutado) || 0 });
  });
  const resultados = [...grupos.values()].sort((a, b) => b.valorContratado - a.valorContratado).slice(0, 20);
  return {
    consulta: cnpjConsultado || nomesCitados[0] || termos.join(' '),
    coberturaEmpresarial: registrosComEmpresa.length,
    empresasEncontradas: resultados.length,
    contratosEncontrados: resultados.reduce((total, item) => total + item.quantidade, 0),
    valorContratado: resultados.reduce((total, item) => total + item.valorContratado, 0),
    valorExecutado: resultados.reduce((total, item) => total + item.valorExecutado, 0),
    saldoContrato: resultados.reduce((total, item) => total + item.saldoContrato, 0),
    resultados
  };
}

function resumoEmpresarial(empresas) {
  if (!empresas.coberturaEmpresarial) return 'A base consolidada ainda não possui empresa e CNPJ. Execute a atualização dos detalhes para habilitar a consulta empresarial.';
  if (!empresas.empresasEncontradas) return `Nenhuma empresa ou CNPJ correspondente a “${empresas.consulta || 'consulta informada'}” foi encontrado nos ${empresas.coberturaEmpresarial} contratos com fornecedor identificado.`;
  return `Foram encontradas ${empresas.empresasEncontradas} empresa(s), relacionadas a ${empresas.contratosEncontrados} obra(s). O valor contratado soma R$ ${formatarMoeda(empresas.valorContratado)} e o valor medido soma R$ ${formatarMoeda(empresas.valorExecutado)}. Esses valores não devem ser interpretados como pagamentos efetivamente realizados.`;
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
        { role: 'system', content: 'Você explica dados públicos de obras para cidadãos. Use somente os fatos fornecidos, não invente causas, prazos ou valores. Escreva um parágrafo curto, objetivo e em português do Brasil. Diferencie claramente contagem de interpretação. Quando houver periodoAplicado, os totais e cartões já estarão filtrados por esse intervalo; informe o período aplicado e nunca diga que ele está vazio. Em consultas empresariais, diferencie valor contratado, valor medido e pagamento: nunca afirme que uma empresa recebeu ou ganhou o valor quando a fonte informa somente contratação ou medição.' },
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

    const [dados, detalhes] = await Promise.all([
      getObrasDataset(),
      getDetalhesDataset(),
    ]);

    const periodo=extrairPeriodo(pergunta);
    const empresas=analisarEmpresas(pergunta,dados,detalhes,periodo);
    if(empresas){
      const fatos={tipo:'consulta empresarial',empresas,periodoAplicado:periodo,sincronizadoEm:dados.sincronizadoEm,nota:'valorExecutado é medido, não necessariamente pago'};
      let resumo=resumoEmpresarial(empresas),modo='análise automática';
      try{const textoIA=await explicarComIA(pergunta,fatos);if(textoIA){resumo=textoIA;modo='IA + dados oficiais'}}catch(error){console.error('Falha opcional na explicação empresarial por IA:',error.message)}
      return Response.json({titulo:'Consulta de empresas e CNPJs',pergunta,resumo,modo,total:empresas.contratosEncontrados,cards:[],secretarias:[],tipos:[],contratos:null,periodo,empresas,sincronizadoEm:dados.sincronizadoEm});
    }
    const dadosPeriodo=filtrarObrasPeriodo(dados,detalhes,periodo);
    const total=dadosPeriodo.obras.length;
    const todasSituacoes=contagemPor(dadosPeriodo,'situacao');
    const cards=selecionarSituacoes(pergunta,todasSituacoes).map(([situacao,quantidade])=>({situacao,rotulo:rotulos[situacao]||situacao,quantidade,percentual:total?Number(((quantidade/total)*100).toFixed(1)):0}));
    const secretarias=contagemPor(dadosPeriodo,'secretaria').slice(0,5).map(([nome,quantidade])=>({nome,quantidade}));
    const tipos=contagemPor(dadosPeriodo,'intervencao').slice(0,5).map(([nome,quantidade])=>({nome,quantidade}));
    const contratos=resumoContratos(dados,detalhes,cards.map(card=>card.situacao),periodo);
    const fatos={total,totalBase:dados.obras.length,situacoes:cards,maioresSecretarias:secretarias,principaisTipos:tipos,contratos,periodoAplicado:periodo,sincronizadoEm:dados.sincronizadoEm};
    let resumo=total?resumoLocalComContratos(cards,total,contratos):`Não foram encontradas obras com data oficial no período ${periodo?.rotulo||'solicitado'}.`;
    let modo = 'análise automática';
    try {
      const textoIA = await explicarComIA(pergunta, fatos);
      if (textoIA) { resumo = textoIA; modo = 'IA + dados oficiais'; }
    } catch (error) {
      console.error('Falha opcional na explicação por IA:', error.message);
    }

    const titulo=periodo?`Comparação de ${periodo.rotulo}`:'Comparação solicitada';
    return Response.json({titulo,pergunta,resumo,modo,total,cards,secretarias,tipos,contratos,periodo,sincronizadoEm:dados.sincronizadoEm});
  } catch(error){
    console.error('Falha ao analisar solicitação:',error);
    return Response.json({ erro: 'Não foi possível analisar a solicitação.' }, { status: 400 });
  }
}
