// controllers/invoiceController.js

const { getTierForPlan,calculateInvoiceAmount } = require('../../Helper/billingUtils');
const prisma = require('../../utils/prisma');

/**
 * GET /api/invoices?restaurant_id=...
 */
async function listInvoices(req, res) {
  try {
    const where = {};
    if (req.query.restaurant_id) where.restaurant_id = BigInt(req.query.restaurant_id);
    const invoices = await prisma.invoices.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: invoices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/invoices/:id
 */
async function getInvoiceById(req, res) {
  try {
    const id = Number(req.params.id);
    const invoice = await prisma.invoices.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/invoices/mark-paid/:id
 * body: { payment_ref }
 */
async function markInvoicePaid(req, res) {
  try {
    const id = Number(req.params.id);
    const { payment_ref } = req.body;
    const invoice = await prisma.invoices.update({
      where: { id },
      data: { status: 'Paid', paid_at: new Date(), metadata: { ... (invoice?.metadata || {}), payment_ref } }
    });
    res.json({ success: true, message: 'Marked paid', data: invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/invoices/generate-manual
 * Manually trigger billing for a single restaurant or for all active
 * body: { restaurant_id? }
 */
async function generateInvoicesManual(req, res) {
  try {
    const { restaurant_id } = req.body;
    let subs;
    if (restaurant_id) {
      subs = await prisma.restaurant_subscriptions.findMany({
        where: { restaurant_id: BigInt(restaurant_id), is_active: true },
        include: { plan: { include: { plan_tiers: true } } }
      });
    } else {
      subs = await prisma.restaurant_subscriptions.findMany({
        where: { is_active: true },
        include: { plan: { include: { plan_tiers: true } } }
      });
    }

    const created = [];
    for (const s of subs) {
      // collect usage for the period - you must implement usage aggregation logic
      const usageOrders = await prisma.orders.count({
        where: {
          restaurant_id: s.restaurant_id,
          created_at: { gte: s.start_date, lt: s.next_billing_at } // this is a simplification
        }
      });

      // calculate sales
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

      const inv = await prisma.invoices.create({
        data: {
          restaurant_id: s.restaurant_id,
          invoice_no: `INV-${s.plan_id}-${Date.now()}`,
          amount: amount,
          currency: plan.currency ?? 'INR',
          status: 'Pending',
          metadata: { usageOrders, usageSales, breakdown, plan_name: plan.name, period_start: s.start_date, period_end: s.next_billing_at }
        }
      });

      // Update subscription usage & next billing cycle
      const nextBilling = new Date(s.next_billing_at);
      const newStart = nextBilling;
      const newNextBilling = new Date(nextBilling.getTime() + (plan.duration_days ?? 30) * 24 * 3600 * 1000);
      await prisma.restaurant_subscriptions.update({
        where: { id: s.id },
        data: {
          usage_orders: 0,
          usage_sales: 0,
          start_date: newStart,
          next_billing_at: newNextBilling,
          current_tier_id: tier ? tier.id : s.current_tier_id
        }
      });

      created.push(inv);
    }

    res.json({ success: true, message: `${created.length} invoices created`, data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  markInvoicePaid,
  generateInvoicesManual,
};
