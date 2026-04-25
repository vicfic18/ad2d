import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aD2D",
  description: "Automatic Data to Document",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
