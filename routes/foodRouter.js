const express = require('express');
const router = express.Router();

const {
  createFoodItemValidation,
  updateFoodItemValidation,
  getFoodItemByIdValidation,
  deleteFoodItemValidation,
} = require('../validators/foodValidator');
const { addFoodCategory, getFoodCategoryList, getFoodCategoryById, updateFoodCategory, deleteFoodCategory } = require('../controllers/Admin/Food Management/foodCategoryController');

// Food Items CRUD
router.post('/', createFoodItemValidation, addFoodCategory);
router.get('/', getFoodCategoryList);
router.get('/:id', getFoodItemByIdValidation, getFoodCategoryById);
router.put('/:id', updateFoodItemValidation, updateFoodCategory);
router.delete('/:id', deleteFoodItemValidation, deleteFoodCategory);

module.exports = router;
