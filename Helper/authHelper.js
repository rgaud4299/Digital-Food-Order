const dayjs = require("dayjs");
const { generateToken } = require("../utils/jwt");
const prisma = require("../utils/prisma");
const { ISTFormat, ISTDate, parseDurationToExpiresAt } = require("../utils/helper");
const { success } = require("../utils/response");

exports.handleSuccessfulLogin = async (
    user,
    agent,
    ip,
    latitude,
    longitude,
    res,
    status = "Success"
) => {
    const now = ISTDate();

    const historyData = {
        user_id: user.uuid,
        device: agent.device?.toString?.() || String(agent.device || ""),
        operating_system: agent.os?.toString?.() || String(agent.os || ""),
        browser: agent.toAgent ? agent.toAgent() : "",
        ip_address: ip,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        user_agent: agent.toAgent ? agent.toAgent() : "",
        status,
        created_at: now,
        updated_at: now,
    };

    // ✅ Always record login history (Success or Failed)
    await prisma.login_history.create({ data: historyData });

    // If failed, just stop here (no token generation)
    if (status === "Failed") {
        return error(res, "Incorrect password", RESPONSE_CODES.FAILED, 400);
    }

    // ✅ Token + Session creation
    const tokenPayload = {
        uuid: user.uuid,
        email: user.email,
        role: user.role,
        restaurant_id: user?.restaurant_id ? user.restaurant_id : null,
    };

    const token = generateToken(tokenPayload);

    // let expiresAt = ISTDate(dayjs().add(value, unit).toDate());
    let expiresAt = parseDurationToExpiresAt(process.env.JWT_EXPIRES_IN);



    await prisma.session_tokens.create({
        data: {
            owner_id: user.uuid,
            owner_type: user.role,
            token,
            token_type: "app",
            expires_at: expiresAt,
            status: "Active",
            created_at: ISTDate(),
            updated_at: ISTDate(),
        },
    });

    if (user.restaurant_id) {
        user.restaurant = await prisma.restaurants.findUnique({
            where: { uuid: BigInt(user.restaurant_id) },
        });
    }
    // expiresAt = ISTFormat(expiresAt)
    const ExpiresAt = process.env.JWT_EXPIRES_IN
    return success(res, "Login successful", {
        token,
        expires_at: ExpiresAt,
        user: {
            name: user.name,
            email: user.email,
            role: user.role,
            restaurant_info: user.restaurant_id ? user.restaurant.is_verified : null,
        },
    })


}