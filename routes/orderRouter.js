const express = require('express');
const router = express.Router();

const orderController = require('../controllers/Orders/orderController');

const {
  createOrderValidation,
  updateOrderValidation,
  getOrderByIdValidation,
  deleteOrderValidation,
} = require('../validators/orderValidator');
const { authMiddleware } = require('../middleware/auth');

// Orders CRUD
router.post('/create', authMiddleware, orderController.placeOrder);
router.post('/get-list', authMiddleware, orderController.getOrderList);

// router.get('/:id', getOrderByIdValidation, orderController.getOrderById);
// router.put('/:id', updateOrderValidation, orderController.updateOrder);
// router.delete('/:id', deleteOrderValidation, orderController.deleteOrder);

module.exports = router;
