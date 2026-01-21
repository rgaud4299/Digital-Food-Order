// routes/payments.routes.js
const express = require('express');
const router = express.Router();
const payment = require('../controllers/Payments/payment.controller');
const invoice = require('../controllers/Payments/Invoice.controller');
const { idParamValid } = require('../validators/commonValidators');

router.post('/group', payment.createGroupPayment);
router.post('/callback', payment.paymentGatewayCallback);

router.post('/split-bills/create', payment.createSplitBills);
router.post('/split-bills/:id/pay', payment.paySplitBill);
router.post('/split-bills/callback', payment.splitBillCallback);

router.get('/invoice/:id',idParamValid,invoice.getInvoiceByOrderId)

module.exports = router;
