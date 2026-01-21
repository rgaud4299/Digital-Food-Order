// controllers/adminAnalyticsController.js
const { success, error } = require("../../utils/helper");
const adminAnalytics = require("../../services/adminAnalytics.service");

async function getPlatformAnalytics(req, res) {
  try {
    const { days, limit } = req.query;

    const [summary, topRestaurants, orderDistribution, salesTrend] = await Promise.all([
      adminAnalytics.getGlobalSummary(Number(days) || 30),
      adminAnalytics.getTopRestaurants(Number(limit) || 5, Number(days) || 30),
      adminAnalytics.getOrderDistribution(Number(days) || 30),
      adminAnalytics.getSalesTrend(Number(days) || 7),
    ]);

    return success(res, "Platform analytics fetched", {
      summary,
      topRestaurants,
      orderDistribution,
      salesTrend,
    });
  } catch (err) {
    console.error("⚠️ Admin analytics error:", err);
    return error(res, err.message);
  }
}

module.exports = { getPlatformAnalytics };
