/**
 * [BAREM 4 - Bối cảnh demo] Cửa hàng giúp User tạo các sự kiện có ý nghĩa nghiệp vụ.
 * Sản phẩm tĩnh; giỏ/đơn/thông tin nhận hàng ở trình duyệt, không phải bảng Cassandra.
 * ShopClient gửi /api/shop/events để backend ghi audit; trả tiền lỗi tạo Payment/ERROR.
 * Để chứng minh CRUD dữ liệu thật theo barem, dùng màn hình Dịch vụ hoặc Tài khoản.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode, FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Headphones, Leaf, LogOut, Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Trash2, Truck, UserRound, X } from 'lucide-react';
import auditApi from '../services/api';
import { createShopClient } from '../services/shopClient';
import { useAuth } from '../context/AuthContext';
import { DEMO_MODE } from '../config/api';
import { products, displayItems, type Product, type ShopItem as Item, type ItemSnapshot } from '../services/shopCatalog';
import './shop.css';

type Shipping = { name: string; phone: string; address: string };
type Order = { id: string; created_at: string; status: string; items: Item[]; total: number; shipping: Shipping; attempts: { id: string; outcome: string; at: string }[] };
const displayOrder = (order: Omit<Order, 'items'> & { items: ItemSnapshot[] }): Order => ({ ...order, items: displayItems(order.items) });
const money = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const message = (e: any) => e.response?.data?.details?.[0]?.message || e.response?.data?.message || (e.isAxiosError ? 'Chưa ghi được nhật ký thao tác. Vui lòng thử lại.' : e.message) || 'Chưa thực hiện được thao tác. Vui lòng thử lại.';
const labels: Record<string, string> = { PENDING_PAYMENT: 'Chờ thanh toán', PAYMENT_FAILED: 'Thanh toán chưa thành công', PAID: 'Đã thanh toán', CANCELLED: 'Đã hủy' };
type ShopState = { client: ReturnType<typeof createShopClient>; products: Product[]; cart: Item[]; busy: boolean; error: string; notice: string; ready: boolean; load: () => Promise<void>; update: (id: string, quantity: number) => Promise<boolean>; clearNotice: () => void; reloadCart: () => Promise<void> };
const ShopContext = createContext<ShopState>(null!);
const useShop = () => useContext(ShopContext);
function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const client = useMemo(() => createShopClient(user?.user_id || 'anonymous', DEMO_MODE ? 'preview' : 'api', localStorage, event => auditApi.post('/shop/events', event)), [user?.user_id]);
  const [cart, setCart] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [ready, setReady] = useState(false);
  const writing = useRef(false);
  const reloadCart = async () => { setCart(displayItems(await client.getCart())); };
  const load = async () => { setError(''); try { await reloadCart(); setReady(true); } catch (e) { setError(message(e)); } };
  useEffect(() => { setReady(false); void load(); }, [client]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 5000); return () => window.clearTimeout(timer); }, [notice]);
  const update = async (id: string, quantity: number) => {
    if (writing.current) return false;
    writing.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const items = cart.filter(i => i.product_id !== id).map(i => ({ product_id: i.product_id, quantity: i.quantity }));
      if (quantity > 0) items.push({ product_id: id, quantity });
      setCart(displayItems(await client.saveCart(items)));
      setNotice(quantity > 0 ? 'Đã cập nhật giỏ hàng của bạn.' : 'Đã bỏ sản phẩm khỏi giỏ hàng.'); return true;
    } catch (e) { setError(message(e)); return false; } finally { writing.current = false; setBusy(false); }
  };
  return <ShopContext.Provider value={{ client, products, cart, busy, error, notice, ready, load, update, reloadCart, clearNotice: () => setNotice('') }}>{children}</ShopContext.Provider>;
}
export function StoreLayout() { return <ShopProvider><StoreShell/></ShopProvider>; }
function StoreShell() {
  const { user, logout } = useAuth(), { cart, error, notice, load, clearNotice } = useShop();
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  return <div className="shop-shell"><div className="shop-announcement">Cửa hàng demo · Đơn mẫu lưu trên trình duyệt này · Không thu tiền</div>
    {DEMO_MODE && <div className="demo-banner">CHẾ ĐỘ XEM THỬ · Dữ liệu lưu trên trình duyệt, chưa kết nối Cassandra.</div>}
    <header className="shop-header"><Link to="/" className="shop-brand" aria-label="Nếp Store, trang chủ"><Leaf size={28}/><span>nếp<span>store</span><small>ĐỒ HAY CHO MỖI NGÀY</small></span></Link>
      <nav aria-label="Cửa hàng"><NavLink to="/" end>Sản phẩm</NavLink><NavLink to="/orders">Đơn hàng của tôi</NavLink></nav>
      <div className="shop-header-actions"><details className="shop-account"><summary aria-label="Tài khoản"><UserRound size={20}/><span>{user?.full_name || user?.username}</span></summary><div><Link to="/profile">Thông tin tài khoản</Link><button onClick={() => void logout()}><LogOut size={16}/>Đăng xuất</button></div></details><Link className="shop-cart-link" to="/cart" aria-label={`Giỏ hàng (${count})`}><ShoppingBag size={23}/><b>{count}</b></Link></div>
    </header>
    {error && <div className="shop-alert error" role="alert">{error}<button onClick={() => void load()}>Thử lại</button></div>}
    {notice && <div className="shop-alert success" role="status"><Check size={17}/>{notice}<Link to="/cart">Xem giỏ hàng</Link><button aria-label="Đóng thông báo" onClick={clearNotice}><X size={16}/></button></div>}
    <main className="shop-main"><Outlet/></main>
    <footer className="shop-footer"><Link to="/" className="shop-brand"><Leaf size={24}/><span>nếp<span>store</span></span></Link><p>Một chút công nghệ. Thêm nhiều cảm hứng.</p><span>Đồ án Nhóm 07 · Sản phẩm & giao dịch minh họa</span></footer>
  </div>;
}
function Empty({ title, text }: { title: string; text: string }) { return <div className="shop-empty"><ShoppingBag size={48}/><h2>{title}</h2><p>{text}</p><Link className="shop-button" to="/">Khám phá sản phẩm<ArrowRight size={17}/></Link></div>; }
function ProductDialog({ product, close, buy }: { product: Product; close: () => void; buy: (p: Product, now: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null), { busy, ready } = useShop();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="shop-product-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><button className="shop-close" aria-label="Đóng chi tiết sản phẩm" onClick={close}><X/></button><div className="shop-detail-grid"><img src={product.image} alt={product.name}/><div><span className="shop-eyebrow">{product.category}</span><h2>{product.name}</h2><div className="shop-price">{money(product.price)}<del>{money(product.oldPrice)}</del></div><p>{product.description}</p><ul>{product.specs.map(s => <li key={s}><Check size={16}/>{s}</li>)}</ul><button className="shop-button" disabled={busy || !ready} onClick={() => buy(product, true)}>Mua ngay<ArrowRight size={17}/></button><button className="shop-button secondary" disabled={busy || !ready} onClick={() => buy(product, false)}>Thêm vào giỏ hàng</button><small>Ảnh, giá và thông số chỉ phục vụ demo.</small></div></div></dialog>;
}
export function StorefrontPage() {
  const { products, cart, update, busy, ready } = useShop(), navigate = useNavigate();
  const [category, setCategory] = useState('Tất cả'), [query, setQuery] = useState(''), [sort, setSort] = useState('featured'), [selected, setSelected] = useState<Product | null>(null);
  const buy = async (p: Product, now: boolean) => { if (!ready) return; const ok = await update(p.id, Math.min(10, (cart.find(i => i.product_id === p.id)?.quantity || 0) + 1)); if (ok) { setSelected(null); if (now) navigate('/cart'); } };
  const filtered = products.filter(p => (category === 'Tất cả' || p.category === category) && p.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).sort((a, b) => sort === 'asc' ? a.price - b.price : sort === 'desc' ? b.price - a.price : 0);
  return <><section className="shop-hero"><div className="shop-hero-copy"><span className="shop-eyebrow">NHỮNG ĐIỀU NHỎ, TRẢI NGHIỆM TỐT HƠN</span><h1>Nâng niu từng<br/>góc nhỏ của bạn<span>.</span></h1><p>Phụ kiện tinh gọn, sắc màu dịu mắt.<br/>Chọn món đồ hợp với nhịp sống của bạn.</p><a className="shop-button" href="#products">Khám phá bộ sưu tập<ArrowRight size={18}/></a><span className="shop-hero-note">BỘ SƯU TẬP EVERYDAY / 2026</span></div><div className="shop-hero-image"><img src="/products/headphones.png" alt="Tai nghe màu xanh sage trong bộ sưu tập Everyday"/><span>Ít ồn ào.<br/><strong>Nhiều cảm hứng.</strong></span></div></section>
    <div className="shop-perks"><span><Truck/>Miễn phí giao hàng mẫu</span><span><Package/>Thiết kế cho mỗi ngày</span><span><Headphones/>Trải nghiệm mua sắm dễ dàng</span></div>
    <section id="products" className="shop-products"><div className="shop-section-title"><div><span className="shop-eyebrow">CHỌN MỘT CHÚT CẢM HỨNG</span><h2>Món đồ bạn sẽ yêu thích</h2></div><span>{products.length} sản phẩm chọn lọc</span></div>
      <div className="shop-filter"><div className="shop-categories">{['Tất cả', 'Âm thanh', 'Góc làm việc'].map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="shop-filter-fields"><label className="shop-search"><Search size={18}/><input aria-label="Tìm sản phẩm" placeholder="Tìm món đồ của bạn…" value={query} onChange={e => setQuery(e.target.value)}/></label><label className="shop-sort"><SlidersHorizontal size={17}/><select aria-label="Sắp xếp sản phẩm" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Nổi bật</option><option value="asc">Giá tăng dần</option><option value="desc">Giá giảm dần</option></select></label></div></div>
      {!ready && <p className="shop-loading" role="status">Đang mở giỏ hàng trên trình duyệt…</p>}
      {filtered.length === 0 ? <p className="shop-loading">Không tìm thấy sản phẩm. Thử từ khóa khác nhé.</p> : <div className="shop-product-grid">{filtered.map(p => <article className="shop-product-card" key={p.id}><button className="shop-product-photo" onClick={() => setSelected(p)} aria-label={`Xem ${p.name}`}><img src={p.image} alt={p.name} loading="lazy"/>{p.badge && <span>{p.badge}</span>}</button><div className="shop-product-info"><span>{p.category}</span><button className="shop-product-name" onClick={() => setSelected(p)}>{p.name}</button><div className="shop-price">{money(p.price)}<del>{money(p.oldPrice)}</del></div><div className="shop-product-actions"><button className="shop-button secondary" disabled={busy || !ready} onClick={() => void buy(p, false)} aria-label={`Thêm ${p.name} vào giỏ`}><Plus size={17}/>Thêm vào giỏ</button><button className="shop-buy-link" disabled={busy || !ready} onClick={() => void buy(p, true)}>Mua ngay<ArrowRight size={16}/></button></div></div></article>)}</div>}
    </section><section className="shop-bottom-note"><Leaf size={30}/><div><h3>Chọn đơn giản. Dùng mỗi ngày.</h3><p>Từ góc làm việc đến khoảng nghỉ, luôn có một món đồ dành cho bạn.</p></div></section>
    {selected && <ProductDialog product={selected} close={() => setSelected(null)} buy={(p, now) => void buy(p, now)}/>}</>;
}
function Steps({ step }: { step: number }) { return <ol className="shop-steps">{['Giỏ hàng', 'Thông tin nhận hàng', 'Thanh toán'].map((s, i) => <li className={step >= i ? 'active' : ''} key={s}><b>{step > i ? <Check size={14}/> : i + 1}</b><span>{s}</span></li>)}</ol>; }
function Summary({ items, total, children }: { items: Item[]; total: number; children?: ReactNode }) { return <aside className="shop-summary"><h3>Tóm tắt đơn hàng</h3><div className="shop-summary-items">{items.map(i => <div key={i.product_id}><img src={i.product.image} alt=""/><span>{i.product.name}<small>Số lượng: {i.quantity}</small></span><b>{money(i.subtotal)}</b></div>)}</div><p><span>Tạm tính</span><b>{money(total)}</b></p><p><span>Phí giao hàng</span><span className="shop-green">Miễn phí</span></p><p className="shop-total"><strong>Tổng cộng</strong><strong>{money(total)}</strong></p>{children}<small className="shop-payment-note"><CreditCard size={16}/>Thanh toán giả lập · Không trừ tiền</small></aside>; }
export function CartPage() {
  const { cart, update, busy, ready } = useShop();
  if (!ready) return <p className="shop-loading">Đang tải giỏ hàng…</p>;
  if (!cart.length) return <Empty title="Giỏ hàng đang chờ bạn" text="Chọn vài món đồ yêu thích để bắt đầu nhé."/>;
  return <div className="shop-page"><Steps step={0}/><Link className="shop-back" to="/"><ArrowLeft size={16}/>Tiếp tục mua sắm</Link><h1>Giỏ hàng của bạn<span>({cart.reduce((n, i) => n + i.quantity, 0)} sản phẩm)</span></h1><div className="shop-checkout-grid"><div className="shop-cart-items">{cart.map(i => <article key={i.product_id} className="shop-cart-item"><img src={i.product.image} alt={i.product.name}/><div><span className="shop-eyebrow">{i.product.category}</span><h3>{i.product.name}</h3><p>{money(i.product.price)}</p><div className="shop-quantity"><button disabled={busy || i.quantity <= 1} aria-label={`Giảm ${i.product.name}`} onClick={() => void update(i.product_id, i.quantity - 1)}><Minus size={14}/></button><span aria-label="Số lượng">{i.quantity}</span><button disabled={busy || i.quantity >= 10} aria-label={`Tăng ${i.product.name}`} onClick={() => void update(i.product_id, i.quantity + 1)}><Plus size={14}/></button></div></div><div className="shop-cart-item-end"><strong>{money(i.subtotal)}</strong><button disabled={busy} aria-label={`Xóa ${i.product.name}`} onClick={() => void update(i.product_id, 0)}><Trash2 size={16}/>Xóa</button></div></article>)}</div><Summary items={cart} total={cart.reduce((n, i) => n + i.subtotal, 0)}><Link className="shop-button" to="/checkout">Tiến hành đặt hàng<ArrowRight size={17}/></Link></Summary></div></div>;
}
export function CheckoutPage() {
  const { client, cart, ready, reloadCart } = useShop(), navigate = useNavigate();
  const [shipping, setShipping] = useState<Shipping>({ name: '', phone: '', address: '' }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [orderId] = useState(() => crypto.randomUUID());
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try { await client.createOrder(orderId, shipping); await reloadCart(); navigate(`/orders/${orderId}`); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  if (!ready) return <p className="shop-loading">Đang tải…</p>;
  if (!cart.length) return <Empty title="Chưa có sản phẩm để đặt hàng" text="Thêm sản phẩm vào giỏ hàng để tiếp tục."/>;
  return <div className="shop-page"><Steps step={1}/><Link className="shop-back" to="/cart"><ArrowLeft size={16}/>Quay lại giỏ hàng</Link><h1>Hoàn tất thông tin nhận hàng</h1><form onSubmit={submit} className="shop-checkout-grid"><section className="shop-form-card"><h2><Truck size={22}/>Địa chỉ nhận hàng</h2><p>Chỉ dùng thông tin mẫu để trải nghiệm. Đơn hàng sẽ không được giao.</p><button type="button" className="shop-text-button" onClick={() => setShipping({ name: 'Nguyễn Demo', phone: '0900000000', address: '123 Đường Demo, Phường Mẫu, TP. Hồ Chí Minh' })}>Điền thông tin mẫu</button><label htmlFor="recipient">Họ và tên</label><input id="recipient" required minLength={2} maxLength={80} value={shipping.name} onChange={e => setShipping({ ...shipping, name: e.target.value })} placeholder="Tên người nhận"/><label htmlFor="phone">Số điện thoại</label><input id="phone" required inputMode="tel" pattern="0[0-9]{9}" title="10 chữ số, bắt đầu bằng 0" value={shipping.phone} onChange={e => setShipping({ ...shipping, phone: e.target.value })} placeholder="0900000000"/><label htmlFor="address">Địa chỉ</label><textarea id="address" required minLength={10} maxLength={240} value={shipping.address} onChange={e => setShipping({ ...shipping, address: e.target.value })} placeholder="Số nhà, đường, phường/xã, tỉnh/thành"/><div className="shop-shipping-option"><Truck size={20}/><div><strong>Giao hàng tiêu chuẩn</strong><span>Phương thức minh họa</span></div><b>Miễn phí</b></div>{error && <p className="shop-form-error" role="alert">{error}</p>}</section><Summary items={cart} total={cart.reduce((n, i) => n + i.subtotal, 0)}><button className="shop-button" disabled={busy}>{busy ? 'Đang tạo đơn…' : 'Đặt hàng & tiếp tục'}<ArrowRight size={17}/></button></Summary></form></div>;
}
export function OrdersPage() {
  const { client } = useShop();
  const [orders, setOrders] = useState<Order[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setOrders((await client.listOrders()).map(displayOrder)); } catch (e) { setError(message(e)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [client]);
  if (loading) return <p className="shop-loading">Đang tải đơn hàng…</p>;
  if (error) return <div className="shop-empty"><p role="alert">{error}</p><button className="shop-button" onClick={() => void load()}>Thử lại</button></div>;
  if (!orders.length) return <Empty title="Chưa có đơn hàng nào" text="Món đồ yêu thích đầu tiên đang chờ bạn khám phá."/>;
  return <div className="shop-page"><span className="shop-eyebrow">GÓC CỦA BẠN</span><h1>Đơn hàng của tôi</h1><div className="shop-order-list">{orders.map(o => <article key={o.id}><header><div><strong>Đơn #{o.id.slice(0, 8).toUpperCase()}</strong><span>{new Date(o.created_at).toLocaleString('vi-VN')}</span></div><span className={`shop-status ${o.status.toLowerCase()}`}>{labels[o.status]}</span></header><div className="shop-order-preview"><div>{o.items.map(i => <img key={i.product_id} src={i.product.image} alt={i.product.name}/>)}</div><span>{o.items.map(i => `${i.product.name} × ${i.quantity}`).join(' · ')}</span><strong>{money(o.total)}</strong></div><footer><span>{o.items.reduce((n, i) => n + i.quantity, 0)} sản phẩm</span><Link className="shop-button secondary" to={`/orders/${o.id}`}>{['PAID', 'CANCELLED'].includes(o.status) ? 'Xem chi tiết' : 'Tiếp tục thanh toán'}<ArrowRight size={16}/></Link></footer></article>)}</div></div>;
}
export function OrderPage() {
  const { client } = useShop();
  const { id } = useParams(), [order, setOrder] = useState<Order | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [outcome, setOutcome] = useState('success'), [confirmCancel, setConfirmCancel] = useState(false);
  const attempt = useRef(crypto.randomUUID());
  const load = async () => { setError(''); setLoading(true); try { setOrder(displayOrder(await client.getOrder(id!))); } catch (e) { setError(message(e)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [id, client]);
  const pay = async () => { setBusy(true); setError(''); try { setOrder(displayOrder(await client.payOrder(id!, attempt.current, outcome))); attempt.current = crypto.randomUUID(); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  const cancel = async () => { setBusy(true); setError(''); try { setOrder(displayOrder(await client.cancelOrder(id!))); setConfirmCancel(false); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  if (loading) return <p className="shop-loading">Đang tải đơn hàng…</p>;
  if (!order) return <div className="shop-empty"><h2>Chưa mở được đơn hàng</h2><p role="alert">{error}</p><button className="shop-button" onClick={() => void load()}>Thử lại</button><Link to="/orders">Về đơn hàng của tôi</Link></div>;
  const done = order.status === 'PAID', cancelled = order.status === 'CANCELLED', failed = order.status === 'PAYMENT_FAILED';
  return <div className="shop-page"><Steps step={done ? 3 : 2}/><Link className="shop-back" to="/orders"><ArrowLeft size={16}/>Đơn hàng của tôi</Link><h1>{done ? 'Cảm ơn bạn đã mua sắm!' : cancelled ? 'Đơn hàng đã được hủy' : 'Chỉ còn một bước nữa'}</h1><div className="shop-checkout-grid"><div><section className="shop-form-card"><div className={`shop-order-heading ${done ? 'paid' : ''}`}>{done ? <CheckCircle2 size={42}/> : <ShoppingCart size={36}/>}<div><h2>Đơn #{order.id.slice(0, 8).toUpperCase()}</h2><span className={`shop-status ${order.status.toLowerCase()}`}>{labels[order.status]}</span></div></div>{done ? <p>Thanh toán mẫu đã hoàn tất. Bạn có thể xem lại đơn hàng bất cứ lúc nào.</p> : cancelled ? <p>Bạn có thể quay lại cửa hàng và chọn một sản phẩm khác.</p> : <><h3>Phương thức thanh toán</h3><div className="shop-shipping-option"><CreditCard/><div><strong>Ví Nếp Pay · Demo</strong><span>Không cần nhập thông tin thẻ</span></div><CheckCircle2 size={20}/></div><details className="shop-scenarios"><summary>Thử tình huống thanh toán</summary><p>Chọn kết quả giả lập cho lần thanh toán tiếp theo.</p>{[['success', 'Thành công'], ['declined', 'Bị từ chối'], ['timeout', 'Cổng thanh toán không phản hồi']].map(([v, l]) => <label key={v}><input type="radio" name="outcome" disabled={busy} checked={outcome === v} onChange={() => { setOutcome(v); attempt.current = crypto.randomUUID(); }}/>{l}</label>)}</details>{failed && <div className="shop-payment-failed" role="status"><strong>Thanh toán chưa thành công</strong><p>{order.attempts[order.attempts.length - 1]?.outcome === 'timeout' ? 'Cổng thanh toán mẫu không phản hồi.' : 'Giao dịch mẫu đã bị từ chối.'} Đơn hàng vẫn được lưu. Bạn có thể chọn “Thành công” và thử lại.</p></div>}</>}{error && <p className="shop-form-error" role="alert">{error}</p>}<hr/><h3>Thông tin nhận hàng</h3><p>{order.shipping.name} · {order.shipping.phone}<br/>{order.shipping.address}</p>{order.attempts.length > 0 && <details className="shop-payment-history"><summary>Lịch sử thanh toán ({order.attempts.length})</summary>{order.attempts.map((a, i) => <p key={a.id}>Lần {i + 1}: {a.outcome === 'success' ? 'Thành công' : a.outcome === 'timeout' ? 'Không phản hồi' : 'Bị từ chối'}<small>{new Date(a.at).toLocaleString('vi-VN')}</small></p>)}</details>}{!done && !cancelled && <div className="shop-cancel">{confirmCancel ? <><p>Bạn muốn hủy đơn hàng này?</p><button className="shop-button danger" disabled={busy} onClick={() => void cancel()}>Xác nhận hủy</button><button className="shop-text-button" onClick={() => setConfirmCancel(false)}>Giữ lại đơn</button></> : <button className="shop-text-button" onClick={() => setConfirmCancel(true)}>Hủy đơn hàng</button>}</div>}</section></div><Summary items={order.items} total={order.total}>{done || cancelled ? <Link to="/" className="shop-button">Tiếp tục mua sắm<ArrowRight size={17}/></Link> : <button className="shop-button" disabled={busy} onClick={() => void pay()}>{busy ? 'Đang xử lý…' : failed ? 'Thử thanh toán lại' : `Thanh toán ${money(order.total)}`}<ArrowRight size={17}/></button>}</Summary></div></div>;
}
