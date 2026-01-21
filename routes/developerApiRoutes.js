const express = require("express");
const router = express.Router();
const userIpWhitelistController = require("../controllers/User/Developer API/userIpWhitelistController");
const { addIpValidation ,
  changeStatusValidation,
  deleteIpValidation,getAllIpValidation} = require("../validators/userIpWhitelistValidator");
const ctrl = require('../controllers/User/Developer API/webhookController');
const validate = require('../validators/webhookValidator');
const controller = require("../controllers/User/Developer API/userTokensController");
const { generateTokenValidation, TokenchangeStatusValidation, OtpValidation } = require("../validators/userTokensValidation");
const createSecuredRoutes = require("../utils/createSecuredRoutes");
const {authMiddleware} = require('../middleware/auth');
const { authorizeRole } = require("../middleware/authorizeRole");
const { generateTokenOTP } = require("../controllers/User/Developer API/utils/generateTokenOtp");
const { verifyTokenOtpController } = require("../controllers/User/Developer API/utils/verifyTokenOtpController");
const { idParamValid } = require("../validators/commonValidators");

 

const securedRoutes = createSecuredRoutes([authMiddleware], (router) => {
 // all whitelisted IPs
router.post("/whitelisted-ip/add",addIpValidation, userIpWhitelistController.addIp);  // Add new whitelist entry
router.get("/whitelisted-ip/get-list", userIpWhitelistController.getAllIp);      // GET all whitelisted IPs
router.patch("/whitelisted-ip/change-status/:id",idParamValid,userIpWhitelistController.changeStatus);          // Update whitelist entry
router.delete("/whitelisted-ip/delete/:id",idParamValid, userIpWhitelistController.deleteIp);       // Delete whitelist entry
// webhook
router.put('/webhook/update',validate.update, ctrl.update);
router.get('/webhook/get-webhook', ctrl.getWebhook);

// userTokens
router.post("/tokens/generate", generateTokenValidation, controller.generateToken);
router.get("/tokens/get-list", controller.getTokensByUserId);

router.get("/tokens/send-otp",generateTokenOTP);
router.patch("/tokens/verify-otp/change-status",OtpValidation, verifyTokenOtpController);
});


router.use('/', securedRoutes);



module.exports = router;
