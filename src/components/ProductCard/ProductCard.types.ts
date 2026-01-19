export interface ProductCardProps {
  product: {
    id: number;
    name: string;
    price: number; // Preço cheio (base para parcelamento)
    pixPrice?: number | null; // Preço com desconto à vista
    imageUrl: string;
    stockQuantity?: number; // Adicionado para exibir aviso de estoque
  };
  className?: string;
}