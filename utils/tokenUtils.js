
const { ISTDateNotformat } = require("./helper");
const { verifyToken } = require("./jwt");
const prisma = require("./prisma");


async function verifyTokenUtil(token) {
    try {
        if (!token) {
            return { success: false, message: "Missing token" };
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return { success: false, message: "Invalid Bearer Token" };
        }

        const accessToken = await prisma.session_tokens.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!accessToken) {
            return { success: false, message: "Token not found or user logged out" };
        }
        //  Handle soft delete check
        if (accessToken.user.delete_status === 1 || accessToken.user.deleted_at !== null) {
            return error(res, "Account has been deactivated or deleted", RESPONSE_CODES.FAILED, 403);
        }
        if (accessToken.expires_at) {
            const now = ISTDateNotformat();
            const expires = ISTDateNotformat(accessToken.expires_at);
            if (now.isAfter(expires)) {
                return { success: false, message: "Token expired" };
            }
        }

        if (accessToken.status === "Inactive") {
            return { success: false, message: "Inactive token" };
        }

        if (!["PlatformAdmin", "RestaurantStaff","Customer"].includes(accessToken.user.role)) {
            return { success: false, message: "Unauthorized role" };
        }

        if (!accessToken.user_id) {
            return { success: false, message: "User ID missing in token" };
        }
        //  if(accessToken.user.restaurant_id===null ){
        //     return { success: false, message: "You are not linked to any restaurant" };
        // }
        // ✅ Return clean object
        return {
            success: true,
            user: {
                user_id: accessToken.user.uuid,
                role: accessToken.user.role,
                restaurant_id: accessToken.user?.restaurant_id ? accessToken.user.restaurant_id : null,
            },
        };
    } catch (err) {
        console.error("verifyTokenUtil Error:", err);
        return { success: false, message: "Internal server error" };
    }
}

async function verifyCustomerTokenUtil(token) {
  try {
    if (!token) {
      return { success: false, message: "Missing token" };
    }

    // 🔐 Verify JWT signature
    const decoded = verifyToken(token);
    if (!decoded) {
      return { success: false, message: "Invalid Bearer Token" };
    }

    // 🔍 Find session token
    const session = await prisma.customer_session_tokens.findUnique({
      where: { token },
      include: { customer: true },
    });

    if (!session) {
      return { success: false, message: "Token not found or logged out" };
    }

    const customer = session.customer;

    // 🗑️ Soft delete check
    if (
      customer.delete_status === 1 ||
      customer.deleted_at !== null ||
      customer.is_active === false
    ) {
      return { success: false, message: "Customer account deactivated" };
    }

    // ⏰ Expiry check
    if (session.expires_at) {
      const now = ISTDateNotformat();
      const expires = ISTDateNotformat(session.expires_at);
      if (now.isAfter(expires)) {
        return { success: false, message: "Token expired" };
      }
    }

    // 🚫 Token status check
    if (session.status !== "Active") {
      return { success: false, message: "Inactive token" };
    }

    // 🧾 Customer role validation
    if (!["Guest", "Registered"].includes(customer.role)) {
      return { success: false, message: "Unauthorized customer role" };
    }

    // ✅ SUCCESS RESPONSE
    return {
      success: true,
      customer: {
        customer_id: customer.uuid,
        role: customer.role,
        restaurant_id: customer.restaurant_id ?? null,
        is_guest: customer.is_guest,
      },
    };
  } catch (err) {
    console.error("verifyCustomerTokenUtil Error:", err);
    return { success: false, message: "Internal server error" };
  }
}


module.exports = { verifyTokenUtil,verifyCustomerTokenUtil }