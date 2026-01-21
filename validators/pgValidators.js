const { body } = require("express-validator");
const { handleValidation } = require("./commonValidators");
const { getActiveGateway } = require("../Helper/paymentGateway");


exports.initiatePaymentValidator = [
  body("amount")
    .notEmpty().withMessage("Amount is required")
    .isNumeric().withMessage("Amount must be a valid number")
    .custom((value) => {
      if (Number(value) <= 0) {
        throw new Error("Amount must be greater than 0");
      }
      return true;
    })
    .toInt(),
  handleValidation
];

//  Get Payment Status Validator
exports.getPaymentStatusValidator = [
  body().custom(async (value, { req }) => {
    const gateway = await getActiveGateway();
    if (!gateway) {
      throw new Error("No active payment gateway");
    }

    switch (parseInt(gateway.id)) {
      case 1: // PhonePe
        if (!req.body.merchantOrderId) {
          throw new Error("merchantOrderId is required for PhonePe");
        }
        break;

      case 2: // Razorpay
        if (!req.body.orderId) {
          throw new Error("orderId is required for Razorpay");
        }
        break;

      case 3: // Cashfree
        if (!req.body.orderId) {
          throw new Error("orderId is required for Cashfree");
        }
        break;

      default:
        throw new Error("Unsupported payment gateway");
    }

    return true;
  }),
  handleValidation,
];
