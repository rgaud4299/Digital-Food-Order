const express = require('express');
const router = express.Router();
const createSecuredRoutes = require('../utils/createSecuredRoutes');
const {authMiddleware} = require('../middleware/auth');
// const upload = require('../middleware/uploads');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Validators 
const {

  addFoodCategoryValidation,
  updateFoodCategoryValidation,
  deleteFoodCategoryValidation,
  changeFoodCategoryStatusValidation,

  // 🍔 Food Item Validators
  addFoodItemValidation,
  updateFoodItemValidation,
  changeFoodItemStatusValidation,
  deleteFoodItemValidation,

  // 💰 Food Item Price Validators
  createFoodVariantValidation,
  updateFoodVariantValidation,
  deleteFoodVariantValidation,
  listFoodItemVariantValidation,

} = require('../validators/foodManagement');


const { idParamValid, ListValidation, optionalStatusRule } = require('../validators/commonValidators');
const { addFoodCategory, getFoodCategoryList, getFoodCategoryById, updateFoodCategory, deleteFoodCategory, changeFoodCategoryStatus } = require('../controllers/Admin/Food Management/foodCategoryController');
const { addFoodItem, getFoodItemList, getFoodItemById, updateFoodItem, deleteFoodItem, changeFoodItemStatus } = require('../controllers/Admin/Food Management/foodController');
const { addFoodVariant, getFoodVariantList, getFoodVariantById, updateFoodVariant, deleteFoodVariant } = require('../controllers/Admin/Food Management/foodPriceController');

// ✅ Secure all routes with auth
const securedRoutes = createSecuredRoutes(authMiddleware, (router) => {

  router.post('/food-category/add', upload.single('icon'), addFoodCategoryValidation, addFoodCategory);
  router.post('/food-category/get-list', ListValidation, optionalStatusRule("status"), getFoodCategoryList);
  router.get('/food-category/byid/:id', idParamValid, getFoodCategoryById);
  router.put('/food-category/update/:id', upload.single('icon'), updateFoodCategoryValidation, updateFoodCategory);
  router.delete('/food-category/delete/:id', idParamValid, deleteFoodCategoryValidation, deleteFoodCategory);
  router.patch('/food-category/change-status/:id', idParamValid, changeFoodCategoryStatusValidation, changeFoodCategoryStatus);

  // 🍔 Food Item Routes
  router.post('/food-item/add', upload.single('icon'), addFoodItemValidation, addFoodItem);
  router.post('/food-item/get-list', ListValidation, optionalStatusRule("status"), getFoodItemList);
  router.get('/food-item/byid/:id', idParamValid, getFoodItemById);
  router.put('/food-item/update/:id', upload.single('icon'), updateFoodItemValidation, updateFoodItem);
  router.delete('/food-item/delete/:id', idParamValid, deleteFoodItemValidation, deleteFoodItem);
  router.patch('/food-item/change-status/:id', idParamValid, changeFoodItemStatusValidation, changeFoodItemStatus);

  // 🧩 Food Variant Routes
  router.post('/food-variant/add', createFoodVariantValidation, addFoodVariant);
  router.post('/food-variant/get-list', listFoodItemVariantValidation, getFoodVariantList);
  router.get('/food-variant/byid/:id', idParamValid, getFoodVariantById);
  router.put('/food-variant/update/:id', updateFoodVariantValidation, updateFoodVariant);
  router.delete('/food-variant/delete/:id', idParamValid, deleteFoodVariantValidation, deleteFoodVariant);

});



router.use('/', securedRoutes);
module.exports = router;
