const { body, param } = require('express-validator');
const {
  handleValidation,
  requiredStringRule,
  idParamRule,
  optionalStatusRule,
  optionalcurrencyRule,
  optionalNumericRule,
} = require('./commonValidators');

const language = (body('language')
  .optional({ checkFalsy: true })
  .isString()
  .withMessage('Language must be a string'));

// CREATE
const createRestaurantValidation = [
  requiredStringRule('name', 'Restaurant name is required'),
  optionalStatusRule('status'),
  optionalNumericRule('subscription_plan_id', 'Subscription Plan ID must be numeric'),
  language,
  handleValidation,
];

// UPDATE
const updateRestaurantValidation = [
  idParamRule('id', 'Valid restaurant ID is required'),
  requiredStringRule('name', 'Restaurant name is required'),
  optionalStatusRule('status'),
  language,
  handleValidation,
];

// GET /:id
const getRestaurantByIdValidation = [
  idParamRule('id', 'Valid restaurant ID is required'),
  handleValidation,
];

// DELETE /:id
const deleteRestaurantValidation = [
  idParamRule('id', 'Valid restaurant ID is required'),
  handleValidation,
];

module.exports = {
  createRestaurantValidation,
  updateRestaurantValidation,
  getRestaurantByIdValidation,
  deleteRestaurantValidation,
};
