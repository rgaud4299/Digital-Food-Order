
// File: tokenValidator.js

const { body, param } = require("express-validator");
const { handleValidation, idParamRule, optionalStatusRule, otpRule, tokenTypeRule } = require("./commonValidators");

exports.generateTokenValidation = [
  tokenTypeRule(),
  handleValidation,
];

exports.TokenchangeStatusValidation = [
  idParamRule("id", "Invalid token ID"),
  optionalStatusRule,
  handleValidation,
];

exports.OtpValidation = [
  otpRule('otp'),
  handleValidation,
];





