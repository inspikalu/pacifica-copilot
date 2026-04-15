import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import "./globals.css";

const skatefi = localFont({
  src: "../../public/fonts/skatefi.ttf",
  variable: "--font-skatefi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pacifica Risk Copilot",
  description: "A real-time risk dashboard for Pacifica traders.",
};

import { WalletContextProvider } from "@/components/providers/wallet-provider";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${skatefi.variable} antialiased`}>
      <body className="font-sans bg-[#09090b] text-[#fafafa] selection:bg-[var(--primary)] selection:text-black">
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
        <Toaster richColors theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
