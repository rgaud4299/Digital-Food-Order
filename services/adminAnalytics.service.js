// services/adminAnalytics.service.js
const prisma = require("../utils/prisma");
const { subDays, startOfDay } = require("date-fns");

// 📊 GLOBAL SUMMARY — All Restaurants
async function getGlobalSummary(days = 30) {
  const since = subDays(new Date(), days);

  const [orders, restaurants, payouts, invoices] = await Promise.all([
    prisma.orders.findMany({
      where: { created_at: { gte: since }, status: { in: ["Completed", "Paid"] } },
      select: { id: true, restaurant_id: true, total_amount: true, net_amount: true, delivery_type: true }
    }),
    prisma.restaurants.findMany({ select: { id: true, name: true } }),
    prisma.payouts.findMany({ select: { amount: true, restaurant_id: true } }),
    prisma.invoices.findMany({ select: { amount: true, restaurant_id: true } }),
  ]);

  const total_sales = orders.reduce((a, o) => a + Number(o.net_amount || 0), 0);
  const total_orders = orders.length;
  const total_restaurants = restaurants.length;
  const total_payouts = payouts.reduce((a, p) => a + Number(p.amount || 0), 0);
  const total_invoices = invoices.reduce((a, i) => a + Number(i.amount || 0), 0);

  return {
    total_sales,
    total_orders,
    total_restaurants,
    total_payouts,
    total_invoices,
    net_balance: total_payouts - total_invoices,
  };
}

// 🥇 TOP RESTAURANTS BY REVENUE
async function getTopRestaurants(limit = 5, days = 30) {
  const since = subDays(new Date(), days);
  const grouped = await prisma.orders.groupBy({
    by: ["restaurant_id"],
    where: { created_at: { gte: since }, status: { in: ["Completed", "Paid"] } },
    _sum: { net_amount: true },
    orderBy: { _sum: { net_amount: "desc" } },
    take: limit,
  });

  const result = [];
  for (const g of grouped) {
    const restaurant = await prisma.restaurants.findUnique({
      where: { id: BigInt(g.restaurant_id) },
      select: { name: true, uuid: true },
    });
    result.push({
      restaurant_id: g.restaurant_id,
      restaurant_name: restaurant?.name || "Unknown",
      total_sales: Number(g._sum.net_amount || 0),
    });
  }

  return result;
}

// 🍕 ORDER DISTRIBUTION (for Pie Charts)
async function getOrderDistribution(days = 30) {
  const since = subDays(new Date(), days);
  const grouped = await prisma.orders.groupBy({
    by: ["delivery_type"],
    where: { created_at: { gte: since }, status: { in: ["Completed", "Paid"] } },
    _count: { _all: true },
  });

  const data = {};
  for (const g of grouped) {
    data[g.delivery_type || "unknown"] = g._count._all;
  }

  return data;
}

// 📈 SALES TREND (for Line/Bar Charts)
async function getSalesTrend(days = 7) {
  const since = subDays(new Date(), days);
  const grouped = await prisma.orders.groupBy({
    by: ["created_at"],
    where: { created_at: { gte: since }, status: { in: ["Completed", "Paid"] } },
    _sum: { net_amount: true },
    orderBy: { created_at: "asc" },
  });

  const data = {};
  for (const o of grouped) {
    const day = startOfDay(o.created_at).toISOString().split("T")[0];
    data[day] = (data[day] || 0) + Number(o._sum.net_amount || 0);
  }

  return data;
}

module.exports = {
  getGlobalSummary,
  getTopRestaurants,
  getOrderDistribution,
  getSalesTrend,
};
