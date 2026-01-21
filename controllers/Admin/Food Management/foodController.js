const prisma = require("../../../utils/prisma");
const slugify = require("slugify");
const { RESPONSE_CODES, ISTDate, ISTFormat } = require("../../../utils/helper");
const { success, error, successGetAll } = require("../../../utils/response");
const { safeParseInt } = require("../../../utils/parser");
const { uploadImage, deleteImageIfExists } = require("../../../utils/fileUpload");
const withAudit = require("../../../utils/withAudit");


// ✅ ADD food item
exports.addFoodItem = async (req, res) => {
  let imagePath = null;
  try {
    const {

      location_id = null,
      category_id,
      name,
      description = "",
      status = "Inactive",
      type = "Veg",
      prep_time_min = null,
      sequence = 0,
      is_visible = true,
    } = req.body;

    const restaurant_id = req.user?.restaurant_id ? BigInt(req.user.restaurant_id) : null;
    if (!restaurant_id) return error(res, "Restaurant ID is required", RESPONSE_CODES.VALIDATION_ERROR, 422);
    if (!name.trim()) return error(res, "Food name is required", RESPONSE_CODES.VALIDATION_ERROR, 422);

    // Validate category if provided
    if (category_id) {
      const category = await prisma.food_categories.findUnique({ where: { id: BigInt(category_id) } });
      if (!category) return error(res, "Category not found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    // Check duplicate name in same restaurant
    const existingFood = await prisma.food_items.findFirst({
      where: {
        restaurant_id: BigInt(restaurant_id),
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existingFood) return error(res, "This food item already exists", RESPONSE_CODES.DUPLICATE, 409);

    // Generate slug and ensure uniqueness
    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await prisma.food_items.findFirst({
      where: { restaurant_id: BigInt(restaurant_id), slug },
    });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    imagePath = req.file ? uploadImage(req.file, req, "food_items") : null;

    const data = {
      restaurant_id: BigInt(restaurant_id),
      location_id: location_id ? BigInt(location_id) : null,
      category_id: category_id ? BigInt(category_id) : null,
      name: name.trim(),
      slug,
      description,
      icon: imagePath,
      status,
      type,
      prep_time_min: prep_time_min ? parseInt(prep_time_min) : null,
      sequence: sequence ? parseInt(sequence) : 0,
      is_visible: is_visible === "false" ? false : true,
      created_at: ISTDate(),
    };

    await withAudit("create", "food_items", { data }, req.user?.user_id || null, req.ip);
    return success(res, "Food item added successfully");
  } catch (err) {
    if (imagePath) deleteImageIfExists(imagePath);
    console.error("addFoodItem Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ GET list of food items
exports.getFoodItemList = async (req, res) => {
  try {
    const offset = safeParseInt(req.body.offset, 0);
    const limit = safeParseInt(req.body.limit, 10);
    const searchValue = (req.body.searchValue || "").trim();
    const statusFilter = req.body.status || "";
    const restaurant_id = req.body.restaurant_id ? BigInt(req.body.restaurant_id) : null;
    const category_id = req.body.category_id ? BigInt(req.body.category_id) : null;
    const location_id = req.body.location_id ? BigInt(req.body.location_id) : null;

    const where = {
      AND: [
        restaurant_id ? { restaurant_id } : null,
        category_id ? { category_id } : null,
        location_id ? { location_id } : null,
        searchValue ? { name: { contains: searchValue, mode: "insensitive" } } : null,
        statusFilter ? { status: { equals: statusFilter } } : null,
      ].filter(Boolean),
    };

    const skip = offset * limit;

    const [total, filteredCount, data] = await Promise.all([
      prisma.food_items.count(),
      prisma.food_items.count({ where }),
      prisma.food_items.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: "asc" },
        include: {
          food_categories: { select: { id: true, name: true } },
          restaurant: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      }),
    ]);

    const formattedData = data.map((item, index) => ({
      id: item.id,
      serial_no: skip + index + 1,
      restaurant_id: item.restaurant_id,
      restaurant_name: item.restaurant?.name || null,
      location_id: item.location_id,
      location_name: item.location?.name || null,
      category_id: item.category_id,
      category_name: item.food_categories?.name || null,
      name: item.name,
      slug: item.slug,
      description: item.description,
      icon: item.icon,
      type: item.type,
      prep_time_min: item.prep_time_min,
      sequence: item.sequence,
      is_visible: item.is_visible,
      status: item.status,
      created_at: ISTFormat(item.created_at),
      updated_at: ISTFormat(item.updated_at),
    }));

    return successGetAll(res, "Data fetched successfully", formattedData, total, filteredCount);
  } catch (err) {
    console.error("getFoodItemList Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ GET food item by ID
exports.getFoodItemById = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const food = await prisma.food_items.findUnique({
      where: { id },
      include: {
        food_categories: { select: { id: true, name: true } },
        restaurant: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
    if (!food) return error(res, "Food not found", RESPONSE_CODES.NOT_FOUND, 404);

    const formatted = {
      id: food.id,
      restaurant_id: food.restaurant_id,
      restaurant_name: food.restaurant?.name || null,
      location_id: food.location_id,
      location_name: food.location?.name || null,
      category_id: food.category_id,
      category_name: food.food_categories?.name || null,
      name: food.name,
      slug: food.slug,
      description: food.description,
      icon: food.icon,
      type: food.type,
      prep_time_min: food.prep_time_min,
      sequence: food.sequence,
      is_visible: food.is_visible,
      status: food.status,
      created_at: ISTFormat(food.created_at),
      updated_at: ISTFormat(food.updated_at),
    };

    return success(res, "Data fetched successfully", formatted);
  } catch (err) {
    console.error("getFoodItemById Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ UPDATE food item
exports.updateFoodItem = async (req, res) => {
  const id = BigInt(req.params.id);
  let newImagePath = null;
  try {
    const {
      restaurant_id,
      location_id = null,
      category_id = null,
      name,
      description = "",
      status = "Inactive",
      type = "Veg",
      prep_time_min = null,
      sequence = 0,
      is_visible = true,
    } = req.body;
    console.log("hello")
    const existing = await prisma.food_items.findUnique({ where: { id } });
    if (!existing) return error(res, "Food item not found", RESPONSE_CODES.NOT_FOUND, 404);

    if (!restaurant_id) return error(res, "Restaurant ID is required", RESPONSE_CODES.VALIDATION_ERROR, 422);
    if (!name || !name.trim()) return error(res, "Food name is required", RESPONSE_CODES.VALIDATION_ERROR, 422);

    // Check for duplicate name
    const duplicate = await prisma.food_items.findFirst({
      where: {
        restaurant_id: BigInt(restaurant_id),
        id: { not: id },
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (duplicate) return error(res, "Another food item with same name exists", RESPONSE_CODES.DUPLICATE, 409);

    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await prisma.food_items.findFirst({
      where: { restaurant_id: BigInt(restaurant_id), id: { not: id }, slug },
    });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    if (req.file) {
      newImagePath = uploadImage(req.file, req, "food_items");
    }

    const data = {
      restaurant_id: BigInt(restaurant_id),
      location_id: location_id ? BigInt(location_id) : null,
      category_id: category_id ? BigInt(category_id) : null,
      name: name.trim(),
      slug,
      description,
      icon: newImagePath || existing.icon,
      status,
      type,
      prep_time_min: prep_time_min ? parseInt(prep_time_min) : null,
      sequence: sequence ? parseInt(sequence) : 0,
      is_visible: is_visible === "false" ? false : true,
      updated_at: ISTDate(),
    };

    await withAudit("update", "food_items", { where: { id }, data }, req.user?.user_id || null, req.ip);

    // STEP 4: Delete old image after update success
    if (existing.icon) deleteImageIfExists(existing.icon);

    return success(res, "Food item updated successfully");
  } catch (err) {
    if (newImagePath) deleteImageIfExists(newImagePath);
    console.error("updateFoodItem Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ DELETE food item
exports.deleteFoodItem = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const food = await prisma.food_items.findUnique({ where: { id } });
    if (!food) return error(res, "Food item not found", RESPONSE_CODES.NOT_FOUND, 404);

    // Prevent deletion if used in combo or order_items
    const hasOrders = await prisma.order_items.count({ where: { food_id: id } });
    if (hasOrders > 0)
      return error(res, "Cannot delete food item with active orders", RESPONSE_CODES.FAILED, 400);

    if (food.icon) deleteImageIfExists(food.icon);
    await withAudit("delete", "food_items", { where: { id } }, req.user?.user_id || null, req.ip);

    return success(res, "Food item deleted successfully");
  } catch (err) {
    console.error("deleteFoodItem Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ CHANGE status
exports.changeFoodItemStatus = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const food = await prisma.food_items.findUnique({ where: { id } });
    if (!food) return error(res, "Food item not found", RESPONSE_CODES.NOT_FOUND, 404);

    const newStatus = food.status === "Active" ? "Inactive" : "Active";
    await withAudit(
      "change-status",
      "food_items",
      { where: { id }, data: { status: newStatus, updated_at: ISTDate() } },
      req.user?.user_id || null,
      req.ip
    );

    return success(res, `Food item status changed to ${newStatus}`);
  } catch (err) {
    console.error("changeFoodItemStatus Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};
