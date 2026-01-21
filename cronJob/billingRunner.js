// billingRunner.js
const { prisma, getTierForPlan, calculateInvoiceAmount } = require('./utils/billingUtils');

async function generateInvoicesForAll() {
  const subs = await prisma.restaurant_subscriptions.findMany({
    where: { is_active: true },
    include: { plan: { include: { plan_tiers: true } } }
  });

  for (const s of subs) {
    const usageOrders = await prisma.orders.count({
      where: {
        restaurant_id: s.restaurant_id,
        created_at: { gte: s.start_date, lt: s.next_billing_at }
      }
    });
    const salesAgg = await prisma.orders.aggregate({
      _sum: { net_amount: true },
      where: {
        restaurant_id: s.restaurant_id,
        created_at: { gte: s.start_date, lt: s.next_billing_at }
      }
    });
    const usageSales = Number(salesAgg._sum.net_amount ?? 0);
    const tier = await getTierForPlan(s.plan_id, usageOrders);
    const plan = s.plan;
    const { amount, breakdown } = calculateInvoiceAmount(plan, tier, usageOrders, usageSales);

    await prisma.invoices.create({
      data: {
        restaurant_id: s.restaurant_id,
        invoice_no: `INV-${s.plan_id}-${Date.now()}`,
        amount,
        currency: plan.currency ?? 'INR',
        status: 'Pending',
        metadata: { usageOrders, usageSales, breakdown, plan_name: plan.name, period_start: s.start_date, period_end: s.next_billing_at }
      }
    });

    // Move billing window forward
    const next = new Date(s.next_billing_at);
    const newNext = new Date(next.getTime() + (plan.duration_days ?? 30) * 24 * 3600 * 1000);
    await prisma.restaurant_subscriptions.update({
      where: { id: s.id },
      data: { start_date: next, next_billing_at: newNext, usage_orders: 0, usage_sales: 0 }
    });
  }
}

module.exports = { generateInvoicesForAll };
