import './globals.css';

export const metadata = {
  title: 'Fiscaliza BNU',
  description: 'Obras públicas de Blumenau com transparência e contexto.'
};

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
