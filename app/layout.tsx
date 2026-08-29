import type { Metadata } from "next";
import { LanguageProvider } from "@/components/ui/language-provider";
import { SoundProvider } from "@/components/sound/sound-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Unexposed",
  description: "A personal visual memory archive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><LanguageProvider><SoundProvider>{children}</SoundProvider></LanguageProvider></body>
    </html>
  );
}
