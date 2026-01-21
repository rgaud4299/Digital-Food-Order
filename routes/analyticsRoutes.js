// routes/analyticsRoutes.js
const express = require("express");
const router = express.Router();
const { getRestaurantAnalytics } = require("../controllers/Analytics Dashboard/analyticsController");
const {authMiddleware} = require('../middleware/auth');

router.get("/restaurant", getRestaurantAnalytics);

module.exports = router;
