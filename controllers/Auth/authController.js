const bcrypt = require('bcrypt');
const prisma = require('../../utils/prisma');
const { success, error, successGetAll } = require('../../utils/response');
const {
  maskEmail,
  maskMobile,
  sendOtpRegistration,
  getClientIp,
  useragent,
  RESPONSE_CODES,
  ISTDate,
  verifyOtp,
  ISTFormat, randomtoken, parseDurationToExpiresAt,
  detectUsernameType,
  expandDuration,
  randomUUID,
} = require('../../utils/helper');
const { sendDynamicMessageQ } = require('../../utils/Msg_Queue/producer');
const { handleSuccessfulLogin } = require('../../Helper/authHelper');
const { generateToken } = require('../../utils/jwt');



//REGISTER 
exports.register = async (req, res) => {
  const { mobile_no } = req.body;
  try {

    const existingUser = await prisma.users.findUnique({ where: { mobile_no } });
    if (existingUser) {
      return error(
        res,
        'Mobile number already registered',
        RESPONSE_CODES.DUPLICATE,
        409
      );
    }

    const mobile_Otp = await sendOtpRegistration(mobile_no, 'mobile', mobile_no);

    const placeholders_mobile = {
      "{OTP}": mobile_Otp
    };

    const msg_data_mobile = {
      msg_cont_id: 1,
      placeholders: placeholders_mobile,
      mobile_no: mobile_no,
      email: "",
      attachment: ""
    };

    // const placeholders_email = {
    //   "{OTP}": email_Otp
    // };
    // const msg_data_email = {
    //   msg_cont_id: 1,
    //   placeholders: placeholders_email,
    //   mobile_no: mobile_no,
    //   email: email,
    //   attachment: ""
    // };


    // const responseMsgEmail = await sendDynamicMessageQ(msg_data_email)

    // const responseMsg = await sendDynamicMessageQ(msg_data_mobile)
    // if (!responseMsg.success) {
    //   return error(res, `Failed to send OTP to your registered mobile no.`, RESPONSE_CODES.FAILED, 400);
    // }
    return success(res, `OTP sent for  mobile verification ${mobile_Otp}`, {
      Mobile: maskMobile(mobile_no),
    });

  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};
exports.verifyRegisterOtp = async (req, res) => {
  let { mobile_no, mobileOtp } = req.body;

  if (!mobile_no || !mobileOtp) {
    return error(res, 'mobile_no and mobileOtp are required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }
  try {
    mobile_no = mobile_no + "";
    const existingUser = await prisma.users.findUnique({ where: { mobile_no } });

    if (existingUser) {
      return error(res, 'User already Registered', RESPONSE_CODES.DUPLICATE, 409);
    }

    const isValidOtp = await verifyOtp(mobile_no, mobileOtp, 'mobile');
    if (!isValidOtp.success) {
      return error(res, isValidOtp.message, RESPONSE_CODES.FAILED, 400);
    }

    const tempToken = randomtoken();
    let expireAt = parseDurationToExpiresAt(process.env.temporary_tokens_EXPIRY || "10m");
    console.log('expireAt', expireAt);

    await prisma.temporary_tokens.create({
      data: {
        user_id: mobile_no,
        token: tempToken,
        type: "mobile",
        expires_at: expireAt,
        created_at: ISTDate(),
      },
    });
    return success(res, "OTP verified successfully", {
      token: tempToken
    });
  } catch (err) {
    console.error('OTP verification error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};
exports.registerUser = async (req, res) => {
  try {

    const { name, email, password,
      mobile_no, token } = req.body;
    const is_admin = req.user && req.user.role === 'Admin';
    if (!is_admin) {
      const temporary_tokens = await prisma.temporary_tokens.findUnique({
        where: {
          token: token,
        },
      });

      if (!temporary_tokens) {
        return error(res, "Invalid token", RESPONSE_CODES.REDIRECT, 400);
      }
      if (temporary_tokens.isVerified === true) {
        return error(res, "Token already Verified", RESPONSE_CODES.REDIRECT, 400);
      }
      if (ISTDate(temporary_tokens.expires_at) < ISTDate()) {
        return error(res, "Token expired", RESPONSE_CODES.REDIRECT, 400);
      }

      if (temporary_tokens.user_id === mobile_no) {
        return error(res, "Mobile no. is Mismatched", RESPONSE_CODES.REDIRECT, 400);
      }
      await prisma.temporary_tokens.delete({
        where: {
          token: token,
        },
      });
    }

    const existingUser = await prisma.users.findUnique({ where: { mobile_no } });
    const existingEmail = await prisma.users.findUnique({ where: { email } });

    if (existingUser) {
      return error(res, 'User already registered with this mobile number');
    }

    if (existingEmail) {
      return error(res, ' This email is already registered with another account');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.users.create({
      data: {
        uuid: randomUUID().toString(),
        name: name,
        email: email,
        mobile_no: mobile_no,
        password: hashedPassword,
        status: 'Active',
        is_login_otp_enable: false,
        role: 'PlatformAdmin',
        created_at: ISTDate(),
        updated_at: ISTDate(),
      },
    });



    return success(res, !is_admin ? `Your account created successfully with us ` : `User registered successfully`);
  } catch (err) {
    console.error('User registration error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};
// LOGIN
exports.loginUser = async (req, res) => {
  const { username, password, latitude, longitude } = req.body;
  const agent = useragent.parse(req.headers["user-agent"] || "");
  const ip = getClientIp(req);

  if (agent.isBot) {
    return error(res, "Unidentified User Agent", RESPONSE_CODES.FAILED, 400);
  }

  try {
    const { usernameType } = detectUsernameType(username, res);
    if (!usernameType) return;

    const user = await prisma.users.findUnique({ where: { [usernameType]: username } });

    if (!user) {
      return error(res, "Invalid email or mobile number", RESPONSE_CODES.FAILED, 400);
    }

    //  Handle soft delete check
    if (user.delete_status === 1 || user.deleted_at !== null) {
      return error(res, "Account has been deactivated or deleted", RESPONSE_CODES.FAILED, 403);
    }

    // 3️⃣ Password validation
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return await handleSuccessfulLogin(user, agent, ip, latitude, longitude, res, "Failed");
    }

    // 4️⃣ OTP ENABLED LOGIN FLOW
    if (user.is_login_otp_enable) {
      // Generate and send OTP
      const otp = await sendOtpRegistration(user.mobile_no, "mobile", user.uuid);

      const placeholders = {
        "[OTP]": otp,
        "[NAME]": user.name,
        "[OTP_EXPIRY]": expandDuration(process.env.OTP_EXPIRY)
      };

      const msg_data = {
        msg_cont_id: 1,
        placeholders,
        mobile_no: user.mobile_no ? user.mobile_no : "",
        email: user.email ? user.email : "",
        attachment: ""
      };

      const responseMsg = await sendDynamicMessageQ(msg_data)

      if (!responseMsg.success) {
        return error(res, `Failed to send OTP to your registered mobile no.`, RESPONSE_CODES.FAILED, 400);
      }

      return success(res, `OTP sent successfully ${otp}`, {
        "mobile": maskMobile(user.mobile_no)
      }, RESPONSE_CODES.VERIFICATION_PENDING);
    }

    // 5️⃣ DIRECT LOGIN FLOW (no OTP)
    return await handleSuccessfulLogin(user, agent, ip, latitude, longitude, res, "Success");

  } catch (err) {
    console.error("Login error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};
exports.verifyLoginOtp = async (req, res) => {
  const { username, password, otp, latitude, longitude } = req.body;
  const agent = useragent.parse(req.headers["user-agent"] || "");
  const ip = getClientIp(req);

  if (!username || !password || !otp || !latitude || !longitude) {
    return error(res, "Missing required fields", RESPONSE_CODES.FAILED, 400);
  }

  try {
    const { usernameType } = detectUsernameType(username, res);

    if (!usernameType) return;
    const user = await prisma.users.findUnique({ where: { [usernameType]: username } });

    // 2️⃣ User existence check
    if (!user) {
      return error(res, "Username must be email or mobile number", RESPONSE_CODES.FAILED, 400);
    }

    // 3️⃣ Verify OTP
    const targetType = "mobile";
    const isValidOtp = await verifyOtp(user.uuid, otp, targetType);
    if (!isValidOtp.success) {
      return error(res, isValidOtp.message, RESPONSE_CODES.FAILED, 400);
    }
    // 2️⃣ Verify password again for security
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await handleSuccessfulLogin(user, agent, ip, latitude, longitude, res, "Failed");
      return;
    }

    // 4️⃣ OTP verified → complete login
    return await handleSuccessfulLogin(user, agent, ip, latitude, longitude, res, "Success");

  } catch (err) {
    console.error("OTP Verify error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};
exports.logoutUser = async (req, res) => {
  try {
    const user_id = req.user?.user_id; // correct destructuring
    const { all_device = false } = req.body || {};
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!token) {
      return error(res, "Token required", RESPONSE_CODES.FAILED, 400);
    }

    if (all_device) {
      await prisma.session_tokens.deleteMany({
        where: {
          user_id: user_id,
          token_type: "app"
        },
      });
    } else {
      // delete only current token 
      const tokenExist = await prisma.session_tokens.findUnique({
        where: { token },
      });
      console.log("tokenExist", tokenExist);

      if (tokenExist) {
        await prisma.session_tokens.delete({
          where: { token },
        });
      } else {
        return error(res, "user already logout by another user", RESPONSE_CODES.FAILED, 500);
      }
    }

    return success(res, "Logout successful");

  } catch (err) {
    console.error("Logout error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};





exports.forgotPassword = async (req, res) => {

  const { username } = req.body;
  try {

    const { usernameType } = detectUsernameType(username, res);
    if (!usernameType) return;
    console.log("Username Type:", usernameType);

    const user = await prisma.users.findUnique({ where: { [usernameType]: username } });
    if (!user) {
      return error(res, "User not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    // Send OTP (same function used in your login flow)
    const otp = await sendOtpRegistration(username, usernameType, user.uuid);

    return success(res, `OTP sent successfully ${otp}`, {
      [usernameType]: usernameType === 'mobile' ? maskMobile(user.mobile_no) : maskEmail(user.email)
    }, RESPONSE_CODES.VERIFICATION_PENDING);

  } catch (err) {
    console.error("Forgot Password Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};
exports.verifyForgotOtp = async (req, res) => {
  const { username, otp } = req.body;

  try {
    // 🧩 Check required fields
    if (!otp || !username) {
      return error(res, "OTP and Username (either email or mobile number) are required", RESPONSE_CODES.FAILED, 400);
    }
    const { usernameType } = detectUsernameType(username, res);
    if (!usernameType) return;

    const user = await prisma.users.findUnique({ where: { [usernameType]: username } });
    if (!user) {
      return error(res, "User not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    // 🧩 Verify OTP (using your helper)
    const isValid = await verifyOtp(user.uuid, otp, usernameType);
    if (!isValid.success) {
      return error(res, isValid.message, RESPONSE_CODES.FAILED, 400);
    }

    // 🧩 Generate temporary token for password reset
    const tempToken = randomtoken();
    let expireAt = parseDurationToExpiresAt("5m");

    await prisma.temporary_tokens.create({
      data: {
        user_id: user.uuid,
        token: tempToken,
        type: usernameType,
        expires_at: expireAt,
        created_at: ISTDate(),
      },
    });
    return success(res, "OTP verified successfully", {
      token: tempToken
    }, RESPONSE_CODES.VERIFICATION_PENDING);
  } catch (err) {
    console.error("Verify Forgot OTP Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};
exports.resetPassword = async (req, res) => {
  const { token, new_password, confirm_password } = req.body;

  try {
    if (!token || !new_password || !confirm_password) {
      return error(res, "token, new password and confirm password are required", RESPONSE_CODES.FAILED, 400);
    }
    if (new_password !== confirm_password) {
      return error(res, "New password and confirm password must match", RESPONSE_CODES.FAILED, 400);
    }

    const passwordResetToken = await prisma.temporary_tokens.findUnique({
      where: {
        token: token,
      },
    });

    if (!passwordResetToken) {
      return error(res, "Invalid token", RESPONSE_CODES.REDIRECT, 400);
    }
    console.log(ISTDate(passwordResetToken.expires_at), ISTDate(), "Expires At");

    if (ISTDate(passwordResetToken.expires_at) < ISTDate()) {
      return error(res, "Token expired", RESPONSE_CODES.REDIRECT, 400);
    }
    if (passwordResetToken.isVerified === true) {
      return error(res, "Token already Verified", RESPONSE_CODES.REDIRECT, 400);
    }

    // 🔍 Find user
    const user = await prisma.users.findUnique({
      where: { uuid: passwordResetToken.user_id },
    });
    if (!user) return error(res, "User not found", RESPONSE_CODES.FAILED, 404);

    // 🔑 Hash new password
    const hashed = await bcrypt.hash(new_password, 10);

    // 💾 Update user password & reset OTP status
    await prisma.users.update({
      where: { uuid: passwordResetToken.user_id },
      data: {
        password: hashed,
        updated_at: ISTDate(),
      },
    });
    // ✅ Mark token as used
    await prisma.temporary_tokens.delete({
      where: {
        token: token,
      },
    });

    return success(res, "Password reset successfully");
  } catch (err) {
    console.error("Reset Password Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};





exports.loginCustomer = async (req, res) => {
  const { username, password, latitude, longitude } = req.body;
  const agent = useragent.parse(req.headers["user-agent"] || "");
  const ip = getClientIp(req);

  if (agent.isBot) {
    return error(res, "Unidentified User Agent", RESPONSE_CODES.FAILED, 400);
  }

  try {
    const { usernameType } = detectUsernameType(username, res);
    if (!usernameType) return;

    const customer = await prisma.customers.findUnique({ where: { [usernameType]: username } });

    if (!customer) {
      return error(res, "Invalid email or mobile number", RESPONSE_CODES.FAILED, 400);
    }

    //  Handle soft delete check
    if (customer.delete_status === 1 || customer.deleted_at !== null) {
      return error(res, "Account has been deactivated or deleted", RESPONSE_CODES.FAILED, 403);
    }

    // 3️⃣ Password validation
    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) {
      return error(res, "Incorrect password", RESPONSE_CODES.FAILED, 400);
    }

    // 4️⃣ OTP ENABLED LOGIN FLOW
    if (customer.is_login_otp_enable) {
      // Generate and send OTP
      const otp = await sendOtpRegistration(customer.mobile_no, "mobile", customer.uuid);

      const placeholders = {
        "[OTP]": otp,
        "[NAME]": customer.name,
        "[OTP_EXPIRY]": expandDuration(process.env.OTP_EXPIRY)
      };

      const msg_data = {
        msg_cont_id: 1,
        placeholders,
        mobile_no: user.mobile_no ? user.mobile_no : "",
        email: user.email ? user.email : "",
        attachment: ""
      };

      const responseMsg = await sendDynamicMessageQ(msg_data)

      if (!responseMsg.success) {
        return error(res, `Failed to send OTP to your registered mobile no.`, RESPONSE_CODES.FAILED, 400);
      }

      return success(res, `OTP sent successfully ${otp}`, {
        "mobile": maskMobile(customer.mobile_no)
      }, RESPONSE_CODES.VERIFICATION_PENDING);
    }



    // ✅ Token + Session creation
    const tokenPayload = {
      id: parseInt(customer.uuid),
      uuid: customer.uuid,
      email: customer.email,
      role: customer.role,
      restaurant_id: customer?.restaurant_id ? customer.restaurant_id : null,
    };

    const token = generateToken(tokenPayload);

    // let expiresAt = ISTDate(dayjs().add(value, unit).toDate());
    let expiresAt = parseDurationToExpiresAt(process.env.JWT_EXPIRES_IN);

    await prisma.session_tokens.create({
      data: {
        owner_id: customer.uuid,
        owner_type: "Customer",
        token,
        token_type: "app",
        expires_at: expiresAt,
        status: "Active",
        created_at: ISTDate(),
        updated_at: ISTDate(),
      },
    });


    // expiresAt = ISTFormat(expiresAt)
    const ExpiresAt = process.env.JWT_EXPIRES_IN
    return success(res, "Login successful", {
      token,
      expires_at: ExpiresAt,
      user: {
        name: customer.name,
        email: customer.email,
        role: customer.role,
      },
    })

  } catch (err) {
    console.error("Login error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

exports.sendRegisterCustomerOtp = async (req, res) => {
  const { mobile_no } = req.body;
  try {

    const existingUser = await prisma.customers.findUnique({ where: { mobile_no } });
    if (existingUser) {
      return error(
        res,
        'Mobile number already registered',
        RESPONSE_CODES.DUPLICATE,
        409
      );
    }

    const mobile_Otp = await sendOtpRegistration(mobile_no, 'mobile', mobile_no);

    const placeholders_mobile = {
      "{OTP}": mobile_Otp
    };

    const msg_data_mobile = {
      msg_cont_id: 1,
      placeholders: placeholders_mobile,
      mobile_no: mobile_no,
      email: "",
      attachment: ""
    };

    // const placeholders_email = {
    //   "{OTP}": email_Otp
    // };
    // const msg_data_email = {
    //   msg_cont_id: 1,
    //   placeholders: placeholders_email,
    //   mobile_no: mobile_no,
    //   email: email,
    //   attachment: ""
    // };


    // const responseMsgEmail = await sendDynamicMessageQ(msg_data_email)

    // const responseMsg = await sendDynamicMessageQ(msg_data_mobile)
    // if (!responseMsg.success) {
    //   return error(res, `Failed to send OTP to your registered mobile no.`, RESPONSE_CODES.FAILED, 400);
    // }
    return success(res, `OTP sent for  mobile verification ${mobile_Otp}`, {
      Mobile: maskMobile(mobile_no),
    });

  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};
exports.verifyCustomerRegisterOtp = async (req, res) => {
  let { mobile_no, mobileOtp } = req.body;

  if (!mobile_no || !mobileOtp) {
    return error(res, 'mobile_no and mobileOtp are required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }
  try {
    mobile_no = mobile_no + "";
    const existingUser = await prisma.customers.findUnique({ where: { mobile_no } });

    if (existingUser) {
      return error(res, 'User already Registered', RESPONSE_CODES.DUPLICATE, 409);
    }

    const isValidOtp = await verifyOtp(mobile_no, mobileOtp, 'mobile');
    if (!isValidOtp.success) {
      return error(res, isValidOtp.message, RESPONSE_CODES.FAILED, 400);
    }

    const tempToken = randomtoken();
    let expireAt = parseDurationToExpiresAt(process.env.temporary_tokens_EXPIRY || "10m");
    console.log('expireAt', expireAt);

    await prisma.temporary_tokens.create({
      data: {
        user_id: mobile_no,
        token: tempToken,
        type: "mobile",
        expires_at: expireAt,
        created_at: ISTDate(),
      },
    });
    return success(res, "OTP verified successfully", {
      token: tempToken
    });
  } catch (err) {
    console.error('OTP verification error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};
exports.registerCustomer = async (req, res) => {
  try {

    const { name, email, password,
      mobile_no, token } = req.body;
    const is_admin = req.user && req.user.role === 'Admin';
    if (!is_admin) {
      const temporary_tokens = await prisma.temporary_tokens.findUnique({
        where: {
          token: token,
        },
      });

      if (!temporary_tokens) {
        return error(res, "Invalid token", RESPONSE_CODES.REDIRECT, 400);
      }
      if (temporary_tokens.isVerified === true) {
        return error(res, "Token already Verified", RESPONSE_CODES.REDIRECT, 400);
      }
      if (ISTDate(temporary_tokens.expires_at) < ISTDate()) {
        return error(res, "Token expired", RESPONSE_CODES.REDIRECT, 400);
      }

      if (temporary_tokens.user_id === mobile_no) {
        return error(res, "Mobile no. is Mismatched", RESPONSE_CODES.REDIRECT, 400);
      }
      await prisma.temporary_tokens.delete({
        where: {
          token: token,
        },
      });
    }

    const existingUser = await prisma.customers.findUnique({ where: { mobile_no } });
    const existingEmail = await prisma.customers.findUnique({ where: { email } });

    if (existingUser) {
      return error(res, 'User already registered with this mobile number');
    }

    if (existingEmail) {
      return error(res, ' This email is already registered with another account');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.customers.create({
      data: {
        uuid: randomUUID().toString(),
        name: name,
        email: email,
        mobile_no: mobile_no,
        password: hashedPassword,
        status: 'Active',
        is_login_otp_enable: false,
        created_at: ISTDate(),
        updated_at: ISTDate(),
      },
    });



    return success(res, !is_admin ? `Your account created successfully with us ` : `User registered successfully`);
  } catch (err) {
    console.error('User registration error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};
