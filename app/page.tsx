import type { Metadata } from "next";
import { TaigiApp } from "./TaigiApp";

export const metadata: Metadata = {
  title: "咱來學台語｜互動式台語教材",
  description: "聽發音、讀羅馬字、做小測驗。把教育部《咱來學臺灣閩南語》840 句生活台語帶著走。",
};

export default function Home() {
  return <TaigiApp />;
}
