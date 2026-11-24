import { supabaseService } from "@/lib/supabase/server";
import { loadProducts } from "@/lib/catalog";
import ProductManager from "@/components/ProductManager";

export const dynamic = "force-dynamic";

export default async function Produits() {
  const products = await loadProducts(supabaseService(), true);
  return (
    <>
      <div className="page-head"><div><div className="kick">Catalogue</div><h2>Produits et TVA</h2></div></div>
      <ProductManager products={products} />
    </>
  );
}
