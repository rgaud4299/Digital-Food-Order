// controllers/analyticsController.js
const { success, error } = require("../../utils/response");
const analyticsService = require("../../services/analytics.service");

async function getRestaurantAnalytics(req, res) {
  try {
    const { days } = req.query;
    const restaurant_id = req.user?.restaurant_id ? BigInt(req.user.restaurant_id) : null;
    if (!restaurant_id) return error(res, "restaurant_id is required");
    role = req.user?.role || null;
    if (role !== 'PlatformAdmin') {
      return error(res, "Unauthorized access");
    }
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
