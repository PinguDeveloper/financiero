import type { Metadata, Viewport } from "next";
import "../index.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "Atlas Invest | Controle financeiro",
  description: "Controle financeiro pessoal com gastos, parcelas, investimentos e caixinhas.",
  applicationName: "Atlas Invest",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "Atlas Invest",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
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

