
// File: validations/msgContentsValidation.js

const { body, param } = require('express-validator');
const { handleValidation, idParamRule, optionalYesNoRule ,textRule, requiredtextRule } = require('./commonValidators');

// Common Rules (specific to this file)
const messageTypeRule = body('message_type')
  .notEmpty().withMessage('Message type is required')
  .isLength({ max: 100 }).withMessage('Message type must be at most 100 characters')
  .trim();

const smsTemplateIdRule = body('sms_template_id')
  .optional()
  .isString().withMessage('SMS template ID must be a string')
  .isLength({ max: 50 }).withMessage('SMS template ID must be at most 50 characters')
  .trim();

const conditionalContentRule = (contentField, sendFlagField) => body(contentField)
  .custom((value, { req }) => {
    if (req.body[sendFlagField] === 'Yes' && !value) {
      throw new Error(`${contentField} is required when ${sendFlagField} is Yes`);
    }
    return true;
  });

//Validation Sets
const addMsgContentValidation = [
  messageTypeRule,
  optionalYesNoRule('send_sms'),
  optionalYesNoRule('send_whatsapp'),
  optionalYesNoRule('send_email'),
  optionalYesNoRule('send_notification'),
  smsTemplateIdRule,
  requiredtextRule('sms_content', 500),
  requiredtextRule('whatsapp_content', 500),
  textRule('mail_subject', 255),
  textRule('mail_content', 2000),
  textRule('notification_title', 255),
  textRule('notification_content', 1000),
  textRule('keywords', 500),
  conditionalContentRule('sms_content', 'send_sms'),
  conditionalContentRule('whatsapp_content', 'send_whatsapp'),
  conditionalContentRule('mail_content', 'send_email'),
  conditionalContentRule('notification_content', 'send_notification'),
  handleValidation
];

// Update message content
const updateMsgContentValidation = [
  idParamRule(),
  ...addMsgContentValidation.slice(0, -1),
  handleValidation
];

// Get by ID
const getMsgContentByIdValidation = [
  idParamRule(),
  handleValidation
];

//change status validation can be added here if needed
const changeMsgContentStatusValidation = [
  idParamRule(),
  body('statusKey')
    .notEmpty().withMessage('Status key is required')
    .isIn(['send_sms', 'send_whatsapp', 'send_email', 'send_notification'])
    .withMessage('Invalid status key')
    .trim(),
  handleValidation
];

module.exports = {
  addMsgContentValidation,
  updateMsgContentValidation,
  getMsgContentByIdValidation,
  changeMsgContentStatusValidation
};