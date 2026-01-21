// controllers/payment.controller.js
const paymentService = require('../../services/payment.service');
const { success, error } = require('../../utils/response'); // your response helpers

/**
 * POST /payments/group
 * body: { customer_id, restaurant_id, provider?, method? }
 * returns group_txn_id and total
 */
async function createGroupPayment(req, res) {
  try {
    const { customer_id, restaurant_id, provider, method } = req.body;
    if (!customer_id || !restaurant_id) return error(res, 'customer_id and restaurant_id required', 422);

    const result = await paymentService.initiateGroupPayment({ customer_id, restaurant_id, provider, method });
    if (result.status !== 'SUCCESS') return error(res, result.message, 400);

    return success(res, result.message, result.data);
  } catch (err) {
    console.error('createGroupPayment error', err);
    return error(res, 'Internal server error', 500);
  }
}

/**
 * POST /payments/callback
 * Gateway will POST here with provider_ref (group_txn_id), status: SUCCESS/FAILED
 * body: { provider_ref, provider, status, payload }
 */
async function paymentGatewayCallback(req, res) {
  try {
    const { provider_ref, provider, status, payload } = req.body;
    if (!provider_ref || !status) return error(res, 'provider_ref and status required', 422);

    const result = await paymentService.handlePaymentCallback({ provider_ref, provider, status, provider_payload: payload });
    if (result.status !== 'SUCCESS') return error(res, result.message, 400);

    // return 200 to gateway
    return success(res, result.message, {});
  } catch (err) {
    console.error('paymentGatewayCallback error', err);
    return error(res, 'Internal server error', 500);
  }
}

/**
 * POST /split-bills/create
 * body: { order_id, splits: [{ split_label, amount }, ...] }
 */
async function createSplitBills(req, res) {
  try {
    const { order_id, splits, allowPartial } = req.body;
    if (!order_id || !Array.isArray(splits)) return error(res, 'order_id and splits[] required', 422);

    const result = await paymentService.createSplitBills({ order_id, splits, allowPartial });
    if (result.status !== 'SUCCESS') return error(res, result.message, 400);

    return success(res, result.message, result.data);
  } catch (err) {
    console.error('createSplitBills controller error', err);
    return error(res, 'Internal server error', 500);
  }
}

/**
 * POST /split-bills/:id/pay
 * body: { provider?, method? }  — this will return provider_ref & payment row, gateway to pay using provider_ref
 */
async function paySplitBill(req, res) {
  try {
    const split_bill_id = req.params.id;
    const { provider, method } = req.body;
    if (!split_bill_id) return error(res, 'split_bill_id required in path', 422);

    const result = await paymentService.paySplitBill({ split_bill_id, provider, method });
    if (result.status !== 'SUCCESS') return error(res, result.message, 400);

    return success(res, result.message, result.data);
  } catch (err) {
    console.error('paySplitBill controller error', err);
    return error(res, 'Internal server error', 500);
  }
}

/**
 * POST /split-bills/callback
 * body: { provider_ref, payload }
 * This is the callback for split payments (single split)
 */

async function splitBillCallback(req, res) {
  try {
    const { provider_ref, payload } = req.body;
    if (!provider_ref) return error(res, 'provider_ref required', 422);

    const result = await paymentService.confirmSplitPaymentCallback({ provider_ref, provider_payload: payload });
    if (result.status !== 'SUCCESS') return error(res, result.message, 400);

    return success(res, result.message, {});
  } catch (err) {
    console.error('splitBillCallback error', err);
    return error(res, 'Internal server error', 500);
  }
}

module.exports = {
  createGroupPayment,
  paymentGatewayCallback,
  createSplitBills,
  paySplitBill,
  splitBillCallback,
};
