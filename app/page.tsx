import type { Metadata } from "next";
import { TaigiApp } from "./TaigiApp";

export const metadata: Metadata = {
  title: "咱來學台語｜八冊完整互動教材",
  description:
    "把教育部《咱來學臺灣閩南語》八冊、217 頁 PDF 全文轉成手機電腦都能搜尋、重排與點讀的 HTML 教材。",
};

export default function Home() {
  return <TaigiApp />;
}
