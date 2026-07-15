import { NextResponse } from 'next/server';

export async function GET(request) {
  const termo = new URL(request.url).searchParams.get('q')?.trim();
  if (!termo || termo.length < 3) {
    return NextResponse.json({ erro: 'Digite ao menos 3 caracteres.' }, { status: 400 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('q', `${termo}, Blumenau, Santa Catarina, Brasil`);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'FiscalizaBNU/1.0 (https://github.com/ricardoq4p/fiscaliza-bnu)' },
      next: { revalidate: 86400 }
    });
    if (!response.ok) throw new Error(`Geocodificador respondeu ${response.status}`);
    const [location] = await response.json();
    const city = location?.address?.city || location?.address?.town || location?.address?.municipality;
    if (!location || city !== 'Blumenau') return NextResponse.json({ encontrado: false });

    return NextResponse.json({
      encontrado: true,
      latitude: Number(location.lat),
      longitude: Number(location.lon),
      nome: location.name || termo,
      bairro: location.address?.suburb || location.address?.neighbourhood || null,
      endereco: location.display_name
    });
  } catch {
    return NextResponse.json({ erro: 'Não foi possível localizar o endereço agora.' }, { status: 502 });
  }
}
