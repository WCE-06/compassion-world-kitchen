import type { Metadata } from "next";
import AuthenticatedBoard from "./authenticated-board";

export const metadata: Metadata = {
  title: "Kitchen Monitor | COMPASSION WORLD",
  description: "COMPASSION WORLDのキッチン注文管理モニター",
};

export default function Home() {
  return <AuthenticatedBoard />;
}
