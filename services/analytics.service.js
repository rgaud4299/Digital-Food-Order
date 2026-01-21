// services/analytics.service.js
const prisma = require("../utils/prisma");
const { subDays, startOfDay, endOfDay } = require("date-fns");

// 🔹 1. Get order summary stats
async function getOrderStats(restaurant_id, days = 30) {
  const since = subDays(new Date(), days);
  console.log('restaurant_id', BigInt(restaurant_id));

  const orders = await prisma.orders.findMany({
    where: {
      restaurant_id: BigInt(restaurant_id)
      // created_at: { gte: since },
      // status: { in: ["Pending"] },
    }
  });
  console.log('orders', orders);

  const summary = {
    total_orders: orders.length,
    total_sales: 0,
    avg_order_value: 0,
    dine_in: 0,
    delivery: 0,
    pickup: 0,
  };

  for (const o of orders) {
    summary.total_sales += Number(o.net_amount);
    if (o.delivery_type === "dine_in") summary.dine_in++;
    if (o.delivery_type === "pickup") summary.pickup++;
  }

  summary.avg_order_value =
    summary.total_orders > 0
      ? summary.total_sales / summary.total_orders
      : 0;

  return summary;
}

// 🔹 2. Get payout + subscription stats
async function getFinanceStats(restaurant_id) {
  const [payouts, invoices] = await Promise.all([
    prisma.payouts.findMany({
      where: { restaurant_id: BigInt(restaurant_id) },
      select: { amount: true, status: true },
    }),
    prisma.invoices.findMany({
      where: { restaurant_id: BigInt(restaurant_id) },
      select: { amount: true, status: true },
    }),
  ]);

  const total_payouts = payouts.reduce(
    (acc, p) => acc + Number(p.amount || 0),
    0
  );
  const total_invoices = invoices.reduce(
    (acc, i) => acc + Number(i.amount || 0),
    0
  );

  return {
    total_payouts,
    total_invoices,
    net_balance: total_payouts - total_invoices,
  };
}

// 🔹 3. Get time-series (daily sales trend)
async function getDailySales(restaurant_id, days = 7) {
  const since = subDays(new Date(), days);

  const orders = await prisma.orders.groupBy({
    by: ["created_at"],
    where: {
      restaurant_id: BigInt(restaurant_id),
      created_at: { gte: since },
      status: { in: ["Completed"] }
    },
    _sum: { net_amount: true },
    orderBy: { created_at: "asc" },
  });

  const data = {};
  for (const o of orders) {
    const day = startOfDay(o.created_at).toISOString().split("T")[0];
    data[day] = (data[day] || 0) + Number(o._sum.net_amount || 0);
  }

  return data;
}

module.exports = { getOrderStats, getFinanceStats, getDailySales };
