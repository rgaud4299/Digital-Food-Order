const prisma = require("../../../utils/prisma");
const { RESPONSE_CODES, ISTDate, ISTFormat } = require("../../../utils/helper");
const { success, error, successGetAll } = require("../../../utils/response");
const { safeParseInt } = require("../../../utils/parser");
const withAudit = require("../../../utils/withAudit");

// ✅ ADD food variant
exports.addFoodVariant = async (req, res) => {
  try {
    const {
      food_item_id,
      portion_type,
      name = null,
      sku = null,
      price,
      cost_price = null,
      is_available = true,
      stock_control = false,
    } = req.body;

    const restaurant_id = req.user?.restaurant_id ? BigInt(req.user.restaurant_id) : null;
    if (!restaurant_id || !food_item_id || !portion_type || !price) {
      return error(
        res,
        "Restaurant ID, Food Item ID, Portion Type, and Price are required",
        RESPONSE_CODES.VALIDATION_ERROR,
        422
      );
    }

    const foodItem = await prisma.food_items.findUnique({ where: { id: BigInt(food_item_id) } });
    if (!foodItem)
      return error(res, "Food item not found", RESPONSE_CODES.NOT_FOUND, 404);

    // Ensure unique variant per portion type for same food item
    const existing = await prisma.food_variants.findFirst({
      where: {
        food_item_id: BigInt(food_item_id),
        portion_type,
      },
    });
    if (existing)
      return error(res, "Variant with same portion type already exists", RESPONSE_CODES.DUPLICATE, 409);

    const data = {
      restaurant_id: BigInt(restaurant_id),
      food_item_id: BigInt(food_item_id),
      portion_type,
      name: name || null,
      sku: sku || null,
      price: parseFloat(price),
      cost_price: cost_price ? parseFloat(cost_price) : null,
      is_available: is_available === "false" ? false : true,
      stock_control: stock_control === "true" ? true : false,
      created_at: ISTDate(),
    };

    await withAudit("create", "food_variants", { data }, req.user?.user_id || null, req.ip);
    return success(res, "Food variant added successfully");
  } catch (err) {
    console.error("addFoodVariant Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ GET all food variants
exports.getFoodVariantList = async (req, res) => {
  try {
    const offset = safeParseInt(req.body.offset, 0);
    const limit = safeParseInt(req.body.limit, 10);
    const searchValue = (req.body.searchValue || "").trim();
    const restaurant_id = req.body.restaurant_id ? BigInt(req.body.restaurant_id) : null;
    const food_item_id = req.body.food_item_id ? BigInt(req.body.food_item_id) : null;
    const skip = offset * limit;

    const where = {
      AND: [
        restaurant_id ? { restaurant_id } : null,
        food_item_id ? { food_item_id } : null,
        searchValue ? { name: { contains: searchValue, mode: "insensitive" } } : null,
      ].filter(Boolean),
    };

    const [total, filteredCount, data] = await Promise.all([
      prisma.food_variants.count(),
      prisma.food_variants.count({ where }),
      prisma.food_variants.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: "asc" },
        include: {
          food_items: { select: { id: true, name: true } },
        },
      }),
    ]);

    const formattedData = data.map((v, index) => ({
      id: v.id,
      serial_no: skip + index + 1,
      restaurant_id: v.restaurant_id,
      food_item_id: v.food_item_id,
      food_name: v.food_items?.name || null,
      portion_type: v.portion_type,
      name: v.name,
      sku: v.sku,
      price: Number(v.price),
      cost_price: v.cost_price ? Number(v.cost_price) : null,
      is_available: v.is_available,
      stock_control: v.stock_control,
      created_at: ISTFormat(v.created_at),
      updated_at: ISTFormat(v.updated_at),
    }));

    return successGetAll(res, "Data fetched successfully", formattedData, total, filteredCount);
  } catch (err) {
    console.error("getFoodVariantList Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ GET variant by ID
exports.getFoodVariantById = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const variant = await prisma.food_variants.findUnique({
      where: { id },
      include: {
        food_items: { select: { id: true, name: true } },
      },
    });
    if (!variant)
      return error(res, "Food variant not found", RESPONSE_CODES.NOT_FOUND, 404);

    const formatted = {
      id: variant.id,
      restaurant_id: variant.restaurant_id,
      food_item_id: variant.food_item_id,
      food_name: variant.food_items?.name || null,
      portion_type: variant.portion_type,
      name: variant.name,
      sku: variant.sku,
      price: Number(variant.price),
      cost_price: variant.cost_price ? Number(variant.cost_price) : null,
      is_available: variant.is_available,
      stock_control: variant.stock_control,
      created_at: ISTFormat(variant.created_at),
      updated_at: ISTFormat(variant.updated_at),
    };

    return success(res, "Data fetched successfully", formatted);
  } catch (err) {
    console.error("getFoodVariantById Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ UPDATE food variant
exports.updateFoodVariant = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const {
      portion_type,
      name = null,
      sku = null,
      price,
      cost_price = null,
      is_available = true,
      stock_control = false,
    } = req.body;

    const existing = await prisma.food_variants.findUnique({ where: { id } });
    if (!existing)
      return error(res, "Food variant not found", RESPONSE_CODES.NOT_FOUND, 404);

    if (!portion_type || !price)
      return error(res, "Portion type and price are required", RESPONSE_CODES.VALIDATION_ERROR, 422);

    const duplicate = await prisma.food_variants.findFirst({
      where: {
        food_item_id: existing.food_item_id,
        portion_type,
        id: { not: id },
      },
    });
    if (duplicate)
      return error(res, "Another variant with same portion type exists", RESPONSE_CODES.DUPLICATE, 409);

    const isSame =
      existing.portion_type === portion_type &&
      Number(existing.price) === Number(price) &&
      (existing.name || "") === (name || "") &&
      (existing.sku || "") === (sku || "") &&
      Number(existing.cost_price || 0) === Number(cost_price || 0) &&
      existing.is_available === (is_available === "false" ? false : true) &&
      existing.stock_control === (stock_control === "true" ? true : false);

    if (isSame)
      return error(res, "No changes detected", RESPONSE_CODES.DUPLICATE, 409);

    const args = {
      where: { id },
      data: {
        portion_type,
        name,
        sku,
        price: parseFloat(price),
        cost_price: cost_price ? parseFloat(cost_price) : null,
        is_available: is_available === "false" ? false : true,
        stock_control: stock_control === "true" ? true : false,
        updated_at: ISTDate(),
      },
    };

    await withAudit("update", "food_variants", args, req.user?.user_id || null, req.ip);
    return success(res, "Food variant updated successfully");
  } catch (err) {
    console.error("updateFoodVariant Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ DELETE food variant
exports.deleteFoodVariant = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const existing = await prisma.food_variants.findUnique({ where: { id } });
    if (!existing)
      return error(res, "Food variant not found", RESPONSE_CODES.NOT_FOUND, 404);

    // check if variant used in order or combo
    const hasUsage = await prisma.order_items.count({ where: { variant_id: id } });
    if (hasUsage > 0)
      return error(res, "Cannot delete variant linked with orders", RESPONSE_CODES.FAILED, 400);

    await withAudit("delete", "food_variants", { where: { id } }, req.user?.user_id || null, req.ip);
    return success(res, "Food variant deleted successfully");
  } catch (err) {
    console.error("deleteFoodVariant Error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};
