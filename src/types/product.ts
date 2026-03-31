export interface Product {
  id: number;
  name: string;
  price: number;
  pixPrice: number | null;
  imageUrl: string;
  category: string | null;
  subCategory: string | null;
  brand: string | null;
  description: string | null;
  stockQuantity: number;
}

export interface ProductVariant {
  id: string;
  flavorName?: string;
  volumeMl: number | null;
  price: number;
  pixPrice: number | null;
  stockQuantity: number;
}