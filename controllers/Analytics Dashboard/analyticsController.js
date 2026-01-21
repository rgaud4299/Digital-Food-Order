// controllers/analyticsController.js
const { success, error } = require("../../utils/response");
const analyticsService = require("../../services/analytics.service");

async function getRestaurantAnalytics(req, res) {
  try {
    const { restaurant_id, days } = req.query;
    if (!restaurant_id) return error(res, "restaurant_id is required");

    const [orders, finance, daily] = await Promise.all([
      analyticsService.getOrderStats(restaurant_id, Number(days) || 30),
      analyticsService.getFinanceStats(restaurant_id),
      analyticsService.getDailySales(restaurant_id, Number(days) || 7),
    ]);

    return success(res, "Analytics fetched successfully", {
      orders,
      finance,
      daily_sales: daily,
    });

  } catch (err) {
    console.error("❌ Analytics error:", err);
    return error(res, err.message);
  }
}

module.exports = { getRestaurantAnalytics };
