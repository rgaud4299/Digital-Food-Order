const express = require("express");
const router = express.Router();
const validators = require("../validators/pgValidators");
const createSecuredRoutes = require('../utils/createSecuredRoutes');

// const {
//   initiatePayment,
//   getPaymentStatus,
// } = require("../controllers/User/pgControllerApi/pgController");
const {authMiddleware} = require('../middleware/auth');

const securedRoutes = createSecuredRoutes(authMiddleware, (router) => {
  
  // router.post("/add/payment/initiate", validators.initiatePaymentValidator, initiatePayment);
  // router.post("/payment/status", validators.getPaymentStatusValidator, getPaymentStatus);

});

router.use('/', securedRoutes);

module.exports = router;
