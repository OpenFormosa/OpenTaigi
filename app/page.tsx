import type { Metadata } from "next";
import { TaigiApp } from "./TaigiApp";

export const metadata: Metadata = {
  title: "咱來學台語｜八冊完整互動教材",
  description:
    "把教育部《咱來學臺灣閩南語》八冊、217 個原始跨頁與 4,349 段真人發音，變成手機電腦都能直接點讀的互動教材。",
};

export default function Home() {
  return <TaigiApp />;
}
