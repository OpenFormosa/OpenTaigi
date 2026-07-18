import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://eric-lam.com/OpenTaigi/"),
  title: "咱來學台語｜八冊完整互動教材",
  description:
    "八冊、217 個原始跨頁與 4,349 段真人發音，手機電腦都能直接點讀。",
  openGraph: {
    title: "咱來學台語｜八冊完整互動教材",
    description: "217 個原始跨頁、4,349 段真人發音與 840 句生活台語。",
    type: "website",
    locale: "zh_TW",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "咱來學台語：一頁一頁，講出台語。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "咱來學台語｜八冊完整互動教材",
    description: "217 個原始跨頁、4,349 段真人發音與 840 句生活台語。",
    images: ["og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
