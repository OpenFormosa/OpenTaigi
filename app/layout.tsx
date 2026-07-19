import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://openformosa.github.io/OpenTaigi/"),
  title: "咱來學台語｜依程度學習的互動教材",
  description:
    "用真人發音玩聽力闖關、語詞配對與連勝挑戰；並保留初學到進階的八冊、217 頁 HTML 教材。",
  openGraph: {
    title: "咱來學台語｜依程度學習的互動教材",
    description:
      "聽一句、揣答案，用真人發音遊戲一路學到完整文章。",
    type: "website",
    locale: "zh_TW",
    images: [
      {
        url: "og.png",
        width: 1731,
        height: 909,
        alt: "咱來學台語：聽、揣、講的互動式台語遊戲教材。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "咱來學台語｜依程度學習的互動教材",
    description: "真人發音闖關、語詞配對與分級互動教材。",
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
