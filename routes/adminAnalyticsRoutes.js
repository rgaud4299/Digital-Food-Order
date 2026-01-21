// routes/adminAnalyticsRoutes.js
const express = require("express");
const router = express.Router();
const { getPlatformAnalytics } = require("../controllers/Analytics Dashboard/adminAnalyticsController");
const {authMiddleware} = require("../middleware/auth");

router.get("/platform", authMiddleware, getPlatformAnalytics);

module.exports = router;
