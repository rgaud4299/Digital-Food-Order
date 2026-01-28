
const { RESPONSE_CODES, ISTDate, ISTDateNotformat } = require("../utils/helper");
const { error } = require("../utils/response");
const prisma = require("../utils/prisma");
const { verifyToken } = require("../utils/jwt");
const UAParser = require("ua-parser-js");

async function responseModeTokenMiddleware(req, res, next) {

    try {

        const uaString = req.headers["user-agent"] || "";
        const parser = new UAParser(uaString);
        const result = parser.getResult();

        const isBrowser = !!result.browser.name;
        // const isBrowser = true
        const request_mode = isBrowser ? "app" : "api";

        // 🔹 Simple check
        if (request_mode && !["app", "api"].includes(request_mode)) {
            return error(
                res,
                "request_mode must be either 'app' or 'api'",
                RESPONSE_CODES.VALIDATION_ERROR,
                422
            );
        }
        console.log("isBrowser", request_mode);

        const authHeader = req.headers["authorization"];

        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return error(res, "User Unauthenticated", RESPONSE_CODES.FAILED, 400);
        }

        const token = authHeader.substring(7);
        // 1️⃣ If request_mode === "app" → JWT verification
        let accessToken;
        // 3️⃣ DB check
        if (request_mode === "app") {
            accessToken = await prisma.session_tokens.findUnique({
                where: { token },
                include: { user: true },
            });
        } else if (request_mode === "api") {
            accessToken = await prisma.user_tokens.findUnique({
                where: { token },
                include: { user: true },
            });
        }

        if (!accessToken) {
            return error(
                res,
                "User already logged out or Token not found",
                RESPONSE_CODES.VALIDATION_ERROR,
                400
            );
        }

        // 1️⃣ Check request_mode matches token_type
        if (accessToken.token_type !== request_mode) {
            return error(
                res,
                `Token type mismatch. Expected ${request_mode} but got ${accessToken.token_type}`,
                RESPONSE_CODES.FAILED,
                400
            );
        }

        let transaction_mode;

        // 1️⃣ If request_mode === "app" → JWT verification
        if (accessToken.token_type === "app") {
            transaction_mode = "Web"
            // 2️⃣ JWT verify
            const decoded = verifyToken(token);
            if (!decoded) {
                return error(res, "Invalid Bearer Token ", RESPONSE_CODES.FAILED, 400);
            }
        }
        // 8️⃣ IP whitelist check → only if request_mode !== "app" AND token_type === "api"
        if (accessToken.token_type === "api") {
            transaction_mode = 'Api'
            const clientIp = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
            const whitelist = await prisma.user_ip_whitelist.findFirst({
                where: {
                    user_id: accessToken.user.uuid,
                    ip_address: clientIp,
                    status: "Active",
                },
            });

            if (!whitelist) {
                return error(
                    res,
                    "Unauthorized IP Address. Please use registered whitelist Ip.",
                    RESPONSE_CODES.FAILED,
                    403
                );
            }
        }

        // 4️⃣ Expiry check
        if (accessToken.expires_at) {
            const now = ISTDateNotformat();
            const expires = ISTDateNotformat(accessToken.expires_at);
            if (now.isAfter(expires)) {
                return error(res, "Token expired", RESPONSE_CODES.FAILED, 400);
            }
        }

        // 5️⃣ Status check
        if (accessToken.status === "Inactive") {
            return error(
                res,
                "Unauthorized (Inactive Token)",
                RESPONSE_CODES.FAILED,
                400
            );
        }

        // 6️⃣ Role check
        if (!["Admin", "User"].includes(accessToken.user.role)) {
            return error(res, "Unauthorized Role", RESPONSE_CODES.FAILED, 403);
        }

        // 7️⃣ User id check
        if (!accessToken.user_id) {
            return error(
                res,
                "User id not available in token, user_id is required",
                RESPONSE_CODES.FAILED,
                422
            );
        }

        // ✅ Attach user details to request
        req.user = {
            user_id: accessToken.user.uuid,
            role: accessToken.user.role,
            transaction_mode,
        };

        return next();
    } catch (err) {
        console.error("Auth Middleware Error:", err);
        return error(res, "Internal Server Error", RESPONSE_CODES.FAILED, 500);
    }
}

module.exports = responseModeTokenMiddleware;
