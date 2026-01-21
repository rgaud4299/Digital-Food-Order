const { body, param } = require('express-validator');
const {
  handleValidation,
  requiredStringRule,
  idParamRule,
} = require('./commonValidators');

// CREATE ORDER
const createOrderValidation = [
  body('restaurant_id').notEmpty().isNumeric().withMessage('Restaurant ID required'),
  body('order_no').notEmpty().isString().withMessage('Order number is required'),
  body('total_amount')
    .notEmpty()
    .isNumeric()
    .withMessage('Total amount must be numeric'),
  body('status')
    .optional()
    .isIn([
      'Pending',
      'Confirmed',
      'Preparing',
      'ReadyForPickup',
      'Completed',
      'Cancelled',
      'Refunded',
    ])
    .withMessage('Invalid order status'),
  handleValidation,
];

// UPDATE ORDER
const updateOrderValidation = [
  idParamRule('id', 'Valid order ID is required'),
  body('status').optional().isIn([
    'Pending',
    'Confirmed',
    'Preparing',
    'ReadyForPickup',
    'ReadyForDelivery',
    'Completed',
    'Cancelled',
    'Refunded',
  ]),
  body('total_amount').optional().isNumeric(),
  handleValidation,
];

// GET /:id
const getOrderByIdValidation = [
  idParamRule('id', 'Valid order ID is required'),
  handleValidation,
];

// DELETE /:id
const deleteOrderValidation = [
  idParamRule('id', 'Valid order ID is required'),
  handleValidation,
];

module.exports = {
  createOrderValidation,
  updateOrderValidation,
  getOrderByIdValidation,
  deleteOrderValidation,
};
