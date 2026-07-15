const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada em .env.local ou .env.');
}

const root = path.resolve(__dirname, '..');
const obrasPath = path.join(root, 'data', 'obras.json');
const detalhesPath = path.join(root, 'data', 'detalhes-obras.json');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

function parseJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value.toFixed(2);
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

function parseBrDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) {
    const iso = new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }

  const match = String(value).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12, 0, 0));
}

async function insertSyncRun(client, payload) {
  await client.query(`
    INSERT INTO "SyncRun" ("id", "tipo", "fonte", "status", "totalLidos", "totalGravados", "mensagem", "iniciadoEm", "finalizadoEm")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    crypto.randomUUID(),
    payload.tipo,
    payload.fonte || null,
    payload.status,
    payload.totalLidos ?? null,
    payload.totalGravados ?? null,
    payload.mensagem || null,
    payload.iniciadoEm || new Date(),
    payload.finalizadoEm || new Date(),
  ]);
}

async function importObras(client, payload) {
  const startedAt = new Date();
  let gravadas = 0;

  await client.query('BEGIN');
  try {
    for (const obra of payload.obras) {
      await client.query(`
        INSERT INTO "Obra" (
          "codigo",
          "secretaria",
          "descricao",
          "logradouro",
          "intervencao",
          "situacao",
          "latitude",
          "longitude",
          "criadoEm",
          "atualizadoEm"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT ("codigo") DO UPDATE SET
          "secretaria" = EXCLUDED."secretaria",
          "descricao" = EXCLUDED."descricao",
          "logradouro" = EXCLUDED."logradouro",
          "intervencao" = EXCLUDED."intervencao",
          "situacao" = EXCLUDED."situacao",
          "latitude" = EXCLUDED."latitude",
          "longitude" = EXCLUDED."longitude",
          "atualizadoEm" = NOW()
      `, [
        obra.codigo,
        obra.secretaria || null,
        obra.descricao,
        obra.logradouro || null,
        obra.intervencao || null,
        obra.situacao || null,
        Number.isFinite(obra.latitude) ? obra.latitude : null,
        Number.isFinite(obra.longitude) ? obra.longitude : null,
      ]);
      gravadas += 1;
    }

    await insertSyncRun(client, {
      tipo: 'obras_import',
      fonte: payload.fonte,
      status: 'success',
      totalLidos: payload.obras.length,
      totalGravados: gravadas,
      iniciadoEm: startedAt,
      finalizadoEm: new Date(),
      mensagem: `Importação concluída com ${gravadas} obras.`,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    await insertSyncRun(client, {
      tipo: 'obras_import',
      fonte: payload.fonte,
      status: 'error',
      totalLidos: payload.obras.length,
      totalGravados: gravadas,
      iniciadoEm: startedAt,
      finalizadoEm: new Date(),
      mensagem: error.message,
    });
    throw error;
  }
}

async function importDetalhes(client, payload) {
  const startedAt = new Date();
  let gravados = 0;
  const detalhes = Object.values(payload.obras || {});

  await client.query('BEGIN');
  try {
    for (const detalhe of detalhes) {
      await client.query(`
        INSERT INTO "ObraDetalhe" (
          "codigo",
          "percentualExecutado",
          "valorContratado",
          "valorExecutado",
          "saldoContrato",
          "dataContrato",
          "inicioObra",
          "dataLimiteExecucao",
          "terminoContrato",
          "consultadoEm",
          "criadoEm",
          "atualizadoEm"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT ("codigo") DO UPDATE SET
          "percentualExecutado" = EXCLUDED."percentualExecutado",
          "valorContratado" = EXCLUDED."valorContratado",
          "valorExecutado" = EXCLUDED."valorExecutado",
          "saldoContrato" = EXCLUDED."saldoContrato",
          "dataContrato" = EXCLUDED."dataContrato",
          "inicioObra" = EXCLUDED."inicioObra",
          "dataLimiteExecucao" = EXCLUDED."dataLimiteExecucao",
          "terminoContrato" = EXCLUDED."terminoContrato",
          "consultadoEm" = EXCLUDED."consultadoEm",
          "atualizadoEm" = NOW()
      `, [
        detalhe.codigo,
        detalhe.percentualExecutado || null,
        parseMoney(detalhe.valorContratado),
        parseMoney(detalhe.valorExecutado),
        parseMoney(detalhe.saldoContrato),
        parseBrDate(detalhe.dataContrato),
        parseBrDate(detalhe.inicioObra),
        parseBrDate(detalhe.dataLimiteExecucao),
        parseBrDate(detalhe.terminoContrato),
        detalhe.consultadoEm ? new Date(detalhe.consultadoEm) : null,
      ]);
      gravados += 1;
    }

    await insertSyncRun(client, {
      tipo: 'detalhes_import',
      fonte: null,
      status: 'success',
      totalLidos: detalhes.length,
      totalGravados: gravados,
      iniciadoEm: startedAt,
      finalizadoEm: new Date(),
      mensagem: `Importação concluída com ${gravados} detalhes.`,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    await insertSyncRun(client, {
      tipo: 'detalhes_import',
      fonte: null,
      status: 'error',
      totalLidos: detalhes.length,
      totalGravados: gravados,
      iniciadoEm: startedAt,
      finalizadoEm: new Date(),
      mensagem: error.message,
    });
    throw error;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const obras = parseJson(obrasPath);
    const detalhes = parseJson(detalhesPath);

    await importObras(client, obras);
    await importDetalhes(client, detalhes);

    console.log(`Importação concluída: ${obras.total} obras e ${detalhes.total} detalhes sincronizados.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Falha na importação para o banco:', error);
  process.exitCode = 1;
});
