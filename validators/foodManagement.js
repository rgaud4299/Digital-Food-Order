// File: food_itemsAndPricesValidator.js

const { body, param } = require('express-validator');
const {
  handleValidation,
  idParamRule,
  idBodyRule,
  requiredStringRule,
  StatusRule,
  optionalStatusRule,
  optionalStringRule,
  requiredNumericRule,
  optionalNumericRule,
  optionalBooleanRule
} = require("./commonValidators");



const foodCategoryNameRule = requiredStringRule('name', 'Food category name is required')
  .isLength({ max: 100 })
  .withMessage('Category name must be at most 100 characters long');

const foodCategoryStatusRule = optionalStatusRule('status', 'Status must be Active or Inactive')
  .notEmpty()
  .withMessage('Status is required');

const foodCategoryIdParamRule = idParamRule('id', 'Valid Food Category ID is required');

// Validators
const addFoodCategoryValidation = [
  foodCategoryNameRule,
  foodCategoryStatusRule,
  optionalStringRule('description'),
  // idParamRule("restaurant_id"),
  handleValidation,
];

const updateFoodCategoryValidation = [
  foodCategoryIdParamRule,
  foodCategoryNameRule,
  foodCategoryStatusRule,
  optionalStringRule('description'),
  handleValidation,
];

const deleteFoodCategoryValidation = [
  foodCategoryIdParamRule,
  handleValidation,
];

const changeFoodCategoryStatusValidation = [
  foodCategoryIdParamRule,
  foodCategoryStatusRule,
  handleValidation,
];


// =============================
// 🍔 FOOD ITEM 
// =============================
const foodItemIdParamRule = idParamRule('id', 'Valid food item ID is required');
const foodItemCategoryIdRule = idBodyRule('category_id', 'Valid category_id must be a positive integer');
const foodItemNameRule = requiredStringRule('name', 'Food item name is required')
  .isLength({ max: 150 })
  .withMessage('Food item name must be at most 150 characters long');

const foodItemDescriptionRule = body('description')
  .optional({ nullable: true })
  .trim()
  .isLength({ max: 1000 })
  .withMessage('Description must be at most 1000 characters long');

// Required Rule
const foodTypeRule = () =>
  body("type")
    .notEmpty()
    .withMessage("Food type is required")
    .isIn(["Veg", "Vegan", "Non-Veg"])
    .withMessage("Food type must be Veg, Vegan, or Non-Veg");

// Optional Rule
const optionalFoodTypeRule = () =>
  body("type")
    .optional() // field may be missing
    .isIn(["Veg", "Vegan", "Non-Veg"])
    .withMessage("Food type must be Veg, Vegan, or Non-Veg");

// Validators
const addFoodItemValidation = [
  foodItemCategoryIdRule,
  foodItemNameRule,
  foodItemDescriptionRule,
  optionalStatusRule(),
  foodTypeRule(),
  handleValidation,
];

const updateFoodItemValidation = [
  foodItemIdParamRule,
  foodItemCategoryIdRule,
  foodItemNameRule,
  foodItemDescriptionRule,
  optionalStatusRule(),
  foodTypeRule(),
  handleValidation,
];

const changeFoodItemStatusValidation = [
  foodItemIdParamRule,
  optionalStatusRule,
  handleValidation,
];
const changeFoodItemTypeValidation = [
  foodItemIdParamRule,
  optionalFoodTypeRule,
  handleValidation,
];

const deleteFoodItemValidation = [
  foodItemIdParamRule,
  handleValidation,
];


// =============================
// 💰 FOOD ITEM PRICE 
// =============================
const createFoodVariantValidation = [
  idBodyRule('food_item_id', 'Valid food_item_id must be a positive integer'),
  requiredStringRule('portion_type', 'Portion type is required'),
  requiredNumericRule('price', 'Price is required as a positive number'),
  optionalNumericRule('cost_price'),
  optionalStringRule('name', 'Food variant name is required'),
  optionalStringRule('sku'),
  optionalBooleanRule('is_available'),
  optionalBooleanRule('stock_control'),
  handleValidation,
];

const updateFoodVariantValidation = [
  idParamRule('id', 'Valid food_variants must be a positive integer'),
  requiredStringRule('portion_type', 'Portion type is required'),
  requiredNumericRule('price', 'Price is required'),
  optionalNumericRule('cost_price'),
  optionalStringRule('name', 'Food variant name is required'),
  optionalStringRule('sku'),
  optionalBooleanRule('is_available'),
  optionalBooleanRule('stock_control'),
  handleValidation,
];

const deleteFoodVariantValidation = [
  idParamRule('id'),
  handleValidation,
];

const listFoodItemVariantValidation = [
  handleValidation,
];


module.exports = {
  // 🍽 Food Category
  addFoodCategoryValidation,
  updateFoodCategoryValidation,
  deleteFoodCategoryValidation,
  changeFoodCategoryStatusValidation,

  // 🍔 Food Items
  addFoodItemValidation,
  updateFoodItemValidation,
  changeFoodItemStatusValidation,
  changeFoodItemTypeValidation,
  deleteFoodItemValidation,

  // 💰 Food Variant Prices
  createFoodVariantValidation,
  updateFoodVariantValidation,
  deleteFoodVariantValidation,
  listFoodItemVariantValidation,
};
