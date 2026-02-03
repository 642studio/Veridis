import "./globals.css";

export const metadata = {
  title: "VERIDIS",
  description: "Sistema Nervioso Digital de 642 Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased font-mono">
        {children}
      </body>
    </html>
  );
}

