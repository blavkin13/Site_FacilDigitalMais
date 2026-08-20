import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "../../../components/product-detail";
import { getProduct, products } from "../../../lib/products";

export function generateStaticParams(){return products.map(product=>({slug:product.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const p=getProduct(slug);if(!p)return{};return{title:p.title,description:p.description,openGraph:{title:p.title,description:p.description,images:[{url:p.cover}]},twitter:{card:"summary_large_image",title:p.title,description:p.description,images:[p.cover]}}}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const product=getProduct(slug);if(!product)notFound();return <ProductDetail product={product}/>;}
