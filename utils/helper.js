const { verifyToken } = require('./jwt');

const { PrismaClient } = require('@prisma/client');
const useragent = require('useragent');
const prisma = new PrismaClient();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const crypto = require("crypto");
const dotenv = require('dotenv');
const { error } = require('./response');
dotenv.config();

dayjs.extend(utc);
dayjs.extend(timezone);

const date = new Date();

const ISTFormat = (d = date) => (d ? dayjs(d).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null);
const ISTDate = (date) => (dayjs(date).tz("Asia/Kolkata").format("YYYY-MM-DDTHH:mm:ss.SSSZ"))
const ISTDateNotformat = (date) => dayjs(date).tz("Asia/Kolkata");

// Expiry Check Helper
const isValidExpiry = (expiryDate, referenceDate = ISTDate()) => {
  const expire = dayjs(expiryDate).tz("Asia/Kolkata");
  const current = dayjs(referenceDate).tz("Asia/Kolkata");
  return current.isBefore(expire) || current.isSame(expire);
}

// const getDayUTC = (dateStr, isStart = false) => {
//   if (isStart) {
//     // Start of the day UTC
//     return new Date(`${dateStr}T00:00:00Z`).toISOString();
//   } else {
//     // End of the day UTC  
//     return new Date(`${dateStr}T23:59:59Z`).toISOString();
//   }
// };

const getDayUTC = (dateStr, isStart = false) => {
  if (dateStr && isStart) {
    // IST start of day → UTC
    return new Date(`${dateStr}T00:00:00+05:30`).toISOString();
  } else if(dateStr) {
    // IST end of day → UTC
    return new Date(`${dateStr}T23:59:59+05:30`).toISOString();
  }
  return null
};

// OTP Generator
const randomUUID = () => Math.floor(100000 + Math.random() * 900000);

// Transaction ID Generator
const generateRandomTxnId = function generateRandomTxnId(string = 'T') {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomString = '';
  const n = 4;

  for (let i = 0; i < n; i++) {
    const index = Math.floor(Math.random() * characters.length);
    randomString += characters[index];
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const txnId = `${string}${year}${month}${day}${hours}${minutes}${seconds}${randomString}`;

  return txnId;
}

const randomtoken = () => {    // Generate MD5 token (random string + timestamp for uniqueness)
  const rawString = generateRandomTxnId();
  return crypto.createHash("md5").update(rawString).digest("hex");
}
// Mobile Masking
const maskMobile = (mobile) => {
  if (!mobile || mobile.length < 4) return '****';
  return `****${mobile.slice(-4)}`;
};
const maskValue = (value, unmaskedCount = 4, maskChar = '*') => {
  if (!value) return '';
  const str = String(value); // ensure it's a string
  if (str.length <= unmaskedCount) return maskChar.repeat(str.length);

  const maskedLength = str.length - unmaskedCount;
  return maskChar.repeat(maskedLength) + str.slice(-unmaskedCount);
};
//  Email Masking
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '****@****';
  const [local, domain] = email.split('@');
  const visible = local.length > 2 ? local.slice(0, 2) : local.charAt(0);
  return `${visible}****@${domain}`;
};

// Send OTP and Save to DB
const sendOtpRegistration = async (receiver, type, user_id) => {
  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
  const hashedOtp = (otp);
  const expiresAt = parseDurationToExpiresAt(process.env.OTP_EXPIRY || '10m');


  // 🔒 Start a transaction for safety
  return await prisma.$transaction(async (tx) => {
    // Check existing OTP for same user & type
    const existingOtp = await tx.otp_verifications.findFirst({
      where: { user_id },
      orderBy: {
        id: 'desc',
      },
    });

    console.log(existingOtp, "existingOtp");

    if (existingOtp) {
      // 🌀 Overwrite old OTP instead of inserting new one
      const UpdateOtp = await tx.otp_verifications.update({
        where: { id: existingOtp.id },
        data: {
          otp: hashedOtp,
          expires_at: expiresAt,
          is_verified: false,
          type,
          created_at: ISTDate(),
          updated_at: ISTDate()
        }
      });
      console.log(UpdateOtp, "UpdateOtp");
    } else {

      // 🆕 Create new OTP entry if not exist
      await tx.otp_verifications.create({
        data: {
          user_id,
          otp: hashedOtp,
          type,
          expires_at: expiresAt,
          is_verified: false,
          created_at: ISTDate(),
          updated_at: ISTDate()
        }
      });
    }


    console.log(`✅ OTP for ${receiver} [${type}] is: ${otp}`);
    return otp;
  });
};


const verifyOtp = async (userId, otp, type) => {
  try {
    const now = ISTDate();

    // --- Find the OTP record ---
    const otpRecord = await prisma.otp_verifications.findFirst({
      where: {
        user_id: userId,
        type,
        otp: parseInt(otp, 10),
      },
      orderBy: {
        id: 'desc',
      },
    });

    // --- Validate OTP record ---
    if (!otpRecord) {
      return { success: false, message: `Invalid ${type} OTP` };
    }

    if (otpRecord.is_verified) {
      return { success: false, message: `${type} OTP already verified` };
    }
    console.log(otpRecord.expires_at, ISTDate(otpRecord.expires_at), ISTDate(), "otpRecord.expires_at");

    if (ISTDate(otpRecord.expires_at) < ISTDate()) {
      return { success: false, message: `${type} OTP expired` };
    }

    // --- Mark OTP as verified ---
    await prisma.otp_verifications.update({
      where: { id: otpRecord.id },
      data: { is_verified: true },
    });



    return { success: true, message: `${type} OTP verified successfully` };
  } catch (err) {
    console.error("Error verifying OTP:", err);
    return { success: false, message: "Something went wrong while verifying OTP" };
  }
};
//  Get Client IP Address
const getClientIp = (req) => {
  let ip = req.headers['x-forwarded-for']?.split(',')[0]
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || req.connection?.socket?.remoteAddress
    || null;

  if (ip === '::1') ip = '127.0.0.1';
  if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  return ip;
};

// Response Codes
const RESPONSE_CODES = {
  SUCCESS: 1,
  VALIDATION_ERROR: 2,
  FAILED: 0,
  DUPLICATE: 0,
  NOT_FOUND: 0,
  VERIFICATION_PENDING: 5,
  REDIRECT: 6
};

function normalizeStatus(status) {
  if (!status) return null;

  const value = status.toString().trim().toLowerCase();
  if (value === 'active') return 'Active';
  if (value === 'inactive') return 'Inactive';

  return null;
}

function parseDurationToExpiresAt(durationStr, base = dayjs()) {
  if (typeof durationStr !== 'string') {
    throw new TypeError('durationStr must be a string like "1h" or "30m"');
  }

  const trimmed = durationStr.trim().toLowerCase();
  const matches = trimmed.match(/^(\d+)([smhd])$/);
  if (!matches) {
    throw new Error('Invalid duration format. Use e.g. "3s", "1m", "2h", "1d"');
  }

  const value = parseInt(matches[1], 10);
  const shortUnit = matches[2];

  // dayjs accepts 'second','minute','hour','day'
  const unitMap = { s: 'second', m: 'minute', h: 'hour', d: 'day' };
  const unit = unitMap[shortUnit];
  if (!unit) throw new Error('Invalid duration unit');

  const expiresAtDayjs = dayjs(base).add(value, unit);
  const expiresAt = ISTDate(expiresAtDayjs.toDate());

  const ms = expiresAtDayjs.diff(base, 'millisecond');
  const seconds = Math.floor(ms / 1000);

  return expiresAt
}
function expandDuration(durationStr) {
  if (!durationStr) return "";

  const match = durationStr.match(/^(\d+)([smhd])$/i);
  if (!match) return durationStr; // return as-is if not matching

  const value = match[1];
  const unit = match[2].toLowerCase();

  const unitMap = {
    s: "Second",
    m: "Minute",
    h: "Hour",
    d: "Day"
  };

  const fullUnit = unitMap[unit] || "";
  // pluralize if value > 1
  const plural = value > 1 ? "s" : "";

  return `${value} ${fullUnit}${plural}`;
}


const verifyUserToken = async (token) => {
  try {
    // 1️⃣ Basic JWT verify (signature check)
    const decoded = verifyToken(token, token_type = 'app');
    if (!decoded) {
      return { valid: false, message: "Invalid Bearer Token" };
    }

    // 2️⃣ DB check (ensure token exists)
    let accessToken;
    if (token_type === 'app') {
      accessToken = await prisma.session_tokens.findUnique({
        where: { token },
        include: { user: true },
      });
      // } else if (token_type === 'api') {
      //   accessToken = await prisma.user_tokens.findUnique({
      //     where: { token },
      //     include: { user: true },
      //   });

    }

    if (!accessToken) {
      return { valid: false, message: "User already logged out or Token not found" };
    }

    // 3️⃣ Expiry check
    if (accessToken.expires_at) {
      const now = ISTDateNotformat();
      const expires = ISTDateNotformat(accessToken.expires_at);
      if (now.isAfter(expires)) {
        return { valid: false, message: "Token expired" };
      }
    }

    // 4️⃣ Status check
    if (accessToken.status === "Inactive") {
      return { valid: false, message: "Unauthorized (Inactive Token)" };
    }

    // 5️⃣ Role check
    if (!["Admin", "User"].includes(accessToken.user.role)) {
      return { valid: false, message: "Unauthorized Role" };
    }

    // 6️⃣ User id check
    if (!accessToken.user_id) {
      return { valid: false, message: "User id not available in token" };
    }

    // ✅ Success case
    return {
      valid: true,
      message: "Valid Token",
      data: {
        user_id: accessToken.user.uuid,
        role: accessToken.user.role,
        token_type: accessToken.token_type,
      },
    };
  } catch (err) {
    console.error("verifyUserToken Error:", err);
    return { valid: false, message: "Internal Server Error" };
  }
};
const detectUsernameType = (username, res = null) => {
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const mobileRegex = /^[6-9]\d{9}$/;

  let usernameType;

  if (emailRegex.test(username)) {
    usernameType = "email";
  } else if (mobileRegex.test(username)) {
    usernameType = "mobile_no";
  } else {
    const message = "Username must be a valid email or 10-digit mobile number";
    if (res) {
      return error(res, message, RESPONSE_CODES.FAILED, 400);
    }
    return { usernameType: null, msg: message };
  }
  return { usernameType, msg: null };
};


module.exports = {
  randomUUID,
  maskMobile,
  maskEmail,
  sendOtpRegistration,
  getClientIp,
  maskValue,
  useragent,
  RESPONSE_CODES,
  normalizeStatus,
  generateRandomTxnId,
  ISTFormat,
  ISTDate,
  getDayUTC,
  isValidExpiry, ISTDateNotformat,
  ISTDateNotformat, verifyOtp, randomtoken, parseDurationToExpiresAt,expandDuration, verifyUserToken, detectUsernameType
};

