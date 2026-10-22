export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  brand: string;
  restrictions: string[];
  flyerPage: string | null;
  badge: string | null;
  stock: number | null;
  active?: boolean;
  flashOfferEndsAt?: string;
}

export interface CartItem {
  product: CatalogProduct;
  quantity: number;
}
