import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    role: text('role').notNull().default('customer'), // 'customer' | 'admin'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_email_idx').on(table.email)]
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('password_reset_user_idx').on(table.userId)]
);

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  contactNumber: text('contact_number').notNull(),
  operatingHours: text('operating_hours').notNull(),
  deliveryFeeCents: integer('delivery_fee_cents').notNull().default(3500),
  isAvailable: boolean('is_available').notNull().default(true),
  supportsCod: boolean('supports_cod').notNull().default(true),
  supportsGcash: boolean('supports_gcash').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  fullName: text('full_name').notNull().default(''),
  phone: text('phone').notNull().default(''),
  avatarUrl: text('avatar_url'),
  preferredBranchId: integer('preferred_branch_id').references(() => branches.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'restrict' })
      .notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull(),
    priceCents: integer('price_cents').notNull(),
    imageUrl: text('image_url').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    isBestSeller: boolean('is_best_seller').notNull().default(false),
    badgeText: text('badge_text'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('products_category_idx').on(table.categoryId)]
);

export const productOptions = pgTable(
  'product_options',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    priceDeltaCents: integer('price_delta_cents').notNull().default(0),
    isAvailable: boolean('is_available').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('product_options_product_idx').on(table.productId)]
);

export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  stockQuantity: integer('stock_quantity').notNull().default(50),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(10),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const carts = pgTable(
  'carts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull().unique(),
    branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('carts_user_idx').on(table.userId)]
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    cartId: integer('cart_id')
      .references(() => carts.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    quantity: integer('quantity').notNull().default(1),
    selectedOptionIdsJson: text('selected_option_ids_json').notNull().default('[]'),
    unitPriceCents: integer('unit_price_cents').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('cart_items_cart_idx').on(table.cartId)]
);

export const addresses = pgTable(
  'addresses',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    label: text('label').notNull().default('Home'),
    recipientName: text('recipient_name').notNull(),
    phone: text('phone').notNull(),
    streetAddress: text('street_address').notNull(),
    city: text('city').notNull(),
    notes: text('notes').default(''),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('addresses_user_idx').on(table.userId)]
);

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  discountType: text('discount_type').notNull().default('percent'), // 'percent' | 'fixed'
  discountValue: integer('discount_value').notNull(), // percent (e.g. 10) or cents (e.g. 2500)
  minOrderCents: integer('min_order_cents').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    branchId: integer('branch_id')
      .references(() => branches.id, { onDelete: 'restrict' })
      .notNull(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    deliveryAddress: text('delivery_address').notNull(),
    fulfillmentType: text('fulfillment_type').notNull(), // 'delivery' | 'pickup'
    pickupTime: text('pickup_time'),
    paymentMethod: text('payment_method').notNull(), // 'cod' | 'cop' | 'gcash'
    paymentStatus: text('payment_status').notNull().default('Pending'),
    status: text('status').notNull().default('Pending'),
    subtotalCents: integer('subtotal_cents').notNull(),
    deliveryFeeCents: integer('delivery_fee_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    grandTotalCents: integer('grand_total_cents').notNull(),
    couponCode: text('coupon_code'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_user_idx').on(table.userId),
    index('orders_status_idx').on(table.status),
    index('orders_created_idx').on(table.createdAt),
  ]
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
    optionsSummary: text('options_summary').notNull().default(''),
    lineTotalCents: integer('line_total_cents').notNull(),
  },
  (table) => [index('order_items_order_idx').on(table.orderId)]
);

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    method: text('method').notNull(),
    amountCents: integer('amount_cents').notNull(),
    status: text('status').notNull().default('Pending'),
    referenceCode: text('reference_code'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('payments_order_idx').on(table.orderId)]
);

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('reviews_product_idx').on(table.productId)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

export const favorites = pgTable(
  'favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('favorites_user_product_uidx').on(table.userId, table.productId)]
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  addresses: many(addresses),
  orders: many(orders),
  reviews: many(reviews),
  notifications: many(notifications),
  favorites: many(favorites),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  options: many(productOptions),
  inventory: one(inventory, { fields: [products.id], references: [inventory.productId] }),
  reviews: many(reviews),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  branch: one(branches, { fields: [orders.branchId], references: [branches.id] }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
