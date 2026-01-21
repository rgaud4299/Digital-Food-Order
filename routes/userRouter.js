const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const {
  createUserValidation,
  updateUserValidation,
  getUserByIdValidation,
  deleteUserValidation,
} = require('../validators/userValidator');

// User CRUD
router.post('/', createUserValidation, userController.createUser);
router.get('/', userController.getAllUsers);
router.get('/:id', getUserByIdValidation, userController.getUserById);
router.put('/:id', updateUserValidation, userController.updateUser);
router.delete('/:id', deleteUserValidation, userController.deleteUser);

module.exports = router;
