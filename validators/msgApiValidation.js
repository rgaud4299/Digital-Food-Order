
// File: validators/apiValidator.js

const { body, param } = require('express-validator');
const { handleValidation, idParamRule, StatusRule, requiredStringRule, signatureTypeRule } = require('./commonValidators');

// Common Rules (specific to this file)
const methodRule = body('method')
  .isIn(['GET', 'POST']).withMessage('Method must be GET or POST');

const baseUrlRule = body('base_url')
  .trim()
  .notEmpty().withMessage('Base URL is required')
  .isURL().withMessage('Base URL must be a valid URL');

const paramsRule = body('params')
  .isString().withMessage('API Params must be a valid string')
  .notEmpty().withMessage('API Params cannot be empty')
  .isLength({ max: 1000 }).withMessage('API Params too long');

// Add new API
const addApiValidation = [
  requiredStringRule('api_name', 'API name is required')
   .isLength({ max: 255 }).withMessage('API name must be at most 255 characters'),
  signatureTypeRule('api_type'),
  baseUrlRule,
  paramsRule,
  methodRule,
  StatusRule('status'),
  handleValidation,
];

// Update API
const updateApiValidation = [
  idParamRule('id', 'Valid API ID is required'),
  requiredStringRule('api_name', 'API name is required')
   .isLength({ max: 255 }).withMessage('API name must be at most 255 characters'),
  signatureTypeRule('api_type'),
  baseUrlRule,
  methodRule,
  StatusRule('status'),
  paramsRule,
  handleValidation,
];

module.exports = {
  addApiValidation,
  updateApiValidation,

};