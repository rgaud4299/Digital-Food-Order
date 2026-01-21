const walletController = require("../controllers/User/walletController Api/walletController");
const express = require("express");
const router = express.Router();

const {authMiddleware} = require('../middleware/auth');

// wallet
router.post('/wallet', authMiddleware, walletController.getWalletByUserId);

module.exports = router;