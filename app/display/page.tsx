import type { Metadata } from "next";
import KitchenBoard from "../kitchen-board";

export const metadata: Metadata = {
  title: "ご注文状況 | Aozora Kitchen",
  description: "Aozora Kitchenのご注文状況",
};

export default function DisplayPage() {
  return <KitchenBoard displayOnly />;
}
