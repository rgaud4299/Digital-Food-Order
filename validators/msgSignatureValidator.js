
// File: signatureValidator.js

const { body } = require('express-validator');
const { handleValidation, requiredStringRule,optionalStatusRule, StatusRule, signatureTypeRule } = require("./commonValidators");

const addOrUpdateSignatureValidator = [
  requiredStringRule('signature'),
  signatureTypeRule('signature_type'),
  optionalStatusRule(),
  handleValidation
];

module.exports = { addOrUpdateSignatureValidator };