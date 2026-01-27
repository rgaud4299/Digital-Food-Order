
const { ISTDateNotformat } = require("./helper");
const { verifyToken } = require("./jwt");
const prisma = require("./prisma");


async function verifyTokenUtil(token) {
  try {
    if (!token) {
      return { success: false, message: "Missing token" };
    }

    // 🔐 JWT verify
    const decoded = verifyToken(token);
    if (!decoded) {
      return { success: false, message: "Invalid Bearer Token" };
    }

    // 🔍 Find session
    const session = await prisma.session_tokens.findUnique({
      where: { token },
    });

    if (!session) {
      return { success: false, message: "Token not found or logged out" };
    }

    // 🚫 Status check
    if (session.status !== "Active") {
      return { success: false, message: "Inactive token" };
    }

    // ⏰ Expiry check (IST safe)
    if (session.expires_at) {
      const now = ISTDateNotformat();
      const expires = ISTDateNotformat(session.expires_at);
      if (now.isAfter(expires)) {
        return { success: false, message: "Token expired" };
      }
    }

    // =========================
    // 👤 USER (Admin / Staff)
    // =========================
    if (["PlatformAdmin", "RestaurantStaff"].includes(session.owner_type)) {
      const user = await prisma.users.findUnique({
        where: { uuid: session.owner_id },
      });

      if (!user) {
        return { success: false, message: "User not found" };
      }

      // 🗑 Soft delete check
      if (user.delete_status === 1 || user.deleted_at !== null) {
        return { success: false, message: "Account deactivated or deleted" };
      }

      return {
        success: true,
        type: "User",
        user: {
          user_id: user.uuid,
          role: user.role,
          restaurant_id: user.restaurant_id ?? null,
        },
      };
    }

    // =========================
    // 🧑‍🍳 CUSTOMER
    // =========================
    if (session.owner_type === "Customer") {
      const customer = await prisma.customers.findUnique({
        where: { uuid: session.owner_id },
      });

      if (!customer) {
        return { success: false, message: "Customer not found" };
      }

      // 🗑 Soft delete / inactive
      if (
        customer.delete_status === 1 ||
        customer.deleted_at !== null ||
        customer.is_active === false
      ) {
        return { success: false, message: "Customer account deactivated" };
      }

      return {
        success: true,
        type: "Customer",
        customer: {
          customer_id: customer.uuid,
          role: customer.role,
          restaurant_id: customer.restaurant_id ?? null,
          is_guest: customer.is_guest,
        },
      };
    }

    return { success: false, message: "Invalid token owner type" };
  } catch (err) {
    console.error("verifyTokenUtil Error:", err);
    return { success: false, message: "Internal server error" };
  }
}



module.exports = { verifyTokenUtil }