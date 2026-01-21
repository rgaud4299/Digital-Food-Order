

// File: webhookValidator.js

const { body } = require('express-validator');
const { handleValidation, userIdBodyRule } = require('./commonValidators');

const update = [
  body("url")
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (value && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value)) {
        throw new Error("Invalid webhook URL");
      }
      return true;
    }),

  handleValidation
];

module.exports = { update };