const { verifyToken } = require("../utils/jwt");
const { RESPONSE_CODES, ISTDate, ISTDateNotformat } = require("../utils/helper");
const { error } = require("../utils/response");
const prisma = require("../utils/prisma");
const { verifyTokenUtil } = require("../utils/tokenUtils");



const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return error(res, "Authorization token missing", RESPONSE_CODES.FAILED, 400);
  }

  const result = await verifyTokenUtil(token);

  if (!result?.success) {
    return error(res, result.message || "Unauthorized", RESPONSE_CODES.FAILED, 400);
  }

  // 👇 dono cases handle
  if (result.user) {
    req.user = result.user;
  }

  if (result.customer) {
    req.customer = result.customer;
  }

  next();
};

module.exports = { authMiddleware };
