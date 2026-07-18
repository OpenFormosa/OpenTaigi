import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://eric-lam.com/OpenTaigi/"),
  title: "咱來學台語｜互動式台語教材",
  description:
    "聽發音、讀羅馬字、做小測驗。把教育部《咱來學臺灣閩南語》840 句生活台語帶著走。",
  openGraph: {
    title: "咱來學台語｜一句一句，講出台語",
    description: "840 句生活台語，隨時聽、開口唸、馬上練。",
    type: "website",
    locale: "zh_TW",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "咱來學台語：一句一句，講出台語。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "咱來學台語｜一句一句，講出台語",
    description: "840 句生活台語，隨時聽、開口唸、馬上練。",
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
