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
      <body className="min-h-screen bg-black text-white flex items-center justify-center">
        {children}
      </body>
    </html>
  );
}

