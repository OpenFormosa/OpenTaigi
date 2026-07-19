import type { Metadata } from "next";
import { TaigiApp } from "./TaigiApp";

export const metadata: Metadata = {
  title: "咱來學台語｜依程度學習的互動教材",
  description:
    "真人發音聽力闖關、語詞配對與分級路線，依程度調整提示、速度、字級與推薦教材。",
};

export default function Home() {
  return <TaigiApp />;
}
