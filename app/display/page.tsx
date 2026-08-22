import type { Metadata } from "next";
import KitchenBoard from "../kitchen-board";

export const metadata: Metadata = {
  title: "ご注文状況 | COMPASSION WORLD",
  description: "COMPASSION WORLDの顧客向け呼出番号モニター",
};

export default function DisplayPage() {
  return <KitchenBoard displayOnly />;
}
