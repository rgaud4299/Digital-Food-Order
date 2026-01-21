
const bcrypt = require('bcrypt');
const prisma = require('../../../utils/prisma');
const { ISTFormat,RESPONSE_CODES,ISTDate ,randomtoken, parseDurationToExpiresAt, getDayUTC,ISTDate } = require('../../../utils/helper');
const { success, error, successGetAll } = require('../../../utils/response');
const { uploadImage, deleteImageIfExists } = require('../../../utils/fileUpload');


exports. changePassword = async (req, res) => {
  const { new_password, confirm_password } = req.body;
  const user_id = req.user.user_id
  try {
    if (!new_password || !confirm_password) {
      return error(res, " new password and confirm password are required", RESPONSE_CODES.FAILED, 400);
    }
    if (new_password !== confirm_password) {
      return error(res, "New password and confirm password must match", RESPONSE_CODES.FAILED, 400);
    }


    // 🔑 Hash new password
    const hashed = await bcrypt.hash(new_password, 10);

    // 💾 Update user password & reset OTP status
    await prisma.users.update({
      where: { uuid: user_id },
      data: {
        password: hashed,
        updated_at: ISTDate(),
      },
    });


    return success(res, "Password Change successfully");
  } catch (err) {
    console.error("Reset Password Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};
exports. loginOtpEnable = async (req, res) => {
  try {
    const loggedInId = BigInt(req.user.user_id);
    const loggedInRole = req.user.role;

    const requestedId = req.query.id;

    let uuid;

    // 1️⃣ If user passes ?id=... → only Admin can update other's OTP status
    if (requestedId) {
      if (loggedInRole !== "Admin") {
        return error(
          res,
          "You are not authorized to update other user's login OTP status",
          RESPONSE_CODES.UNAUTHORIZED,
          403
        );
      }
      uuid = BigInt(requestedId);
    } else {
      // Normal user → only their own status
      uuid = loggedInId;
    }

    // 2️⃣ Fetch user
    const user = await prisma.users.findUnique({
      where: { uuid },
      select: {
        is_login_otp_enable: true,
      },
    });

    if (!user) {
      return error(res, "User not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    // 3️⃣ Toggle OTP status
    const newStatus = user.is_login_otp_enable ? false : true;

    // 4️⃣ Update user
    await prisma.users.update({
      where: { uuid },
      data: {
        is_login_otp_enable: newStatus,
        updated_at: ISTDate(),
      },
    });

    return success(
      res,
      `Login OTP status changed to ${newStatus === true ? "Enabled" : "Disabled"} successfully`
    );

  } catch (err) {
    console.error("User login OTP status update error:", err);
    return error(
      res,
      "Failed to update login OTP status",
      RESPONSE_CODES.FAILED,
      500
    );
  }
};
exports. getUserProfile = async (req, res) => {
  try {
    const loggedInId = BigInt(req.user.user_id);
    const loggedInRole = req.user.role; // ⬅ Add role from token

    const requestedId = req.query.id;

    let uuid;

    // 1️⃣ If someone tries ?id=... → Only admin allowed
    if (requestedId) {
      if (loggedInRole !== "Admin") {
        return error(
          res,
          "You are not authorized to access  user's profile",
          RESPONSE_CODES.UNAUTHORIZED,
          403
        );
      }
      uuid = BigInt(requestedId);
    } else {
      // Normal flow → logged-in user's own profile
      uuid = loggedInId;
    }

    // 2️⃣ Fetch profile
    const user = await prisma.users.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        name: true,
        company_name: true,
        email: true,
        mobile_no: true,
        profile_image: true,
        is_login_otp_enable: true,
        status: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        email_verified_at: true,
        mobile_verified_at: true,
      },
    });

    if (!user) {
      return error(res, "User not found", RESPONSE_CODES.NOT_FOUND, 404);
    }


    // 4️⃣ Format final output
    const formattedUser = {
      ...user,
      last_login_at: ISTFormat(user.last_login_at),
      created_at: ISTFormat(user.created_at),
      updated_at: ISTFormat(user.updated_at),
      email_verified_at: ISTFormat(user.email_verified_at),
      mobile_verified_at: ISTFormat(user.mobile_verified_at),
    };

    return success(res, "User profile fetched successfully", formattedUser);

  } catch (err) {
    console.error("getUserProfile error:", err);
    return error(res, "Failed to fetch user profile", RESPONSE_CODES.FAILED, 500);
  }
};
exports. updateUserProfile = async (req, res) => {
  try {
    const loggedInId = BigInt(req.user.user_id);
    const loggedInRole = req.user.role;

    const requestedId = req.query.id;
    let uuid;

    // Admin → allowed to update others
    if (requestedId) {
      if (loggedInRole !== "Admin") {
        return error(
          res,
          "You are not authorized to update user's profile",
          RESPONSE_CODES.UNAUTHORIZED,
          403
        );
      }
      uuid = BigInt(requestedId);
    } else {
      uuid = loggedInId; // user updating own profile
    }

    // STEP 1: Fetch existing user
    const existingUser = await prisma.users.findUnique({
      where: { uuid },
      select: { profile_image: true }
    });

    if (!existingUser) {
      return error(res, "User not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    // STEP 2: Handle image upload
    let newProfileImage = null;
    if (req.file) {
      newProfileImage = uploadImage(req.file, req, "profile");
    }

    // STEP 3: Allowed fields
    const userAllowed = ["name", "company_name"];
    const adminAllowed = [
      "name",
      "company_name",
      "email",
      "mobile_no",
      "status",
      "email_verified_at",
      "mobile_verified_at"
    ];

    const blocked = ["role", "id", "uuid", "password", "created_at", "updated_at"];

    // Block illegal fields
    for (const field of blocked) {
      if (req.body[field] !== undefined) {
        return error(res, `${field} cannot be updated`, RESPONSE_CODES.UNAUTHORIZED, 403);
      }
    }

    // STEP 4: Prepare update data
    const updateData = {};

    if (loggedInRole === "Admin") {
      adminAllowed.forEach((field) => {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      });
    } else {
      userAllowed.forEach((field) => {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      });
    }

    if (newProfileImage) {
      updateData.profile_image = newProfileImage;
    }

    if (Object.keys(updateData).length === 0) {
      return error(res, "No valid fields to update", RESPONSE_CODES.BAD_REQUEST, 400);
    }


    // STEP 5: Update DB first (If DB update fails → don't delete old image)
    await prisma.users.update({
      where: { uuid },
      data: updateData
    });

    // STEP 6: If new image uploaded, delete old image
    if (newProfileImage && existingUser.profile_image) {
      console.log(" existingUser.profile_image", existingUser.profile_image);

      deleteImageIfExists(existingUser.profile_image);
    }

    return success(res, "User profile updated successfully");

  } catch (err) {
    console.error("updateUserProfile error:", err);
    return error(res, "Failed to update profile", RESPONSE_CODES.FAILED, 500);
  }
};
exports. getUserList = async (req, res) => {
  try {
    const {
      offset = 0,
      limit = 10,
      searchValue,       // optional global search
      name,
      email,
      mobile_no,
      company_name
    } = req.body || {};

    const skip = Number(offset) * 10;
    const take = Number(limit);

    // ✅ Always Active users only
    const where = {
      status: "Active", role: { not: "Admin" }
    };

    // ✅ Global search (single string for all fields)
    if (searchValue) {
      where.OR = [
        { name: { contains: searchValue, mode: "insensitive" } },
        { email: { contains: searchValue, mode: "insensitive" } },
        { mobile_no: { contains: searchValue, mode: "insensitive" } },
        { company_name: { contains: searchValue, mode: "insensitive" } }
      ];
    }

    // ✅ Individual filters (if provided)
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (email) {
      where.email = { contains: email, mode: "insensitive" };
    }
    if (mobile_no) {
      where.mobile_no = { contains: mobile_no, mode: "insensitive" };
    }
    if (company_name) {
      where.company_name = { contains: company_name, mode: "insensitive" };
    }

    // run queries in parallel
    const [total, filteredCount, data] = await Promise.all([
      prisma.users.count({ where: { status: "Active", role: { not: "Admin" } } }), // total Active users
      prisma.users.count({ where }),// filtered users
      prisma.users.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" }
      })
    ]);

    // format response
    const formattedData = data.map((u, index) => ({
      id: u.uuid,
      serial_no: skip + index + 1,
      name: u.name,
      email: u.email,
      mobile: u.mobile_no,
      company_name: u.company_name,
      status: u.status
    }));

    return successGetAll(
      res,
      "Active users fetched successfully",
      formattedData,
      total,
      filteredCount
    );
  } catch (err) {
    console.error("Error in getUserList:", err);
    return error(res, "Failed to fetch user list", err.message);
  }
};
exports. getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate input
    if (!id) {
      return error(res, "User ID is required", RESPONSE_CODES.BAD_REQUEST, 400);
    }

    // ✅ Find user (Active & not Admin)
    const user = await prisma.users.findFirst({
      where: {
        uuid: id,
        status: "Active",
        role: { not: "Admin" },
      },
    });

    if (!user) {
      return error(res, "User not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    // ✅ Format response
    const formattedData = {
      id: user.uuid,
      name: user.name,
      email: user.email,
      mobile_no: user.mobile_no,
      company_name: user.company_name,
      role: user.role,
      status: user.status,
      created_at: ISTFormat(user.created_at),
      updated_at: ISTFormat(user.updated_at),
    };

    return success(res, "User details fetched successfully", formattedData);
  } catch (err) {
    console.error("Error in getUserById:", err);
    return error(res, "Failed to fetch user details", RESPONSE_CODES.FAILED, 500);
  }
};
