import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://openformosa.github.io/OpenTaigi/"),
  title: "咱來學台語｜八冊完整互動教材",
  description:
    "八冊、217 頁 PDF 全文轉成可搜尋、可重排的 HTML，並保留 4,349 段真人發音。",
  openGraph: {
    title: "咱來學台語｜八冊完整互動教材",
    description: "217 頁 HTML 教材、4,349 段真人發音與 840 句生活台語。",
    type: "website",
    locale: "zh_TW",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "咱來學台語：PDF 全文轉為 HTML 互動教材。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "咱來學台語｜八冊完整互動教材",
    description: "217 頁 HTML 教材、4,349 段真人發音與 840 句生活台語。",
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
