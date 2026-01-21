const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

const authController = require('../controllers/Auth/authController');

const { registerValidation, loginValidation, verifyOtpValidation, registerUserValidation, forgotPasswordValidation, verifyForgotOtpValidation, resetPasswordValidation } = require('../validators/authValidator');

router.post('/user/register', registerValidation, authController.register);
router.post('/user/verify-otp', verifyOtpValidation, authController.verifyRegisterOtp);
router.post('/user/register-user', registerUserValidation, authController.registerUser);

router.post('/user/login', loginValidation, authController.loginUser);
router.post('/user/verify-otp', verifyOtpValidation, authController.verifyRegisterOtp);
router.post('/logout', authMiddleware, authController.logoutUser);


router.post('/customer/register', registerValidation, authController.sendRegisterCustomerOtp);
router.post('/customer/verify-otp', verifyOtpValidation, authController.verifyCustomerRegisterOtp);
router.post('/customer/register-customer', registerUserValidation, authController.registerCustomer);
router.post('/customer/login', loginValidation, authController.loginCustomer);


router.post("/forgot-password", forgotPasswordValidation, authController.forgotPassword);
router.post("/forgot-password/verify-otp", verifyForgotOtpValidation, authController.verifyForgotOtp);
router.post("/reset-password", resetPasswordValidation, authController.resetPassword);


module.exports = router;
