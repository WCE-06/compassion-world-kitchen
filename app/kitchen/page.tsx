import type { Metadata } from "next";
import KitchenBoard from "../kitchen-board";

export const metadata: Metadata = {
  title: "注文管理 | COMPASSION WORLD",
  description: "COMPASSION WORLDのキッチン注文管理画面",
};

export default function KitchenPage() {
  return <KitchenBoard />;
}
