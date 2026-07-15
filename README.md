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

## Desenvolvimento

```bash
npm install
npm run dev
```

A aplicação usa Next.js 14 e não exige banco de dados nesta fase.
