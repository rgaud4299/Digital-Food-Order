// services/orderStatus.service.js
const prisma = require('../utils/prisma');
const { sendNotification } = require('./notification.service');
const { ISTDate } = require('../utils/helper');

// 🔹 Update order status & notify both ends
async function updateOrderStatus(order_id, newStatus, changed_by = null, note = null) {
  try {
    const now = ISTDate();

    // 1️⃣ Find the order
    const order = await prisma.orders.findUnique({
      where: { id: BigInt(order_id) },
      select: { id: true, order_no: true, restaurant_id: true, customer_id: true, status: true },
    });

    if (!order) throw new Error("Order not found");

    const oldStatus = order.status;

    // 2️⃣ Update status in DB
    await prisma.orders.update({
      where: { id: BigInt(order_id) },
      data: { status: newStatus, updated_at: now },
    });

    // 3️⃣ Log history
    await prisma.order_status_history.create({
      data: {
        order_id: BigInt(order_id),
        from_status: oldStatus,
        to_status: newStatus,
        changed_by: changed_by ? BigInt(changed_by) : null,
        note,
        created_at: now,
      },
    });

    // 4️⃣ Save event for auditing
    await prisma.order_events.create({
      data: {
        order_id: BigInt(order_id),
        event_type: newStatus,
        payload: { updated_by: changed_by || "System", note },
      },
    });

    // 5️⃣ Notify kitchen + customer
    sendNotification("orderStatusUpdated", {
      order_id,
      order_no: order.order_no,
      from_status: oldStatus,
      to_status: newStatus,
      message: `Order is now ${newStatus}`,
    }, [
      `restaurant_${order.restaurant_id}`,
      `customer_${order.customer_id}`,
    ]);

    console.log(`✅ Order ${order_id} moved ${oldStatus} → ${newStatus}`);
    return { success: true, newStatus };
  } catch (err) {
    console.error("❌ updateOrderStatus failed:", err);
    return { success: false, message: err.message };
  }
}

module.exports = { updateOrderStatus };
