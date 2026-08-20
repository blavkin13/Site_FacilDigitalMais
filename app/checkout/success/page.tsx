import type { Metadata } from "next";
import { CheckoutSuccess } from "../../../components/checkout-success";

export const metadata: Metadata = {
  title: "Compra confirmada",
  description: "Sua compra foi realizada com sucesso.",
};

export default function CheckoutSuccessPage() {
  return <CheckoutSuccess />;
}