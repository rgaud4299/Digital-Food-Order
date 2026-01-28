const prisma = require("../utils/prisma");
const { error, success } = require("../utils/response");
const { RESPONSE_CODES } = require("../utils/helper");


async function verifyMpin(user_id, mPin) {
  if (!user_id || !mPin) return false;

  // MPIN must be 4-digit number
  if (!/^\d{4}$/.test(mPin)) return false;

  const user = await prisma.users.findUnique({
    where: { uuid: user_id },
    select: { mpin: true }
  });

  if (!user) return false;
  return parseInt(user.mpin) === parseInt(mPin);
}

async function verifyMpinController(req, res) {
  try {
    const { mPin } = req.body || {};
    const user_id = req.user?.user_id;
    if (!mPin) {
      return error(res, "MPIN must be a 4-digit number", RESPONSE_CODES.VALIDATION_ERROR, 422);
    }
    // ✅ MPIN must be 4-digit number
    if (!/^\d{4}$/.test(mPin)) {
      return error(res, "MPIN must be a 4-digit number", RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const isValid = await verifyMpin(user_id, mPin);

    if (!isValid) {
      return error(res, "Invalid MPIN", RESPONSE_CODES.FAILED, 400);
    }

    return success(res, "MPIN verified successfully");
  } catch (err) {
    console.error("MPIN Controller Error:", err);
    return error(res, "Internal Server Error", RESPONSE_CODES.FAILED, 500);
  }
}



async function verifyMpinMiddleware(req, res, next) {
  try {
    
    const { mPin } = req.body;
    const user_id = req.user?.user_id;

    if (!mPin) {
      return error(res, "MPIN must be a 4-digit number", RESPONSE_CODES.VALIDATION_ERROR, 422);
    }
    // ✅ MPIN must be 4-digit number
    if (!/^\d{4}$/.test(mPin)) {
      return error(res, "MPIN must be a 4-digit number", RESPONSE_CODES.VALIDATION_ERROR, 422);
    }
    const isValid = await verifyMpin(user_id, mPin);

    if (!isValid) {
      return error(res, "Oops..! Invalid MPIN", RESPONSE_CODES.FAILED, 400);
    }

    next(); // ✅ MPIN valid, continue request
  } catch (err) {
    console.error("MPIN Middleware Error:", err);
    return error(res, "Internal Server Error", RESPONSE_CODES.FAILED, 500);
  }
}

module.exports = { verifyMpinMiddleware, verifyMpinController, verifyMpin };
