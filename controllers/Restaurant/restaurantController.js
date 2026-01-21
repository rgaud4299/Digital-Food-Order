const slugify = require("slugify");
const { RESPONSE_CODES, ISTDate, ISTFormat, randomUUID } = require("../../utils/helper");
const { success, error, successGetAll } = require("../../utils/response");
const { safeParseInt } = require("../../utils/parser");
const { uploadImage, deleteImageIfExists } = require("../../utils/fileUpload");
const withAudit = require("../../utils/withAudit");
const prisma = require("../../utils/prisma");

// ADD Restaurant
exports.addRestaurant = async (req, res) => {
  let imagePath = null;
  try {
    const { name } = req.body;
    const owner_user_id = req.user?.user_id ? BigInt(req.user.user_id) : null;

    if (!name || !owner_user_id) {
      return error(res, "Restaurant Name and owner_user_id are required", RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    // check user existence
    const existingUsers = await prisma.users.findFirst({
      where: { uuid: BigInt(owner_user_id) },
    });

    if (!existingUsers) {
      return error(res, "A user with this ID does not exist", RESPONSE_CODES.DUPLICATE, 409);
    }
    // check duplicate
    const existing = await prisma.restaurants.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, owner_user_id: BigInt(owner_user_id) },
    });
    if (existing) {
      return error(res, `This name restaurant for user  already exists`, RESPONSE_CODES.DUPLICATE, 409);
    }


    imagePath = req.file ? uploadImage(req.file, req,'Restaurant') : null;

    const data = {
      name,
      uuid: randomUUID().toString(), // simple unique generation
      owner_user_id: BigInt(owner_user_id),
      metadata: { imagePath },
      created_at: ISTDate(),
      status: "Active",
    };

    const newRestaurant = await withAudit("create", "restaurants", { data }, req.user?.user_id || null, req.ip);

    await prisma.users.update({
      where: { uuid: BigInt(owner_user_id) },
      data: { restaurant_id: newRestaurant.uuid },
    });

    return success(res, "Restaurant added successfully");
  } catch (err) {
    console.error("addRestaurant error:", err);
    if (imagePath) deleteImageIfExists(imagePath);
    return error(res, "Failed to add restaurant", RESPONSE_CODES.FAILED, 500);
  }
};
// GET Restaurant List
exports.getRestaurantList = async (req, res) => {
  try {
    const offset = safeParseInt(req.body.offset, 0);
    const limit = safeParseInt(req.body.limit, 10);
    const searchValue = (req.body.searchValue || "").trim();
    const statusFilter = req.body.status || null;
    const skip = offset * 10;

    const where = {
      AND: [
        searchValue ? { name: { contains: searchValue, mode: "insensitive" } } : null,
        statusFilter ? { status: { equals: statusFilter } } : null,
      ].filter(Boolean),
    };

    const [total, filteredCount, data] = await Promise.all([
      prisma.restaurants.count(),
      prisma.restaurants.count({ where }),
      prisma.restaurants.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: "asc" },
      }),
    ]);

    const formatted = data.map((item, index) => ({
      id: item.id,
      serial_no: skip + index + 1,
      name: item.name,
      slug: item.slug,
      owner_user_id: item.owner_user_id,
      subscription_plan_id: item.subscription_plan_id,
      status: item.status,
      timezone: item.timezone,
      locale: item.locale,
      default_currency: item.default_currency,
      created_at: ISTFormat(item.created_at),
      updated_at: ISTFormat(item.updated_at),
    }));

    return successGetAll(res, "Data fetched successfully", formatted, total, filteredCount);
  } catch (err) {
    console.error("getRestaurantList error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// GET Restaurant By ID
exports.getRestaurantById = async (req, res) => {
  const id = BigInt(req.params.id);
  try {
    const restaurant = await prisma.restaurants.findUnique({
      where: { uuid:id },
    });
    if (!restaurant) {
      return error(res, "Restaurant not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    const formatted = {
      ...restaurant,
      created_at: ISTFormat(restaurant.created_at),
      updated_at: ISTFormat(restaurant.updated_at),
    };

    return success(res, "Data fetched successfully", formatted);
  } catch (err) {
    console.error("getRestaurantById error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// UPDATE Restaurant
exports.updateRestaurant = async (req, res) => {
  const id = BigInt(req.params.id);
  let newImagePath = null;

  try {
    const { name,  subscription_plan_id } = req.body;

    const existing = await prisma.restaurants.findUnique({ where: { uuid:id } });
    if (!existing) {
      return error(res, "Restaurant not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    const duplicate = await prisma.restaurants.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        uuid:  id 
      },
    });
    if (duplicate) {
      return error(res, "Restaurant name already exists", RESPONSE_CODES.DUPLICATE, 409);
    }


    const args = {
      where: { uuid:id },
      data: {
        name,
        subscription_plan_id: subscription_plan_id ? BigInt(subscription_plan_id) : null,
        updated_at: ISTDate(),
      },
    };

    await withAudit("update", "restaurants", args, req.user?.user_id || null, req.ip);

    return success(res, "Restaurant updated successfully");
  } catch (err) {
    console.error("updateRestaurant error:", err);
    if (newImagePath) deleteImageIfExists(newImagePath);
    return error(res, "Failed to update restaurant", RESPONSE_CODES.FAILED, 500);
  }
};

// CHANGE Restaurant STATUS
exports.changeRestaurantStatus = async (req, res) => {
  const id = BigInt(req.params.id);
  try {
    const restaurant = await prisma.restaurants.findUnique({ where: { uuid:id } });
    if (!restaurant) {
      return error(res, "Restaurant not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    const newStatus = restaurant.status === "Active" ? "Inactive" : "Active";

    await withAudit(
      "change-status",
      "restaurants",
      { where: { uuid:id }, data: { status: newStatus, updated_at: ISTDate() } },
      req.user?.user_id || null,
      req.ip
    );

    return success(res, `Restaurant status changed to ${newStatus}`);
  } catch (err) {
    console.error("changeRestaurantStatus error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// DELETE Restaurant
exports.deleteRestaurant = async (req, res) => {
  const id = BigInt(req.params.id);

  try {
    const existing = await prisma.restaurants.findUnique({ where: { uuid:id } });
    if (!existing) {
      return error(res, "Restaurant not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    // optional: check linked data
    const hasFood = await prisma.food_items.count({ where: { restaurant_id: id } });
    if (hasFood > 0) {
      return error(res, "Cannot delete restaurant with linked food items", RESPONSE_CODES.FAILED, 400);
    }

    await withAudit("delete", "restaurants", { where: { uuid:id } }, req.user?.user_id || null, req.ip);

    return success(res, "Restaurant deleted successfully");
  } catch (err) {
    console.error("deleteRestaurant error:", err);
    return error(res, "Failed to delete restaurant", RESPONSE_CODES.FAILED, 500);
  }
};

