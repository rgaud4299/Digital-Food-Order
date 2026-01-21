// 




















// File: validators/authValidator.js

const { body } = require('express-validator');
const { handleValidation, requiredStringRule, otpRule, optionalMobileRule, optionalEmailRule, idBodyRule, requiredEmailRule, requiredMobileRule, latitudeRule, longitudeRule, passwordRule, optionalStringRule } = require('./commonValidators');


// Register Validation
const registerValidation = [

  requiredMobileRule('mobile_no', 'Invalid mobile number'),

  handleValidation,
];

const registerUserValidation = [
  requiredStringRule('name', 'Name is required'),
  requiredEmailRule('email', 'Invalid email address'),
  requiredMobileRule('mobile_no', 'Invalid mobile number'),
  passwordRule("password", {
    required: true,
    minLength: 6,
    letters: true,
    number: true,
    special: true,
  }),
  optionalStringRule('token'),

  handleValidation,
];
//Login Validationsc
const loginValidation = [
  requiredStringRule('username'),
  body('username')
    .trim()
    .custom((value) => {

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const mobileRegex = /^[6-9]\d{9}$/;

      return emailRegex.test(value) || mobileRegex.test(value);
    })
    .withMessage('Username must be a valid email or 10-digit mobile number'),

  passwordRule("password", {
    required: true,
    minLength: 6,
    letters: true,
    number: true,
    special: true,
  }),

  latitudeRule('latitude'),
  longitudeRule('longitude'),
  handleValidation,

];
//Verify OTP Validation
const verifyOtpValidation = [
  otpRule('mobileOtp'),
  handleValidation,
];
const verifyLoginOtpValidation = [
  ...loginValidation,
  otpRule('otp'),
  handleValidation,
];
const forgotPasswordValidation = [
  requiredStringRule('username'),
  body('username')
    .trim()
    .custom((value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // ✅ email format
      const mobileRegex = /^[6-9]\d{9}$/;              // ✅ 10-digit mobile

      return emailRegex.test(value) || mobileRegex.test(value);
    })
    .withMessage('Username must be a valid email or 10-digit mobile number'),
  handleValidation,
];


const verifyForgotOtpValidation = [
  requiredStringRule('username'),
  body('username')
    .trim()
    .custom((value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // ✅ email format
      const mobileRegex = /^[6-9]\d{9}$/;              // ✅ 10-digit mobile

      return emailRegex.test(value) || mobileRegex.test(value);
    })
    .withMessage('Username must be a valid email or 10-digit mobile number'),
  otpRule('otp'),
  handleValidation,
];

const resetPasswordValidation = [
  requiredStringRule('token', 'Token is required'),
  passwordRule("new_password", {
    required: true,
    minLength: 6,
    letters: true,
    number: true,
    special: true,
  }),

  passwordRule("confirm_password", {
    required: true,
    minLength: 6,
    letters: true,
    number: true,
    special: true,
  }),
  handleValidation,
];

const changePasswordValidation = [
  passwordRule("new_password", {
    required: true,
    minLength: 6,
    letters: true,
    number: true,
    special: true,
  }),

  passwordRule("confirm_password", {
    required: true,
    minLength: 6,
    letters: true,
    number: true,
    special: true,
  }),
  handleValidation,
];

module.exports = {
  registerValidation,
  registerUserValidation,
  
  loginValidation,
  verifyOtpValidation,

  resetPasswordValidation,
  verifyLoginOtpValidation,
  forgotPasswordValidation,
  verifyForgotOtpValidation,
  changePasswordValidation
};
