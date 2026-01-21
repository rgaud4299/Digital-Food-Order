// utils/billingUtils.js

const prisma = require("../utils/prisma");


/**
 * Choose tier by number of orders (if tiers defined), otherwise null
 */
async function getTierForPlan(planId, ordersCount) {
  const tiers = await prisma.subscription_tiers.findMany({
    where: { plan_id: planId },
    orderBy: [{ order_min: 'asc' }]
  });
  if (!tiers || tiers.length === 0) return null;
  for (const t of tiers) {
    const min = t.order_min ?? -Infinity;
    const max = t.order_max ?? Infinity;
    if (ordersCount >= min && ordersCount <= max) return t;
  }
  // fallback to last tier
  return tiers[tiers.length - 1];
}

/**
 * calculateInvoiceAmount(plan, tier, usageOrders, usageSales)
 * returns { amount, breakdown }
 */
function calculateInvoiceAmount(plan, tier, usageOrders = 0, usageSales = 0) {
  // convert decimal-like to numbers safely
  const basePrice = Number(plan.base_price ?? 0);
  const metricRate = Number(plan.metric_rate ?? 0);
  const minBill = Number(plan.min_bill_amount ?? 0);
  const extraChargeRate = Number(plan.extra_charge_rate ?? 0);
  const commissionRate = Number(plan.commission_rate ?? 0); // percent

  let total = 0;
  const breakdown = {};

  if (plan.plan_type === 'Prepaid') {
    // fixed base: either plan.base_price or tier.fixed_price if defined
    const fixed = tier && tier.fixed_price ? Number(tier.fixed_price) : basePrice;
    total += fixed;
    breakdown.base = fixed;

    if (plan.max_orders_limit && usageOrders > plan.max_orders_limit) {
      const extraOrders = usageOrders - plan.max_orders_limit;
      const extra = extraOrders * extraChargeRate;
      total += extra;
      breakdown.extra_orders = extraOrders;
      breakdown.extra_amount = extra;
    }
    // add commission pct if plan has commission_rate (some prepaid also take commission)
    if (commissionRate > 0) {
      const comm = (usageSales * commissionRate) / 100.0;
      total += comm;
      breakdown.commission = comm;
    }
  } else if (plan.plan_type === 'Postpaid') {
    if (plan.billing_metric === 'Orders') {
      const charge = usageOrders * metricRate;
      total = Math.max(charge, minBill);
      breakdown.orders_charge = charge;
    } else if (plan.billing_metric === 'Sales') {
      const charge = (usageSales * metricRate) / 100.0;
      total = Math.max(charge, minBill);
      breakdown.sales_charge = charge;
    } else {
      // fallback: metricRate * usageOrders
      total = Math.max(usageOrders * metricRate, minBill);
    }
    // if tiers exist, apply tier commission_percent if set
    if (tier && tier.commission_percent) {
      const tcomm = (usageSales * Number(tier.commission_percent)) / 100.0;
      total = Math.max(total, tcomm);
      breakdown.tier_commission = tcomm;
    }
  } else if (plan.plan_type === 'Hybrid') {
    const fixed = basePrice;
    total += fixed;
    breakdown.base = fixed;
    // metricRate treat as per-order ₹
    const usageCharge = usageOrders * metricRate;
    total += usageCharge;
    breakdown.usage_charge = usageCharge;
    if (plan.max_orders_limit && usageOrders > plan.max_orders_limit) {
      const extra = (usageOrders - plan.max_orders_limit) * extraChargeRate;
      total += extra;
      breakdown.extra_amount = extra;
    }
  }

  // ensure min bill
  if (minBill > 0 && total < minBill) {
    breakdown.enforced_min_bill = minBill;
    total = Number(minBill);
  }

  breakdown.total = Number(total.toFixed(2));
  return { amount: Number(total.toFixed(2)), breakdown };
}

module.exports = {
  prisma,
  getTierForPlan,
  calculateInvoiceAmount,
};
