import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VERIDIS — 642 Studio',
  description: 'Digital nervous system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased font-mono">
        {children}
      </body>
    </html>
  );
}
