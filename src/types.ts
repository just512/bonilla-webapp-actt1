export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready for Pickup'
  | 'Out for Delivery'
  | 'Completed'
  | 'Cancelled';

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductOption {
  id: number;
  productId: number;
  name: string;
  priceDeltaCents: number;
  isAvailable: boolean;
}

export interface ProductReview {
  id: number;
  productId: number;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  badgeText: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  inStock: boolean;
  options: ProductOption[];
  reviewCount: number;
  avgRating: number;
  reviews: ProductReview[];
}

export interface Branch {
  id: number;
  name: string;
  address: string;
  contactNumber: string;
  operatingHours: string;
  deliveryFeeCents: number;
  isAvailable: boolean;
  supportsCod: boolean;
  supportsGcash: boolean;
}

export interface Promotion {
  code: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderCents: number;
}

export interface CartItem {
  id: number;
  productId: number;
  productName: string;
  imageUrl: string;
  isAvailable: boolean;
  quantity: number;
  selectedOptions: Array<{ id: number; name: string; priceDeltaCents: number }>;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  optionsSummary: string;
  lineTotalCents: number;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  userId: number | null;
  branchId: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  fulfillmentType: 'delivery' | 'pickup';
  pickupTime: string | null;
  paymentMethod: 'cod' | 'cop' | 'gcash';
  paymentStatus: string;
  status: OrderStatus;
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  grandTotalCents: number;
  couponCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: Branch | null;
  branchName?: string;
  items?: OrderItem[];
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  role: 'customer' | 'admin';
  fullName: string;
  phone: string;
  preferredBranchId?: number | null;
}

export interface Address {
  id: number;
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  city: string;
  notes: string | null;
  isDefault: boolean;
}

export interface AppNotification {
  id: number;
  orderId: number | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
