import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PV Solutions CRM",
  description: "PV Solutions müşteri ve satış takip sistemi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
