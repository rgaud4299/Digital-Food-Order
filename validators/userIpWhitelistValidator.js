// File: userIpAddressValidator.js
const { body, param } = require("express-validator");
const { handleValidation, idParamRule, optionalStatusRule,StatusRule, ipAddressRule, userIdParamRule } = require("./commonValidators");

// Validators
const addIpValidation = [
  ipAddressRule(),
  optionalStatusRule(),
  handleValidation
];

const changeStatusValidation = [
  idParamRule(),
  optionalStatusRule(),
  handleValidation
];



const getAllIpValidation = [
  userIdParamRule(),
  handleValidation
];

module.exports = {
  addIpValidation,
  changeStatusValidation,
  getAllIpValidation
};