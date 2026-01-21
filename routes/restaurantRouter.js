const express = require('express');
const router = express.Router();
const {authMiddleware }= require('../middleware/auth');

const restaurantController = require('../controllers/Restaurant/restaurantController');
const {
  createRestaurantValidation,
  updateRestaurantValidation,
  getRestaurantByIdValidation,
  deleteRestaurantValidation,
} = require('../validators/restaurantValidator');
const createSecuredRoutes = require('../utils/createSecuredRoutes');
const { ListValidation } = require('../validators/commonValidators');

// ✅ Secure all routes with auth
const securedRoutes = createSecuredRoutes([authMiddleware], (router) => {
  // Restaurant CRUD
  router.post('/add', createRestaurantValidation, restaurantController.addRestaurant);
  router.post('/get-list',ListValidation, restaurantController.getRestaurantList);
  router.get('/byid/:id', getRestaurantByIdValidation, restaurantController.getRestaurantById);
  router.put('/update/:id', updateRestaurantValidation, restaurantController.updateRestaurant);
  router.delete('/delete/:id', deleteRestaurantValidation, restaurantController.deleteRestaurant);
});

router.use('/', securedRoutes);

module.exports = router;
