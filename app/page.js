import HomeClient from './home-client';
import { getObrasDataset } from '../lib/obras-data';

export const revalidate = 3600;

export default async function Home() {
  const dados = await getObrasDataset();
  return <HomeClient dados={dados} />;
}
