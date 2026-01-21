
const { success, successGetAll, error } = require('../../utils/response.js');
const prisma = require('../../utils/prisma.js');


// async function createPlan(req, res) {
//   const tx = prisma.$transaction.bind(prisma);
//   try {

//     const { name, description, plan_type, base_price, duration_days, billing_metric, metric_rate, currency, auto_renew, features, tiers = [] } = req.body;

//     if (!name) return error(res, 'Plan name is required');

//     // Check duplicate plan name
//     const existing = await prisma.subscription_plans.findUnique({ where: { name } });
//     if (existing) return error(res, 'A plan with this name already exists');

//     const result = await tx(async (prisma) => {
//       const plan = await prisma.subscription_plans.create({
//         data: {
//           name,
//           description: description || null,
//           plan_type: plan_type || 'Prepaid',
//           base_price: base_price ? Number(base_price) : null,
//           duration_days: duration_days ?? 30,
//           billing_metric: billing_metric || null, // 'Orders' | 'Sales'
//           metric_rate: metric_rate ? Number(metric_rate) : null,
//           currency: currency || 'INR',
//           auto_renew: auto_renew || false,
//           features: features || {},
//         },
//       });

//       // Create tiers if provided
//       if (Array.isArray(tiers) && tiers.length) {
//         const tierRecords = tiers.map((t) => ({
//           plan_id: plan.id,
//           order_min: t.order_min ?? null,
//           order_max: t.order_max ?? null,
//           min_bill_amount: t.min_bill_amount ? Number(t.min_bill_amount) : null,
//           commission_percent: t.commission_percent ? Number(t.commission_percent) : null,
//           extra_order_rate: t.extra_order_rate ? Number(t.extra_order_rate) : null,
//           fixed_price: t.fixed_price ? Number(t.fixed_price) : null,
//         }));
//         await prisma.subscription_tiers.createMany({ data: tierRecords });
//       }

//       return plan;
//     });

//     return success(res, 'Subscription plan created successfully', result);
//   } catch (err) {
//     console.error('❌ Error in createPlan:', err);
//     return error(res, err.message || 'Failed to create plan');
//   }
// }
async function createPlan(req, res) {
  try {
    const body = req.body;

    // Validate required fields
    if (!body.name || !body.base_price) {
      return error(res, "name & base_price are required");
    }

    const plan = await prisma.subscription_plans.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        plan_type: "Prepaid",
        duration_days: body.duration_days ?? 30,

        // Pricing
        base_price: Number(body.base_price),
        currency: body.currency ?? "INR",

        // Order Limit Features
        max_orders: body.max_orders ?? null,
        extra_order_charge: body.extra_order_charge
          ? Number(body.extra_order_charge)
          : null,

        // Commission Setup
        sales_commission_percent: body.sales_commission_percent
          ? Number(body.sales_commission_percent)
          : null,

        sales_commission_min_amount: body.sales_commission_min_amount
          ? Number(body.sales_commission_min_amount)
          : null,

        sales_commission_after_orders: body.sales_commission_after_orders
          ? Number(body.sales_commission_after_orders)
          : null,

        has_tiers: Array.isArray(body.tiers) && body.tiers.length > 0,

        features: body.features ?? {}
      }
    });

    // Insert tiers (optional)
    if (Array.isArray(body.tiers) && body.tiers.length > 0) {
      await prisma.subscription_tiers.createMany({
        data: body.tiers.map((t) => ({
          plan_id: plan.id,
          order_min: t.order_min ?? null,
          order_max: t.order_max ?? null,
          fixed_price: t.fixed_price ? Number(t.fixed_price) : null,
          extra_order_charge: t.extra_order_charge
            ? Number(t.extra_order_charge)
            : null,
          sales_commission_percent: t.sales_commission_percent
            ? Number(t.sales_commission_percent)
            : null,
          sales_commission_min_amount: t.sales_commission_min_amount
            ? Number(t.sales_commission_min_amount)
            : null,
          sales_commission_after_orders: t.sales_commission_after_orders
            ? Number(t.sales_commission_after_orders)
            : null
        }))
      });
    }

    return success(res, "Subscription plan created successfully");
  } catch (err) {
    console.error(err);
    return error(res, err.message);
  }
};


async function listPlans(req, res) {
  try {
    const plans = await prisma.subscription_plans.findMany({
      where: { is_active: true },
      include: {
        plan_tiers: {
          orderBy: { order_min: 'asc' },
        },
      },
      orderBy: { base_price: 'asc' },
    });

    return successGetAll(res,"Subscription plan fatched successfully", plans);
  } catch (err) {
    console.error('❌ Error in listPlans:', err);
    return error(res, err.message || 'Failed to fetch plans');
  }
}


async function getPlanById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return error(res, 'Invalid plan ID');

    const plan = await prisma.subscription_plans.findUnique({
      where: { id },
      include: { plan_tiers: { orderBy: { order_min: 'asc' } } },
    });

    if (!plan) return error(res, 'Plan not found');
    return success(res, 'Plan fetched successfully', plan);
  } catch (err) {
    console.error('❌ Error in getPlanById:', err);
    return error(res, err.message || 'Failed to fetch plan');
  }
}


// async function assignPlanToRestaurant(req, res) {
//   const tx = prisma.$transaction.bind(prisma);
//   try {
//     const { restaurant_id, plan_id } = req.body;

//     if (!restaurant_id || !plan_id)
//       return error(res, 'restaurant_id and plan_id are required');

//     const rId = BigInt(restaurant_id);
//     const plan = await prisma.subscription_plans.findUnique({
//       where: { id: Number(plan_id) },
//       include: { plan_tiers: true },
//     });

//     if (!plan) return error(res, 'Plan not found');

//     // Check restaurant exists
//     const restaurant = await prisma.restaurants.findUnique({ where: { uuid: rId } });
//     if (!restaurant) return error(res, 'Restaurant not found');

//     // Check if restaurant already has an active subscription
//     const activeSub = await prisma.restaurant_subscriptions.findFirst({
//       where: { restaurant_id: rId, is_active: true },
//     });
//     if (activeSub)
//       return error(res, 'Restaurant already has an active subscription. Cancel or expire it first.');

//     const start = ISTDate();
//     const nextBilling = parseDurationToExpiresAt(`${plan.duration_days ?? 30}d`);

//     const result = await tx(async (prisma) => {
//       // Create subscription
//       const subscription = await prisma.restaurant_subscriptions.create({
//         data: {
//           restaurant_id: rId,
//           plan_id: plan.id,
//           start_date: start,
//           next_billing_at: nextBilling,
//           is_active: true,
//           usage_orders: 0,
//           usage_sales: 0,
//         },
//       });

//       // Update restaurant record
//       await prisma.restaurants.update({
//         where: { uuid: rId },
//         data: { subscription_plan_id: plan.id },
//       });

//       // Create invoice for prepaid plans immediately
//       if (plan.plan_type === 'Prepaid') {
//         await prisma.invoices.create({
//           data: {
//             restaurant_id: rId,
//             invoice_no: `INV-${plan.id}-${Date.now()}`,
//             amount: plan.base_price || 0,
//             currency: plan.currency || 'INR',
//             status: 'Pending',
//             metadata: {
//               note: 'Subscription (prepaid) initial invoice',
//               plan_name: plan.name,
//               duration_days: plan.duration_days,
//             },
//           },
//         });
//       }

//       return subscription;
//     });

//     return success(res, 'Plan assigned successfully', result);
//   } catch (err) {
//     console.error('❌ Error in assignPlanToRestaurant:', err);
//     return error(res, err.message || 'Failed to assign plan');
//   }
// }


async function assignPlanToRestaurant(req, res) {
  try {
    const { restaurant_id, plan_id } = req.body;

    if (!restaurant_id || !plan_id) {
      return error(res, "restaurant_id & plan_id are required");
    }

    const restId = BigInt(restaurant_id);

    const plan = await prisma.subscription_plans.findUnique({
      where: { id: Number(plan_id) }
    });

    if (!plan || !plan.is_active) {
      return error(res, "Plan not found or inactive");
    }
    console.log("restId", restId)
    const now = new Date();
    const nextBilling = new Date();
    nextBilling.setDate(now.getDate() + (plan.duration_days ?? 30));

    // Reactivate old subscriptions
    await prisma.restaurant_subscriptions.updateMany({
      where: { restaurant_id: restId, is_active: true },
      data: { is_active: false }
    });

    const subscription = await prisma.restaurant_subscriptions.create({
      data: {
        restaurant_id: restId,
        plan_id: plan.id,
        start_date: now,
        next_billing_at: nextBilling,
        is_active: true,
        used_orders: 0,
        earned_commission: 0
      }
    });

    // Assign to restaurant table also (optional but recommended)
    await prisma.restaurants.update({
      where: { uuid: restId },
      data: { subscription_plan_id: subscription.id }
    });

    // Create an invoice for prepaid plans
    await prisma.invoices.create({
      data: {
        restaurant_id: restId,
        invoice_no: `INV-${Date.now()}`,
        amount: plan.base_price,
        currency: plan.currency,
        status: "Unpaid",
        type: "Subscription",
        metadata: { plan_name: plan.name, subscription_id: subscription.id, }
      }
    });

    return success(res, "Plan assigned successfully", subscription);
  } catch (err) {
    console.error(err);
    return error(res, err.message);
  }
};

module.exports = {
  createPlan,
  listPlans,
  getPlanById,
  assignPlanToRestaurant,
};
