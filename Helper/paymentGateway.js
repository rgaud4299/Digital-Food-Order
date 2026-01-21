const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { safeParseInt } = require("../utils/parser");
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require("pg-sdk-node");
const Razorpay = require("razorpay");
const { Cashfree, CFEnvironment } = require("cashfree-pg");

// ---------------- CACHE ----------------
let clientCache = {};

// Extract credentials from JSON
function getCredentialFields(gateway) {
  const creds = gateway.credentials || {};
  return {
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    client_version: creds.client_version || 1,
    env: gateway.env || "SANDBOX",
  };
}

function makeCacheKey(gateway) {
  const { client_id, env } = getCredentialFields(gateway);
  return `${gateway.id}-${env}-${client_id}`;
}

function getConfigSignature(gateway) {
  const { client_id, client_secret, client_version, env } = getCredentialFields(gateway);
  return `${client_id}-${client_secret}-${client_version}-${env}`;
}

// ---------------- GET ACTIVE GATEWAY ----------------
async function getActiveGateway() {
  return prisma.payment_gateways.findFirst({
    where: { status: "Active" },
    orderBy: { id: "asc" },
  });
}

// ---------------- INIT CLIENT ----------------
function initClient(gateway) {
  const key = makeCacheKey(gateway);
  const signature = getConfigSignature(gateway);
  const { client_id, client_secret, client_version, env } = getCredentialFields(gateway);

  if (clientCache[key] && clientCache[key].signature !== signature) {
    console.log(`[Gateway Cache] Config changed for ${key}, refreshing client...`);
    delete clientCache[key];
  }

  if (!clientCache[key]) {
    let client;
    switch (safeParseInt(gateway.id)) {
      case 1: // PhonePe
        client = StandardCheckoutClient.getInstance(
          client_id,
          client_secret,
          client_version,
          env === "PRODUCTION" ? Env.PRODUCTION : Env.SANDBOX
        );
        break;

      case 2: // Razorpay
        client = new Razorpay({
          key_id: client_id,
          key_secret: client_secret,
        });
        break;

      case 3: // Cashfree
        client = new Cashfree(
          env === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
          client_id,
          client_secret
        );
        break;

      default:
        throw new Error("Gateway not implemented");
    }

    clientCache[key] = { client, signature };
    console.log(`[Gateway Cache] New client created for ${key}`);
  }

  return clientCache[key].client;
}

// ---------------- INITIATE PAYMENT ----------------
async function initiatePayment(gateway, amount, merchantOrderId, user = {}) {
  if (!merchantOrderId) throw new Error("merchantOrderId is required");

  let checkoutUrl = null;
  let orderId = null;
  let paymentSessionId = null;

  try {
    switch (safeParseInt(gateway.id)) {
      // -------- PHONEPE --------
      case 1: {
        const client = initClient(gateway);
        const request = StandardCheckoutPayRequest.builder()
          .merchantOrderId(merchantOrderId)
          .amount(amount * 100)
          .redirectUrl(`${process.env.APP_URL}/payment/redirect?order_id=${merchantOrderId}`)
          .build();

        const response = await client.pay(request);
        checkoutUrl = response.redirectUrl;
        break;
      }

      // -------- RAZORPAY --------
      case 2: {
        const client = initClient(gateway);
        const order = await client.orders.create({
          amount: amount * 100,
          currency: "INR",
          receipt: merchantOrderId,
          payment_capture: 1,
        });

        orderId = order.id;
        checkoutUrl = null;
        break;
      }

      // -------- CASHFREE --------
      case 3: {
        const client = initClient(gateway);
        const { id: userId, mobile_no, email, name } = user;

        const request = {
          order_amount: amount.toString(),
          order_currency: "INR",
          customer_details: {
            customer_id: userId?.toString() || merchantOrderId,
            customer_phone: mobile_no || "9999999999",
            customer_email: email || "test@example.com",
            customer_name: name || "Guest User",
          },
          order_meta: {
            return_url: `${process.env.APP_URL}/payment/redirect?order_id=${merchantOrderId}`,
          },
        };

        const response = await client.PGCreateOrder(request);
        const resData = response.data || response;

        orderId = resData.order_id;
        paymentSessionId = resData.payment_session_id || null;
        break;
      }

      default:
        throw new Error("Gateway not implemented");
    }

    return {
      merchantOrderId,
      amount,
      ...(orderId ? { orderId } : {}),
      ...(checkoutUrl ? { checkoutUrl } : {}),
      ...(paymentSessionId ? { paymentSessionId } : {}),
    };
  } catch (err) {
    console.error(
      `Payment initiation failed for gateway ${gateway.id}:`,
      err.response?.data || err.message
    );
    throw new Error("Payment initiation failed");
  }
}

// ---------------- FETCH PAYMENT STATUS ----------------
async function fetchPaymentStatus(gateway, orderRef) {
  try {
    switch (safeParseInt(gateway.id)) {
      case 1: { // PhonePe
        const client = initClient(gateway);
        return await client.getOrderStatus(orderRef);
      }

      case 2: { // Razorpay
        const client = initClient(gateway);
        return await client.orders.fetch(orderRef);
      }

      case 3: { // Cashfree
        const client = initClient(gateway);
        const response = await client.PGFetchOrder(orderRef);
        const data = response.data;

        console.log("Cashfree Order Fetched:", {
          order_id: data.order_id,
          cf_order_id: data.cf_order_id,
          amount: data.order_amount,
          status: data.order_status,
          customer: data.customer_details,
        });

        return {
          orderId: data.order_id,
          cfOrderId: data.cf_order_id,
          amount: data.order_amount,
          currency: data.order_currency,
          orderStatus: data.order_status,
          paymentSessionId: data.payment_session_id,
          customer: data.customer_details,
          returnUrl: data.order_meta?.return_url,
        };
      }

      default:
        throw new Error("Gateway not implemented");
    }
  } catch (err) {
    console.error(
      `Fetch status failed for gateway ${gateway.id}:`,
      err.response?.data || err.message
    );
    throw new Error("Failed to fetch payment status");
  }
}

module.exports = {
  getActiveGateway,
  initClient,
  initiatePayment,
  fetchPaymentStatus,
};
