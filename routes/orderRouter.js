const express = require('express');
const router = express.Router();

const orderController = require('../controllers/Orders/orderController');

const {
  createOrderValidation,
  updateOrderValidation,
  getOrderByIdValidation,
  deleteOrderValidation,
} = require('../validators/orderValidator');
const { CustomerAuthMiddleware } = require('../middleware/auth');

// Orders CRUD
router.post('/create',CustomerAuthMiddleware, orderController.placeOrder);
router.post('/get-list',CustomerAuthMiddleware, orderController.getOrderList);

// router.get('/:id', getOrderByIdValidation, orderController.getOrderById);
// router.put('/:id', updateOrderValidation, orderController.updateOrder);
// router.delete('/:id', deleteOrderValidation, orderController.deleteOrder);

module.exports = router;
