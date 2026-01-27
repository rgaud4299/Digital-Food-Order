// services/payment.service.js
const prisma = require('../utils/prisma');
const { generateRandomTxnId, ISTDate } = require('../utils/helper');

//
// Helper: Convert to numeric (Prisma expects numbers for BigInt columns in JS)
const toNum = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * Get all unpaid orders for a customer in a restaurant.
 * Unpaid means payment_status = 'Unpaid' (per your schema default).
 */
async function getUnpaidOrdersForCustomer({ customer_id, restaurant_id }) {
  const now = new Date();

  // ⏱️ current time se 24 hours pehle
  const before24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return prisma.orders.findMany({
    where: {
      customer_id: toNum(customer_id),
      restaurant_id: toNum(restaurant_id),
      payment_status: "Unpaid",
      status: "Completed",
      created_at: {
        gte: before24h,
        lte: now
      }
    },
    orderBy: { created_at: "asc" },
  });
}


/**
 * Initiate a grouped payment for all unpaid orders of a customer
 * - creates a payment row per order with same provider_ref = group_txn_id
 * - returns group meta (group_txn_id, total_amount, payments[])
 *
 * Note: The external gateway should be invoked using group_txn_id and amount = totalAmount.
 * On callback, mark all payments with provider_ref = group_txn_id as paid.
 */
async function initiateGroupPayment({ customer_id, restaurant_id, provider = 'Cash', method = 'Cash', metadata = {} }) {
  if (!customer_id || !restaurant_id) throw new Error('customer_id and restaurant_id required');

  const unpaidOrders = await getUnpaidOrdersForCustomer({ customer_id, restaurant_id });
  if (!unpaidOrders || unpaidOrders.length === 0) {
    return { status: 'FAILED', message: 'No unpaid orders found.' };
  }

  // compute total (use net_amount)
  let totalAmount = 0;
  unpaidOrders.forEach(o => {
    totalAmount += Number(o.net_amount || o.total_amount || 0);
  });

  const group_txn_id = generateRandomTxnId('GRP'); // this will be the external txn id / provider_ref
  const createdAt = ISTDate();

  try {
    // create payments (one per order) in a transaction
    const payments = await prisma.$transaction(async (tx) => {
      const createdPayments = [];
      for (const order of unpaidOrders) {
        const p = await tx.payments.create({
          data: {
            order_id: toNum(order.id),
            amount: Number(order.net_amount || order.total_amount || 0),
            currency: order.currency || 'INR',
            provider: provider,
            provider_ref: group_txn_id, // link to group txn
            status: 'Unpaid',
            method: method,
            created_at: createdAt,
          },
        });
        createdPayments.push(p);
      }

      // Create an idempotency key entry to prevent re-initiation in short time (optional)
      await tx.idempotency_keys.create({
        data: {
          key: `group_payment:${group_txn_id}`,
          owner: `customer:${customer_id}`,
          request_path: '/payments/group',
          response: { payments_count: createdPayments.length },
          created_at: createdAt,
          expires_at: null,
        },
      });

      return createdPayments;
    });

    return {
      status: 'SUCCESS',
      message: 'Group payment initiated.',
      data: {
        group_txn_id,
        total_amount: totalAmount,
        payments: payments.map(p => ({ id: p.id, order_id: p.order_id, amount: p.amount })),
      },
    };
  } catch (err) {
    console.error('initiateGroupPayment error', err);
    return { status: 'FAILED', message: 'Failed to create group payment.' };
  }
}

/**
 * Webhook / callback handler for external gateway
 * It expects provider_ref or group_txn_id coming from gateway and status (SUCCESS/FAILED).
 *
 * On success:
 * - find payments with provider_ref = group_txn_id
 * - mark payments.status = 'Paid', captured_at = now
 * - mark their orders payment_status = 'Paid' and status = 'Confirmed' (or keep business logic)
 *
 * On failure:
 * - mark payments.status = 'Failed' and optionally trigger reversals
 */
async function handlePaymentCallback({ provider_ref, provider, status, provider_payload = {} }) {
  if (!provider_ref) throw new Error('provider_ref required');

  const now = ISTDate();

  // Fetch payments with that provider_ref
  const payments = await prisma.payments.findMany({
    where: { provider_ref: provider_ref },
  });

  if (!payments || payments.length === 0) {
    return { status: 'FAILED', message: 'No payments found for provider_ref' };
  }

  // If gateway sends status "SUCCESS"
  if (status === 'SUCCESS') {
    try {
      await prisma.$transaction(async (tx) => {
        // update each payment and its order
        for (const p of payments) {
          await tx.payments.update({
            where: { id: toNum(p.id) },
            data: { status: 'Paid', provider_ref: provider_ref, captured_at: now },
          });

          // update order payment status and order status
          await tx.orders.update({
            where: { id: toNum(p.order_id) },
            data: {
              payment_status: 'Paid',
              // status: 'Completed',
              updated_at: now,
            },
          });

          // record wallet_transactions or order_events optionally
          // await tx.order_events.create({
          //   data: {
          //     order_id: toNum(p.order_id),
          //     event_type: 'PaymentCaptured',
          //     payload: { provider_ref, provider, provider_payload },
          //     created_at: now,
          //   },
          // });
        }
      });

      return { status: 'SUCCESS', message: 'All payments marked Paid' };
    } catch (err) {
      console.error('handlePaymentCallback error', err);
      return { status: 'FAILED', message: 'Failed to mark payments as paid' };
    }
  } else {
    // FAILURE flow
    try {
      await prisma.$transaction(async (tx) => {
        for (const p of payments) {
          await tx.payments.update({
            where: { id: toNum(p.id) },
            data: { status: 'Failed', provider_ref: provider_ref },
          });

          // Mark order as PaymentFailed or leave as Unpaid; we will log an event
          await tx.order_events.create({
            data: {
              order_id: toNum(p.order_id),
              event_type: 'PaymentFailed',
              payload: { provider_ref, provider, provider_payload },
              created_at: now,
            },
          });
        }
      });

      return { status: 'SUCCESS', message: 'All linked payments marked Failed' };
    } catch (err) {
      console.error('handlePaymentCallback error', err);
      return { status: 'FAILED', message: 'Failed to mark payments failed' };
    }
  }
}

/**
 * Create split-bill rows for an order.
 * splits: [{ split_label: 'A', amount: 500 }, ...]
 * If splits don't sum to net_amount, function will return error (unless allowPartial true).
 */
async function createSplitBills({ order_id, splits = [], allowPartial = false }) {
  if (!order_id || !Array.isArray(splits) || splits.length === 0) {
    return { status: 'FAILED', message: 'order_id and splits required' };
  }

  const order = await prisma.orders.findUnique({ where: { id: toNum(order_id) } });
  if (!order) return { status: 'FAILED', message: 'Order not found' };

  const net = Number(order.net_amount || order.total_amount || 0);
  const sumSplits = splits.reduce((s, x) => s + Number(x.amount || 0), 0);

  if (!allowPartial && Math.abs(sumSplits - net) > 0.01) {
    return { status: 'FAILED', message: `Split amounts (${sumSplits}) do not match order net (${net}).` };
  }

  const created = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const s of splits) {
        const row = await tx.split_bills.create({
          data: {
            order_id: toNum(order_id),
            split_label: s.split_label || null,
            amount: Number(s.amount || 0),
            paid: false,
            created_at: ISTDate(),
          },
        });
        created.push(row);
      }

      // Optionally set order.payment_status to 'Partial' if partial splits
      if (sumSplits < net) {
        await tx.orders.update({
          where: { id: toNum(order_id) },
          data: { payment_status: 'PartiallyPaid' },
        });
      }
    });

    return { status: 'SUCCESS', message: 'Split bills created', data: created };
  } catch (err) {
    console.error('createSplitBills error', err);
    return { status: 'FAILED', message: 'Failed to create split bills' };
  }
}

/**
 * Pay a split bill (single split entry).
 * This will create a payment row linked to the parent order and mark the split as paid.
 * On completion when all splits paid, mark parent order as Paid.
 */
async function paySplitBill({ split_bill_id, provider = 'Paytm', method = 'UPI', provider_ref = null }) {
  if (!split_bill_id) throw new Error('split_bill_id required');

  const split = await prisma.split_bills.findUnique({ where: { id: toNum(split_bill_id) } });
  if (!split) return { status: 'FAILED', message: 'Split bill not found' };
  if (split.paid) return { status: 'FAILED', message: 'Split bill already paid' };

  const order = await prisma.orders.findUnique({ where: { id: toNum(split.order_id) } });
  if (!order) return { status: 'FAILED', message: 'Parent order not found' };

  const now = ISTDate();
  const providerRef = provider_ref || generateRandomTxnId('SPL'); // external txn id for this split

  try {
    const result = await prisma.$transaction(async (tx) => {
      // create payment
      const payment = await tx.payments.create({
        data: {
          order_id: toNum(order.id),
          amount: Number(split.amount),
          currency: order.currency || 'INR',
          provider,
          provider_ref: providerRef,
          status: 'Unpaid',
          method,
          created_at: now,
        },
      });

      // mark split as paid? — we will mark paid only after confirmation from gateway.
      // But to support a flow where payment is immediate (e.g., wallet), we can support marking:
      // For now we return payment details and expect external callback to confirm.
      return { payment };
    });

    return { status: 'SUCCESS', message: 'Split payment initiated', data: { provider_ref: providerRef, payment: result.payment } };
  } catch (err) {
    console.error('paySplitBill error', err);
    return { status: 'FAILED', message: 'Failed to create split payment' };
  }
}

/**
 * Confirm split payment after gateway callback for a single split (identified by provider_ref).
 * - Mark payment as Paid
 * - Mark split_bills.paid = true and store payment_id
 * - If all splits for order are paid -> mark order as Paid
 */
async function confirmSplitPaymentCallback({ provider_ref, provider_payload = {} }) {
  if (!provider_ref) throw new Error('provider_ref required');

  // find the payment with this provider_ref
  const payment = await prisma.payments.findFirst({ where: { provider_ref: provider_ref } });
  if (!payment) return { status: 'FAILED', message: 'Payment not found' };

  const orderId = payment.order_id;

  try {
    await prisma.$transaction(async (tx) => {
      // update payment
      await tx.payments.update({
        where: { id: toNum(payment.id) },
        data: { status: 'Paid', captured_at: ISTDate() },
      });

      // find split_bills for this order where amount == payment.amount and unpaid - note: if ambiguous, prefer explicit payment mapping
      // better approach: gateway should pass split_bill_id in metadata; we'll attempt both
      const split = await tx.split_bills.findFirst({
        where: {
          order_id: toNum(orderId),
          amount: Number(payment.amount),
          paid: false,
        },
      });

      if (split) {
        await tx.split_bills.update({
          where: { id: toNum(split.id) },
          data: { paid: true, payment_id: toNum(payment.id) },
        });
      } else {
        // If no matching split found, ignore — the payment could be for non-split order.
      }

      // Check if any unpaid splits remain
      const unpaidCount = await tx.split_bills.count({ where: { order_id: toNum(orderId), paid: false } });

      if (unpaidCount === 0) {
        // mark order paid
        await tx.orders.update({
          where: { id: toNum(orderId) },
          data: { payment_status: 'Paid', status: 'Confirmed', updated_at: ISTDate() },
        });
      } else {
        // If there are unpaid splits, mark order partially paid
        await tx.orders.update({
          where: { id: toNum(orderId) },
          data: { payment_status: 'Unpaid', updated_at: ISTDate() },
        });
      }

      // log event
      await tx.order_events.create({
        data: {
          order_id: toNum(orderId),
          event_type: 'SplitPaymentCaptured',
          payload: { provider_ref, provider_payload },
          created_at: ISTDate(),
        },
      });
    });

    return { status: 'SUCCESS', message: 'Split payment confirmed' };
  } catch (err) {
    console.error('confirmSplitPaymentCallback error', err);
    return { status: 'FAILED', message: 'Failed to confirm split payment' };
  }
}

module.exports = {
  getUnpaidOrdersForCustomer,
  initiateGroupPayment,
  handlePaymentCallback,
  createSplitBills,
  paySplitBill,
  confirmSplitPaymentCallback,
};
