import type { Metadata } from "next";
import { CheckoutReal } from "../../components/checkout-real";

export const metadata: Metadata = {
  title: "Checkout seguro",
  description: "Finalize a compra dos seus materiais.",
};

export default function CheckoutPage() {
  return <CheckoutReal />;
}