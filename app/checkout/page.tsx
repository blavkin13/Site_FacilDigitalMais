import type { Metadata } from "next";
import { CheckoutDemo } from "../../components/checkout-demo";
export const metadata: Metadata={title:"Checkout seguro",description:"Finalize a compra dos seus materiais."};
export default function CheckoutPage(){return <CheckoutDemo/>}
