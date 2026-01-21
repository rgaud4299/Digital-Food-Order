const { body, param } = require('express-validator');
const {
  handleValidation,
  requiredStringRule,
  idParamRule,
} = require('./commonValidators');

// CREATE USER
const createUserValidation = [
  requiredStringRule('name', 'Name is required'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  body('phone')
    .optional()
    .isString()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone must be valid'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('user_type')
    .optional()
    .isIn(['PlatformAdmin', 'RestaurantStaff', 'Customer'])
    .withMessage('Invalid user type'),
  handleValidation,
];

// UPDATE USER
const updateUserValidation = [
  idParamRule('id', 'Valid user ID is required'),
  body('name').optional().isString(),
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('is_active').optional().isBoolean(),
  body('user_type')
    .optional()
    .isIn(['PlatformAdmin', 'RestaurantStaff', 'Customer']),
  handleValidation,
];

// GET /:id
const getUserByIdValidation = [
  idParamRule('id', 'Valid user ID is required'),
  handleValidation,
];

// DELETE /:id
const deleteUserValidation = [
  idParamRule('id', 'Valid user ID is required'),
  handleValidation,
];

module.exports = {
  createUserValidation,
  updateUserValidation,
  getUserByIdValidation,
  deleteUserValidation,
};
