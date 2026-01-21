// File: utils/commonValidators.js


const { body, param, validationResult } = require("express-validator");
const { error } = require("../utils/response");
const { RESPONSE_CODES } = require("../utils/helper");


const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }
  next();
};


const idParamRule = (
  name = "id",
  msg = "Valid positive numeric ID is required"
) =>
  param(name).custom((value, { req }) => {
    if (!/^[1-9][0-9]*$/.test(value)) {
      throw new Error(msg); // 
    }
    req.params[name] = BigInt(value); // ✅ valid -> convert to BigInt
    return true;
  });


const idBodyRule = (name = 'id', msg = `${name} must be Valid positive numeric ID is required`) =>
  body(name)
    .matches(/^[1-9][0-9]*$/)
    .withMessage(msg)
    .customSanitizer((value) => {
      try {
        return BigInt(value);
      } catch {
        throw new Error(msg); // 
      }
    });

const optionalIdBodyRule = (name = 'id', msg = 'Valid positive numeric ID is required') =>
  body(name)
    .optional({ checkFalsy: true })
    .matches(/^[1-9][0-9]*$/)
    .withMessage(msg)
    .customSanitizer((value) => {
      try {
        return BigInt(value);

      } catch (err) {
        throw new Error(msg);
      }
    });



const requiredStringRule = (name, msg = `${name} is required`) =>
  body(name)
    .custom((value) => {
      if (typeof value !== "string") {
        throw new Error(`${name} must be a string`);
      }
      return true;
    })
    .trim()
    .notEmpty().withMessage(msg);


const optionalStringRule = (name, msg = `${name} must be a string`) =>
  body(name)
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (typeof value !== "string") {
        throw new Error(`${name} must be a string`);
      }
      return true;
    });


const StatusRule = (name = 'status', msg = `${name} must be either 'Active' or 'Inactive'`) => body(name)
  .isIn(['Active', 'Inactive'])
  .withMessage(msg);

const optionalStatusRule = (name = 'status', msg = `${name} must be either 'Active' or 'Inactive'`) => body(name)
  .optional({ checkFalsy: true })
  .isIn(['Active', 'Inactive'])
  .withMessage(msg);

const optionalYesNoRule = (name, msg = `${name} must be either 'Yes' or 'No'`) => body(name)
  .optional({ checkFalsy: true })
  .isIn(['Yes', 'No']).withMessage(msg);

const otpRule = (name = 'otp', length = 6) => body(name)
  .notEmpty().withMessage(`${name} is required`)
  .isNumeric().withMessage(`${name} must be a numeric value`)
  .isLength({ min: length, max: length }).withMessage(`${name} must be exactly ${length} digits`);
const mPinRule = (name = 'mPin', length = 4) => body(name)
  .notEmpty().withMessage(`${name} is required`)
  .isNumeric().withMessage(`${name} must be a numeric value`)
  .isLength({ min: length, max: length }).withMessage(`${name} must be exactly ${length} digits`);

const ipAddressRule = (name = 'ip_address') => body(name)
  .notEmpty().withMessage('IP Address is required')
  .isIP().withMessage('Must be a valid IP address (IPv4 or IPv6)')
  .isLength({ max: 45 }).withMessage('IP Address must not exceed 45 characters');

const tokenTypeRule = (name = 'token_type') => body(name)
  .notEmpty().withMessage('Token type is required')
  .isIn(['app', 'api']).withMessage('Token type must be app or api');


const signatureTypeRule = (name = 'signature_type') => body(name).trim()
  .isString().withMessage('Signature type is required')
  .isIn(['SMS', 'Whatsapp', "Email"]).withMessage('Signature type must be SMS or Whatsapp or Email');



const userIdBodyRule = (name = 'user_id', msg = 'Valid positive numeric user ID is required') => body(name)
  .notEmpty().withMessage(`${name} is required`)
  .isInt({ gt: 0 }).withMessage(msg);

const textRule = (field, max) => body(field)
  .optional({ checkFalsy: true })
  .isString().withMessage(`${field} must be a string`)
  .isLength({ max }).withMessage(`${field} must be at most ${max} characters`)
  .trim();

const requiredtextRule = (field, max) => body(field)
  .notEmpty().withMessage(`${field} is required`)
  .isString().withMessage(`${field} must be a string`)
  .isLength({ max }).withMessage(`${field} must be at most ${max} characters`)
  .trim();

const idParamValid = [idParamRule(), handleValidation];
// middleware/convertId.js

const requiredNumericRule = (name, msg = `${name} is required and must be numeric`) =>
  body(name)
    .notEmpty().withMessage(`${name} is required`)
    .matches(/^[1-9][0-9]*$/)
    .withMessage(msg)

const optionalNumericRule = (name, msg = `${name} is required and must be numeric`) =>
  body(name)
    .optional({ checkFalsy: true })
    .matches(/^[1-9][0-9]*$/)
    .withMessage(msg)


const ListValidation = [
  body('offset').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Offset must be a non-negative integer').toInt(),
  body('limit').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Limit must be a positive integer').toInt(),
  optionalStringRule("searchValue"),
  optionalStatusRule('status'),
];


const requiredEmailRule = (name = "email", msg = "Invalid email address") =>
  body(name)
    .notEmpty().withMessage(`${name} is required`)
    .isEmail().withMessage(msg);

// ✅ Optional email rule
const optionalEmailRule = (name = "email", msg = "Invalid email address") =>
  body(name)
    .optional({ checkFalsy: true })
    .isEmail().withMessage(msg);

// ✅ Required mobile rule
const requiredMobileRule = (name = "mobile_no", msg = "Invalid mobile number") =>
  body(name)
    .notEmpty().withMessage(`${name} is required`)
    .matches(/^[6-9]\d{9}$/)
    .withMessage(msg);

// ✅ Optional mobile rule
const optionalMobileRule = (name = "mobile_no", msg = "Invalid mobile number") =>
  body(name)
    .optional({ checkFalsy: true })
    .matches(/^[6-9]\d{9}$/)
    .withMessage(msg);


// Latitude Rule
const latitudeRule = (
  name = "latitude",
  msg = "Invalid latitude value",
  isRequired = true
) => {
  const rule = body(name)
    .isFloat({ min: -90, max: 90 })
    .withMessage(msg);

  return isRequired
    ? rule.notEmpty().withMessage(`${name} is required`)
    : rule.optional({ checkFalsy: true });
};

// Longitude Rule
const longitudeRule = (
  name = "longitude",
  msg = "Invalid longitude value",
  isRequired = true
) => {
  const rule = body(name)
    .isFloat({ min: -180, max: 180 })
    .withMessage(msg);

  return isRequired
    ? rule.notEmpty().withMessage(`${name} is required`)
    : rule.optional({ checkFalsy: true });
};

const passwordRule = (
  name = "password",
  {
    required = true,
    minLength = 6,
    letters = true,
    number = true,
    special = true,
  } = {}
) => {
  let rule = body(name)
    .isLength({ min: minLength })
    .withMessage(`Password must be at least ${minLength} characters`);

  if (letters)
    rule = rule
      .matches(/(?=.*[a-z])(?=.*[A-Z])/)
      .withMessage("Password must contain at least one lowercase and one uppercase letter");

  if (number)
    rule = rule.matches(/[0-9]/).withMessage("Password must contain at least one number");

  if (special)
    rule = rule.matches(/[@$!%*?&]/).withMessage("Password must contain at least one special character");

  return required
    ? rule.notEmpty().withMessage(`${name} is required`)
    : rule.optional({ checkFalsy: true });
};
const optionalBooleanRule = (fieldName) =>
  body(fieldName)
    .optional() // skip if not provided
    .isBoolean()
    .withMessage(`${fieldName} must be true or false`)
    .toBoolean(); // converts "true"/"false"/1/0 → true/false

module.exports = {
  handleValidation,optionalBooleanRule,
  idParamRule,
  idBodyRule,
  optionalIdBodyRule,
  requiredStringRule,
  optionalStringRule,
  StatusRule,
  optionalStatusRule,
  optionalYesNoRule,
  otpRule, mPinRule,
  ipAddressRule,
  tokenTypeRule,
  signatureTypeRule,
  userIdBodyRule,
  idParamValid,
  textRule,
  requiredtextRule,
  ListValidation,
  requiredNumericRule,
  optionalNumericRule, requiredEmailRule, optionalEmailRule, requiredMobileRule, optionalMobileRule, latitudeRule, longitudeRule, passwordRule
};

