const prisma = require("../utils/prisma");
const { generateRandomTxnId, ISTDate } = require("../utils/helper");
const { sendNotification } = require("../services/notification.service");


const orderProcessCheck = async ({ restaurant_id, table_id, customer_id, items, delivery_type, note }) => {
  try {
    if (!items?.length) {
      return { status: "FAILED", message: "No items provided." };
    }

    const restaurant = await prisma.restaurants.findUnique({
      where: { uuid: BigInt(restaurant_id) },
    });

    if (!restaurant || restaurant.status !== "Active") {
      return { status: "FAILED", message: "Restaurant not found or inactive." };
    }

    // ✅ Validate table (if dine-in)
    let table = null;
    if (delivery_type === "dine_in" && table_id) {
      table = await prisma.restaurant_tables.findUnique({
        where: { id: BigInt(table_id) },
      });
      if (!table) return { status: "FAILED", message: "Table not found." };
    }

    let totalAmount = 0;
    const validatedItems = [];

    // ✅ Validate each food item
    for (const i of items) {
      const item = await prisma.food_items.findUnique({
        where: { id: BigInt(i.food_item_id) },
        include: { food_variants: true, food_addons: true },
      });

      if (!item || item.status !== "Active") {
        return { status: "FAILED", message: `Item ${i.food_item_id} unavailable.` };
      }

      // 🔸 Variant handling
      let unitPrice = Number(item.food_variants[0]?.price ?? 0);
      if (i.variant_id) {
        const variant = await prisma.food_variants.findUnique({
          where: { id: BigInt(i.variant_id) },
        });
        if (variant && variant.is_available) unitPrice = Number(variant.price);
      }

      // 🔸 Addons
      let addonsList = [];
      if (i.addons?.length) {
        for (const ad of i.addons) {
          const addon = await prisma.food_addons.findUnique({
            where: { id: BigInt(ad.addon_id) },
          });
          if (addon && addon.is_available) {
            addonsList.push({ addon_id: addon.id, price: Number(addon.price) });
          }
        }
      }

      const addonTotal = addonsList.reduce((a, c) => a + c.price, 0);
      const itemTotal = (unitPrice * i.quantity) + addonTotal;
      totalAmount += itemTotal;

      validatedItems.push({
        food_item_id: item.id,
        variant_id: i.variant_id ? BigInt(i.variant_id) : null,
        quantity: i.quantity,
        unit_price: unitPrice,
        total_price: itemTotal,
        addons: addonsList,
      });
    }

    return {
      status: "SUCCESS",
      message: "Order validation passed.",
      data: {
        restaurant,
        table,
        customer_id,
        totalAmount,
        items: validatedItems,
        delivery_type,
        note,
      },
    };
  } catch (err) {
    console.error("❌ orderProcessCheck failed:", err);
    return { status: "FAILED", message: "Order validation failed." };
  }
};

const orderRequest = async (data) => {
  console.log("Order Request Data:", data);

  const { restaurant, table, customer_id, totalAmount, items, delivery_type, note } = data;
  const now = ISTDate();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ✅ Create order
      const order = await tx.orders.create({
        data: {
          restaurant_id: restaurant.uuid,
          table_id: table ? table.id : null,
          customer_id: customer_id ? BigInt(customer_id) : null,
          order_no: generateRandomTxnId("ORD"),
          delivery_type: delivery_type || "dine_in",
          total_amount: totalAmount,
          net_amount: totalAmount,
          currency: "INR",
          status: "Pending",
          created_at: now,
          updated_at: now,
          customer_note: note,
        },
      });

      // ✅ Create order items
      for (const item of items) {
        const createdItem = await tx.order_items.create({
          data: {
            order_id: order.id,
            food_item_id: item.food_item_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            created_at: now,
          },
        });

        // Addons
        if (item.addons?.length) {
          const addonsData = item.addons.map(ad => ({
            order_item_id: createdItem.id,
            addon_id: ad.addon_id,
            price: ad.price,
            created_at: now,
          }));
          await tx.order_addons.createMany({ data: addonsData });
        }
      }

      // ✅ Create kitchen ticket
      const kitchenTicket = await tx.kitchen_tickets.create({
        data: {
          restaurant_id: restaurant.uuid,
          order_id: order.id,
          ticket_no: generateRandomTxnId("KT"),
          status: "Pending",
          created_at: now,
        },
      });

      // ✅ Create kitchen ticket items
      const orderItemRecords = await tx.order_items.findMany({
        where: { order_id: order.id },
        select: { id: true, quantity: true },
      });

      if (orderItemRecords.length) {
        await tx.kitchen_tickets_items.createMany({
          data: orderItemRecords.map((oi) => ({
            ticket_id: kitchenTicket.id,
            order_item_id: oi.id,
            quantity: oi.quantity,
            status: "Pending",
            created_at: now,
          })),
        });
      }
      
      sendNotification('newOrder', {
        order_id: order.id,
        order_no: order.order_no,
        restaurant_id: restaurant.id,
      }, [
        `restaurant_${restaurant.id}`,  // notify kitchen
        `customer_${customer_id}`,      // notify customer
      ]);

      return { order };
    });
    const formattedOrder = {
      ...result.order,
      created_at: ISTDate(result.order.created_at),
      updated_at: ISTDate(result.order.updated_at),
    };
    return { status: "SUCCESS", message: "Order created successfully", data: formattedOrder };
  } catch (err) {
    console.error("❌ orderRequest failed:", err);
    return { status: "FAILED", message: err.message || "Failed to create order." };
  }
};

module.exports = { orderProcessCheck, orderRequest };
