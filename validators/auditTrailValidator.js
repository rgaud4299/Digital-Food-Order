
// File: validators/auditTrailValidator.js

const { body, param } = require('express-validator');
const { handleValidation, idParamRule, userIdBodyRule, StatusRule } = require('./commonValidators');

const getAuditTrailListValidation = [
  body('table_name').optional().isString().withMessage('table_name must be a string'),
  body('action').optional().isIn(['create', 'update', 'delete', 'approve', 'reject', 'password_change']),
  userIdBodyRule('created_by'),
  StatusRule('status'),
  body('offset').optional().isInt({ min: 0 }).toInt(),
  body('limit').optional().isInt({ min: 1 }).toInt(),
  handleValidation,
];

const getAuditTrailByIdValidation = [
  idParamRule('id', 'Valid audit trail ID is required'),
  handleValidation,
];

module.exports = {
  getAuditTrailListValidation,
  getAuditTrailByIdValidation,
};