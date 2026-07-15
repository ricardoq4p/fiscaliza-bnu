# Fiscaliza BNU

Interface cidadã para pesquisar as obras públicas de Blumenau por endereço, descrição, situação e órgão responsável. A busca por endereço ordena as obras georreferenciadas mais próximas em um raio de 1 km.

## Dados

Os dados vêm da exportação XLS oficial do [Portal de Transparência em Obras Públicas](https://engegov.blumenau.sc.gov.br/portal-engegov/dashboard.xhtml?cidade=4898). A cópia sincronizada fica em `data/obras.json`, permitindo que o site continue disponível sem depender do portal a cada visita.

Para atualizar a base:

```bash
python -m pip install -r requirements-data.txt
npm run sync:data
```

O sincronizador baixa a planilha oficial completa e as coordenadas publicadas no mapa do EngeGOV. A localização do endereço pesquisado usa o OpenStreetMap/Nominatim. O processo não altera dados nem envia formulários de contato.

Ao clicar em **Ver contrato e andamento**, a rota `/api/obras/[codigo]` consulta somente a obra escolhida no EngeGOV e apresenta valores, percentual executado, empresa, contrato, prazos, recurso e medições. A resposta é mantida em cache por uma hora para reduzir acessos ao portal oficial.

## Desenvolvimento

```bash
npm install
npm run dev
```

A aplicação usa Next.js 14 e não exige banco de dados nesta fase.
