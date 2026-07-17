'use client';

const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const titulo = (texto = '') => texto.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => `${espaco}${letra.toLocaleUpperCase('pt-BR')}`);

export default function BusinessPanel({ dados }) {
  return <section className="businessPanel" aria-label="Resultados da consulta empresarial">
    <div className="businessTotals"><article><small>EMPRESAS ENCONTRADAS</small><b>{dados.empresasEncontradas}</b></article><article><small>OBRAS E CONTRATOS</small><b>{dados.contratosEncontrados}</b></article><article><small>VALOR CONTRATADO</small><b>{moeda(dados.valorContratado)}</b></article><article><small>VALOR MEDIDO</small><b>{moeda(dados.valorExecutado)}</b></article></div>
    {dados.resultados.map((empresa) => <article className="businessCompany" key={empresa.cnpj || empresa.empresa}><header><div><small>FORNECEDOR</small><h3>{empresa.empresa}</h3><span>{empresa.cnpj || 'CNPJ não informado'}</span></div><b>{empresa.quantidade} {empresa.quantidade === 1 ? 'obra' : 'obras'}</b></header><div><span>Contratado <b>{moeda(empresa.valorContratado)}</b></span><span>Medido <b>{moeda(empresa.valorExecutado)}</b></span><span>Saldo <b>{moeda(empresa.saldoContrato)}</b></span></div><details><summary>Ver obras relacionadas</summary>{empresa.obras.map((obra) => <p key={obra.codigo}><b>#{obra.codigo}</b><span>{titulo(obra.descricao)}</span><small>{obra.situacao} · Contrato {obra.contrato || 'não informado'}</small></p>)}</details></article>)}
    <small className="businessNotice">Os totais representam valores contratados e medidos nos registros disponíveis. Valor medido não significa necessariamente valor pago.</small>
  </section>;
}
