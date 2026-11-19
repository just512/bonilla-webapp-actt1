import bcrypt from 'bcryptjs';
import { count } from 'drizzle-orm';
import { db } from './index.ts';
import {
  addresses,
  branches,
  categories,
  coupons,
  inventory,
  notifications,
  orderItems,
  orders,
  payments,
  productOptions,
  products,
  profiles,
  reviews,
  users,
} from './schema.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existingCategories = await db.select({ total: count() }).from(categories);
  if (Number(existingCategories[0]?.total || 0) > 0) {
    return;
  }

  console.log('Seeding Angel\'s Burger Online PostgreSQL database...');

  // 1. Seed Branches
  const insertedBranches = await db
    .insert(branches)
    .values([
      {
        name: 'España Boulevard Branch',
        address: '1420 España Blvd, Sampaloc, Manila',
        contactNumber: '+63 917 555 0101',
        operatingHours: 'Open 24 Hours Daily',
        deliveryFeeCents: 3500,
        isAvailable: true,
        supportsCod: true,
        supportsGcash: true,
      },
      {
        name: 'Katipunan Avenue Branch',
        address: '305 Katipunan Ave, Loyola Heights, Quezon City',
        contactNumber: '+63 917 555 0202',
        operatingHours: '6:00 AM – 2:00 AM Daily',
        deliveryFeeCents: 4500,
        isAvailable: true,
        supportsCod: true,
        supportsGcash: true,
      },
      {
        name: 'Makati Chino Roces Branch',
        address: '880 Chino Roces Ave, San Antonio, Makati',
        contactNumber: '+63 917 555 0303',
        operatingHours: '7:00 AM – 12:00 MN Daily',
        deliveryFeeCents: 4000,
        isAvailable: true,
        supportsCod: true,
        supportsGcash: true,
      },
    ])
    .returning();

  // 2. Seed Categories
  const insertedCategories = await db
    .insert(categories)
    .values([
      {
        name: 'Buy 1 Take 1',
        slug: 'buy-1-take-1',
        description: 'Classic paired burgers cooked fresh on the flat-top grill.',
        sortOrder: 1,
        isActive: true,
      },
      {
        name: 'Burgers',
        slug: 'burgers',
        description: 'Single and double patty specialty burgers with melted cheddar.',
        sortOrder: 2,
        isActive: true,
      },
      {
        name: 'Hotdogs',
        slug: 'hotdogs',
        description: 'Savory grilled footlong hotdogs and sausages in toasted buns.',
        sortOrder: 3,
        isActive: true,
      },
      {
        name: 'Sandwiches',
        slug: 'sandwiches',
        description: 'Crispy chicken fillets and warm toasted deli melts.',
        sortOrder: 4,
        isActive: true,
      },
      {
        name: 'Drinks',
        slug: 'drinks',
        description: 'Ice-cold house iced tea, citrus coolers, and refreshments.',
        sortOrder: 5,
        isActive: true,
      },
      {
        name: 'Other Available Products',
        slug: 'other-available-products',
        description: 'Value bundles, crispy seasoned fries, and savory sides.',
        sortOrder: 6,
        isActive: true,
      },
    ])
    .returning();

  const catMap = Object.fromEntries(insertedCategories.map((c) => [c.slug, c.id]));

  // 3. Seed Products
  const insertedProducts = await db
    .insert(products)
    .values([
      {
        categoryId: catMap['buy-1-take-1'],
        name: 'Classic Beef Burger (Buy 1 Take 1)',
        slug: 'classic-beef-burger-b1t1',
        description:
          'Two freshly seared beef patties in soft sesame buns layered with signature burger dressing and crisp pickles.',
        priceCents: 5200,
        imageUrl: '/src/assets/images/menu_classic_burger_1795052474012.jpg',
        isAvailable: true,
        isFeatured: true,
        isBestSeller: true,
        badgeText: 'Best Seller',
      },
      {
        categoryId: catMap['buy-1-take-1'],
        name: 'Cheesy Classic Duo (Buy 1 Take 1)',
        slug: 'cheesy-classic-duo-b1t1',
        description:
          'Two sizzling beef burgers topped with melted golden cheddar cheese, caramelized onions, and house sauce.',
        priceCents: 6800,
        imageUrl: '/src/assets/images/menu_classic_burger_1795052474012.jpg',
        isAvailable: true,
        isFeatured: true,
        isBestSeller: true,
        badgeText: 'Crowd Favorite',
      },
      {
        categoryId: catMap['burgers'],
        name: 'Double Flame Cheeseburger',
        slug: 'double-flame-cheeseburger',
        description:
          'Twin thick beef patties stacked with double cheddar slices, crisp lettuce, vine tomato, and smoky grill glaze.',
        priceCents: 11500,
        imageUrl: '/src/assets/images/hero_burger_feast_1795052474885.jpg',
        isAvailable: true,
        isFeatured: true,
        isBestSeller: true,
        badgeText: 'House Special',
      },
      {
        categoryId: catMap['burgers'],
        name: 'All-Day Egg & Cheese Burger',
        slug: 'all-day-egg-cheese-burger',
        description:
          'Juicy grilled patty paired with a sunny fried egg, cheddar melt, and pepper mayo on a toasted bun.',
        priceCents: 7900,
        imageUrl: '/src/assets/images/menu_classic_burger_1795052474012.jpg',
        isAvailable: true,
        isFeatured: false,
        isBestSeller: false,
        badgeText: null,
      },
      {
        categoryId: catMap['hotdogs'],
        name: 'Cheesy Footlong Hotdog',
        slug: 'cheesy-footlong-hotdog',
        description:
          'Full 12-inch grilled savory frankfurter drizzled with warm cheddar cheese sauce, tangy ketchup, and sweet relish.',
        priceCents: 6900,
        imageUrl: '/src/assets/images/menu_footlong_hotdog_1795052474706.jpg',
        isAvailable: true,
        isFeatured: true,
        isBestSeller: true,
        badgeText: 'Top Pick',
      },
      {
        categoryId: catMap['hotdogs'],
        name: 'Hungarian Garlic Sausage Roll',
        slug: 'hungarian-garlic-sausage-roll',
        description:
          'Smoky spiced Hungarian sausage nestled in a butter-toasted roll with roasted garlic mayo and mustard.',
        priceCents: 8900,
        imageUrl: '/src/assets/images/menu_footlong_hotdog_1795052474706.jpg',
        isAvailable: true,
        isFeatured: false,
        isBestSeller: false,
        badgeText: null,
      },
      {
        categoryId: catMap['sandwiches'],
        name: 'Crispy Chicken Slaw Sandwich',
        slug: 'crispy-chicken-slaw-sandwich',
        description:
          'Crunchy golden chicken fillet topped with fresh shredded cabbage slaw, dill pickles, and creamy herb dressing.',
        priceCents: 9500,
        imageUrl: '/src/assets/images/menu_crispy_sandwich_1795052475428.jpg',
        isAvailable: true,
        isFeatured: true,
        isBestSeller: false,
        badgeText: 'Crispy Hit',
      },
      {
        categoryId: catMap['sandwiches'],
        name: 'Toasted Ham & Egg Clubhouse',
        slug: 'toasted-ham-egg-clubhouse',
        description:
          'Griddled sweet ham, fluffy folded egg, and cheddar cheese pressed in a warm brioche bun.',
        priceCents: 6500,
        imageUrl: '/src/assets/images/menu_crispy_sandwich_1795052475428.jpg',
        isAvailable: true,
        isFeatured: false,
        isBestSeller: false,
        badgeText: null,
      },
      {
        categoryId: catMap['drinks'],
        name: 'House Lemon Iced Tea',
        slug: 'house-lemon-iced-tea',
        description:
          'Freshly brewed black tea shaken over ice with bright calamansi-lemon citrus notes.',
        priceCents: 3500,
        imageUrl: '/src/assets/images/menu_iced_drinks_1795052476003.jpg',
        isAvailable: true,
        isFeatured: false,
        isBestSeller: true,
        badgeText: null,
      },
      {
        categoryId: catMap['drinks'],
        name: 'Sparkling Citrus Cooler',
        slug: 'sparkling-citrus-cooler',
        description:
          'Chilled orange and citrus fizz served tall with crushed ice and fresh mint.',
        priceCents: 4200,
        imageUrl: '/src/assets/images/menu_iced_drinks_1795052476003.jpg',
        isAvailable: true,
        isFeatured: false,
        isBestSeller: false,
        badgeText: null,
      },
      {
        categoryId: catMap['other-available-products'],
        name: 'Barkada Double Burger Bundle',
        slug: 'barkada-double-burger-bundle',
        description:
          'Two Double Flame Cheeseburgers, two portions of crispy seasoned crinkle fries, and two iced drinks.',
        priceCents: 26500,
        imageUrl: '/src/assets/images/promo_combo_meal_1795052475798.jpg',
        isAvailable: true,
        isFeatured: true,
        isBestSeller: true,
        badgeText: 'Group Saver',
      },
      {
        categoryId: catMap['other-available-products'],
        name: 'Golden Crinkle Fries (Large)',
        slug: 'golden-crinkle-fries-large',
        description:
          'Thick-cut crinkle fries cooked crisp to order, lightly seasoned and served with house ketchup dip.',
        priceCents: 5500,
        imageUrl: '/src/assets/images/promo_combo_meal_1795052475798.jpg',
        isAvailable: true,
        isFeatured: false,
        isBestSeller: false,
        badgeText: null,
      },
    ])
    .returning();

  // 4. Seed Product Options & Inventory
  for (let i = 0; i < insertedProducts.length; i++) {
    const product = insertedProducts[i];
    const isDrink = product.categoryId === catMap['drinks'];
    if (isDrink) {
      await db.insert(productOptions).values([
        { productId: product.id, name: 'Upsize to Large (22oz)', priceDeltaCents: 1500, isAvailable: true },
        { productId: product.id, name: 'Less Ice', priceDeltaCents: 0, isAvailable: true },
      ]);
    } else {
      await db.insert(productOptions).values([
        { productId: product.id, name: 'Extra Melted Cheese', priceDeltaCents: 1800, isAvailable: true },
        { productId: product.id, name: 'Add Fried Egg', priceDeltaCents: 2000, isAvailable: true },
        { productId: product.id, name: 'Extra Spicy Dressing', priceDeltaCents: 1000, isAvailable: true },
      ]);
    }

    // Set varied stock including a couple low-stock items for Admin Inventory alerts
    const stockQuantity = i === 5 ? 6 : i === 9 ? 8 : 45 + (i % 4) * 15;
    await db.insert(inventory).values({
      productId: product.id,
      stockQuantity,
      lowStockThreshold: 10,
    });
  }

  // 5. Seed Coupons
  await db.insert(coupons).values([
    {
      code: 'BURGER10',
      description: '10% off orders ₱150 and above',
      discountType: 'percent',
      discountValue: 10,
      minOrderCents: 15000,
      isActive: true,
    },
    {
      code: 'MERIENDA25',
      description: '₱25 off orders ₱200 and above',
      discountType: 'fixed',
      discountValue: 2500,
      minOrderCents: 20000,
      isActive: true,
    },
  ]);

  // 6. Seed Sample Users (Admin + Demo Customers)
  const adminHash = await bcrypt.hash('Admin@2026', 10);
  const customerHash = await bcrypt.hash('Burger@2026', 10);

  const insertedUsers = await db
    .insert(users)
    .values([
      {
        uid: 'seed_admin_001',
        email: 'admin@angelsburger.ph',
        passwordHash: adminHash,
        role: 'admin',
      },
      {
        uid: 'seed_cust_001',
        email: 'marco.reyes@example.com',
        passwordHash: customerHash,
        role: 'customer',
      },
      {
        uid: 'seed_cust_002',
        email: 'camille.santos@example.com',
        passwordHash: customerHash,
        role: 'customer',
      },
      {
        uid: 'seed_cust_003',
        email: 'paolo.mendoza@example.com',
        passwordHash: customerHash,
        role: 'customer',
      },
    ])
    .returning();

  await db.insert(profiles).values([
    {
      userId: insertedUsers[0].id,
      fullName: 'Store Operations Manager',
      phone: '+63 917 555 0100',
      preferredBranchId: insertedBranches[0].id,
    },
    {
      userId: insertedUsers[1].id,
      fullName: 'Marco Reyes',
      phone: '+63 917 812 4401',
      preferredBranchId: insertedBranches[0].id,
    },
    {
      userId: insertedUsers[2].id,
      fullName: 'Camille Santos',
      phone: '+63 918 334 9920',
      preferredBranchId: insertedBranches[1].id,
    },
    {
      userId: insertedUsers[3].id,
      fullName: 'Paolo Mendoza',
      phone: '+63 919 770 1284',
      preferredBranchId: insertedBranches[2].id,
    },
  ]);

  await db.insert(addresses).values([
    {
      userId: insertedUsers[1].id,
      label: 'Home',
      recipientName: 'Marco Reyes',
      phone: '+63 917 812 4401',
      streetAddress: '418 P. Noval St, Sampaloc',
      city: 'Manila',
      notes: 'Red gate beside bakery',
      isDefault: true,
    },
    {
      userId: insertedUsers[2].id,
      label: 'Dorm',
      recipientName: 'Camille Santos',
      phone: '+63 918 334 9920',
      streetAddress: '22 Esteban Abada St, Loyola Heights',
      city: 'Quezon City',
      notes: 'Leave at lobby desk',
      isDefault: true,
    },
  ]);

  // 7. Seed Reviews
  await db.insert(reviews).values([
    {
      productId: insertedProducts[0].id,
      userId: insertedUsers[1].id,
      authorName: 'Marco Reyes',
      rating: 5,
      comment: 'Still hot when it arrived. Great value for late-night study sessions.',
    },
    {
      productId: insertedProducts[2].id,
      userId: insertedUsers[2].id,
      authorName: 'Camille Santos',
      rating: 5,
      comment: 'Double patty with extra melted cheese hits the spot every single time.',
    },
    {
      productId: insertedProducts[4].id,
      userId: insertedUsers[3].id,
      authorName: 'Paolo Mendoza',
      rating: 4,
      comment: 'Generous cheese drizzle on the footlong and fast pickup turnaround.',
    },
  ]);

  // 8. Seed Realistic Historical Orders for Analytics & Order Management
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const sampleOrdersData = [
    {
      orderNumber: 'AB-2026-1001',
      userId: insertedUsers[1].id,
      branchId: insertedBranches[0].id,
      customerName: 'Marco Reyes',
      customerPhone: '+63 917 812 4401',
      deliveryAddress: '418 P. Noval St, Sampaloc, Manila',
      fulfillmentType: 'delivery',
      paymentMethod: 'cod',
      paymentStatus: 'Paid',
      status: 'Completed',
      product: insertedProducts[0],
      qty: 2,
      deliveryFee: 3500,
      createdAt: new Date(now - 6 * dayMs),
    },
    {
      orderNumber: 'AB-2026-1002',
      userId: insertedUsers[2].id,
      branchId: insertedBranches[1].id,
      customerName: 'Camille Santos',
      customerPhone: '+63 918 334 9920',
      deliveryAddress: 'Pickup at Katipunan Avenue Branch',
      fulfillmentType: 'pickup',
      pickupTime: '12:30 PM',
      paymentMethod: 'cop',
      paymentStatus: 'Paid',
      status: 'Completed',
      product: insertedProducts[10],
      qty: 1,
      deliveryFee: 0,
      createdAt: new Date(now - 4 * dayMs),
    },
    {
      orderNumber: 'AB-2026-1003',
      userId: insertedUsers[3].id,
      branchId: insertedBranches[2].id,
      customerName: 'Paolo Mendoza',
      customerPhone: '+63 919 770 1284',
      deliveryAddress: '880 Chino Roces Ext, Makati',
      fulfillmentType: 'delivery',
      paymentMethod: 'gcash',
      paymentStatus: 'Paid',
      status: 'Completed',
      product: insertedProducts[2],
      qty: 2,
      deliveryFee: 4000,
      createdAt: new Date(now - 2 * dayMs),
    },
    {
      orderNumber: 'AB-2026-1004',
      userId: insertedUsers[1].id,
      branchId: insertedBranches[0].id,
      customerName: 'Marco Reyes',
      customerPhone: '+63 917 812 4401',
      deliveryAddress: '418 P. Noval St, Sampaloc, Manila',
      fulfillmentType: 'delivery',
      paymentMethod: 'cod',
      paymentStatus: 'Pending',
      status: 'Preparing',
      product: insertedProducts[4],
      qty: 2,
      deliveryFee: 3500,
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    },
    {
      orderNumber: 'AB-2026-1005',
      userId: insertedUsers[2].id,
      branchId: insertedBranches[1].id,
      customerName: 'Camille Santos',
      customerPhone: '+63 918 334 9920',
      deliveryAddress: 'Pickup at Katipunan Avenue Branch',
      fulfillmentType: 'pickup',
      pickupTime: 'ASAP (15 mins)',
      paymentMethod: 'gcash',
      paymentStatus: 'Paid',
      status: 'Pending',
      product: insertedProducts[6],
      qty: 1,
      deliveryFee: 0,
      createdAt: new Date(now - 25 * 60 * 1000),
    },
  ];

  for (const item of sampleOrdersData) {
    const subtotalCents = item.product.priceCents * item.qty;
    const grandTotalCents = subtotalCents + item.deliveryFee;
    const insertedOrder = await db
      .insert(orders)
      .values({
        orderNumber: item.orderNumber,
        userId: item.userId,
        branchId: item.branchId,
        customerName: item.customerName,
        customerPhone: item.customerPhone,
        deliveryAddress: item.deliveryAddress,
        fulfillmentType: item.fulfillmentType,
        pickupTime: item.pickupTime || null,
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus,
        status: item.status,
        subtotalCents,
        deliveryFeeCents: item.deliveryFee,
        discountCents: 0,
        grandTotalCents,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: insertedOrder[0].id,
      productId: item.product.id,
      productName: item.product.name,
      unitPriceCents: item.product.priceCents,
      quantity: item.qty,
      optionsSummary: 'Standard preparation',
      lineTotalCents: subtotalCents,
    });

    await db.insert(payments).values({
      orderId: insertedOrder[0].id,
      method: item.paymentMethod,
      amountCents: grandTotalCents,
      status: item.paymentStatus,
      referenceCode: item.paymentMethod === 'gcash' ? `GC-${item.orderNumber.slice(-4)}` : null,
      paidAt: item.paymentStatus === 'Paid' ? item.createdAt : null,
    });

    await db.insert(notifications).values({
      userId: item.userId,
      orderId: insertedOrder[0].id,
      title: `Order ${item.orderNumber} ${item.status}`,
      message: `Your order at Angel's Burger Online is currently ${item.status}.`,
      isRead: item.status === 'Completed',
      createdAt: item.createdAt,
    });
  }

  console.log('Seed completed successfully.');
}
