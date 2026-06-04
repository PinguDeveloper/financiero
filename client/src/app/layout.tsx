import type { Metadata, Viewport } from "next";
import "../index.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "Atlas Invest | Controle financeiro",
  description: "Controle financeiro pessoal com gastos, parcelas, investimentos e caixinhas.",
  applicationName: "Atlas Invest",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Atlas Invest",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1419",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
