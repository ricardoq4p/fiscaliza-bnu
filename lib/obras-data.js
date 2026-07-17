import fallbackObras from '../data/obras.json';
import fallbackDetalhes from '../data/detalhes-obras.json';
import { hasDatabaseUrl, query } from './db';

let warnedFallback = false;

function warnFallback(error) {
  if (!warnedFallback) {
    console.warn('Falha ao consultar o banco; usando JSON local como fallback.', error?.message || error);
    warnedFallback = true;
  }
}

function formatDateBr(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

function latestTimestamp(syncRow, fallback) {
  return syncRow?.finalizadoEm?.toISOString?.()
    || syncRow?.iniciadoEm?.toISOString?.()
    || fallback;
}

function obrasFallbackComDatas() {
  return {
    ...fallbackObras,
    obras: fallbackObras.obras.map((obra) => {
      const detalhe = fallbackDetalhes.obras?.[obra.codigo] || {};
      return {
        ...obra,
        dataContrato: detalhe.dataContrato || null,
        inicioObra: detalhe.inicioObra || null,
        dataLimiteExecucao: detalhe.dataLimiteExecucao || null,
        terminoContrato: detalhe.terminoContrato || null,
      };
    }),
  };
}

async function getLatestSync(tipo) {
  const result = await query(`
    SELECT "tipo", "fonte", "status", "iniciadoEm", "finalizadoEm"
    FROM "SyncRun"
    WHERE "tipo" = $1 AND "status" = 'success'
    ORDER BY COALESCE("finalizadoEm", "iniciadoEm") DESC
    LIMIT 1
  `, [tipo]);

  return result.rows[0] || null;
}

export async function getObrasDataset() {
  if (!hasDatabaseUrl) return obrasFallbackComDatas();

  try {
    const [obrasResult, sync] = await Promise.all([
      query(`
        SELECT
          o."codigo", o."secretaria", o."descricao", o."logradouro", o."intervencao", o."situacao", o."latitude", o."longitude",
          d."dataContrato", d."inicioObra", d."dataLimiteExecucao", d."terminoContrato"
        FROM "Obra" o
        LEFT JOIN "ObraDetalhe" d ON d."codigo" = o."codigo"
        ORDER BY o."codigo" DESC
      `),
      getLatestSync('obras_import'),
    ]);

    if (!obrasResult.rows.length) return obrasFallbackComDatas();

    return {
      fonte: sync?.fonte || fallbackObras.fonte,
      sincronizadoEm: latestTimestamp(sync, fallbackObras.sincronizadoEm),
      total: obrasResult.rows.length,
      obras: obrasResult.rows.map((obra) => ({
        codigo: obra.codigo,
        secretaria: obra.secretaria,
        descricao: obra.descricao,
        logradouro: obra.logradouro,
        intervencao: obra.intervencao,
        situacao: obra.situacao,
        latitude: obra.latitude === null ? null : Number(obra.latitude),
        longitude: obra.longitude === null ? null : Number(obra.longitude),
        dataContrato: formatDateBr(obra.dataContrato),
        inicioObra: formatDateBr(obra.inicioObra),
        dataLimiteExecucao: formatDateBr(obra.dataLimiteExecucao),
        terminoContrato: formatDateBr(obra.terminoContrato),
      })),
    };
  } catch (error) {
    warnFallback(error);
    return obrasFallbackComDatas();
  }
}

export async function getDetalhesDataset() {
  if (!hasDatabaseUrl) return fallbackDetalhes;

  try {
    const [detalhesResult, sync] = await Promise.all([
      query(`
        SELECT
          "codigo",
          "percentualExecutado",
          "valorContratado",
          "valorExecutado",
          "saldoContrato",
          "dataContrato",
          "inicioObra",
          "dataLimiteExecucao",
          "terminoContrato",
          "consultadoEm"
        FROM "ObraDetalhe"
      `),
      getLatestSync('detalhes_import'),
    ]);

    if (!detalhesResult.rows.length) return fallbackDetalhes;

    const obras = Object.fromEntries(detalhesResult.rows.map((detalhe) => [detalhe.codigo, {
      ...fallbackDetalhes.obras?.[detalhe.codigo],
      codigo: detalhe.codigo,
      percentualExecutado: detalhe.percentualExecutado,
      valorContratado: detalhe.valorContratado === null ? null : Number(detalhe.valorContratado),
      valorExecutado: detalhe.valorExecutado === null ? null : Number(detalhe.valorExecutado),
      saldoContrato: detalhe.saldoContrato === null ? null : Number(detalhe.saldoContrato),
      dataContrato: formatDateBr(detalhe.dataContrato),
      inicioObra: formatDateBr(detalhe.inicioObra),
      dataLimiteExecucao: formatDateBr(detalhe.dataLimiteExecucao),
      terminoContrato: formatDateBr(detalhe.terminoContrato),
      consultadoEm: detalhe.consultadoEm?.toISOString?.() || null,
    }]));

    return {
      sincronizadoEm: latestTimestamp(sync, fallbackDetalhes.sincronizadoEm),
      total: detalhesResult.rows.length,
      obras,
    };
  } catch (error) {
    warnFallback(error);
    return fallbackDetalhes;
  }
}

export async function getObraByCodigo(codigo) {
  const dados = await getObrasDataset();
  return dados.obras.find((obra) => obra.codigo.toUpperCase() === codigo.toUpperCase()) || null;
}

