import catalog from './shopProducts.json';

export type Product = { id: string; name: string; category: string; price: number; oldPrice: number; image: string; badge: string; description: string; specs: string[] };
export type ItemSnapshot = { product_id: string; quantity: number; unit_price: number; subtotal: number };
export type ShopItem = ItemSnapshot & { product: Product };

// Product descriptions and images are bundled with the UI, never read from DB.
export const products: Product[] = catalog;
const byId = new Map(products.map(product => [product.id, product]));

export function displayItems(items: ItemSnapshot[]): ShopItem[] {
  return items.map(item => {
    const product = byId.get(item.product_id);
    return { ...item, product: product ? { ...product, price: item.unit_price } : {
      id: item.product_id, name: `Mặt hàng mẫu (${item.product_id})`, category: 'Đơn hàng đã lưu',
      price: item.unit_price, oldPrice: item.unit_price, image: '/favicon.svg', badge: '', description: '', specs: [],
    } };
  });
}
