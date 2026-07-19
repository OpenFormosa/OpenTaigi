import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://openformosa.github.io/OpenTaigi/"),
  title: "咱來學台語｜依程度學習的互動教材",
  description:
    "初學、生活應用、進階讀寫三條學習路線；八冊、217 頁 HTML 教材與 4,349 段真人發音。",
  openGraph: {
    title: "咱來學台語｜依程度學習的互動教材",
    description:
      "依程度調整提示、速度與推薦內容，從拼音、語詞一路學到完整文章。",
    type: "website",
    locale: "zh_TW",
  },
  twitter: {
    card: "summary",
    title: "咱來學台語｜依程度學習的互動教材",
    description: "初學、生活應用、進階讀寫三條學習路線。",
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
