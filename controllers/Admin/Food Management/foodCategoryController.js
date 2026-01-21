
const prisma = require("../../../utils/prisma");
const slugify = require('slugify');
const { RESPONSE_CODES, ISTDate, ISTFormat } = require('../../../utils/helper');
const { success, error, successGetAll } = require('../../../utils/response');
const withAudit = require("../../../utils/withAudit");
const { deleteImageIfExists, uploadImage } = require("../../../utils/fileUpload");




exports.addFoodCategory = async (req, res) => {
  let imagePath = null;
  try {

    const { name, status, description, } = req.body;
    const restaurant_id = req.user?.restaurant_id ? BigInt(req.user.restaurant_id) : null;

    if (!restaurant_id) {
      return error(res, 'restaurant_id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    // Check if already exists in same restaurant
    const existing = await prisma.food_categories.findFirst({
      where: {
        restaurant_id: BigInt(restaurant_id),
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing)
      return error(res, 'This Food Category already exists', RESPONSE_CODES.DUPLICATE, 409);

    const slug = slugify(name, { lower: true });

    imagePath = req.file ? uploadImage(req.file, req, "category") : null;

    const data = {
      restaurant_id: BigInt(restaurant_id),
      name,
      slug,
      icon: imagePath,
      description: description || null,
      status: status || 'Inactive',
    };

    await withAudit('create', 'food_categories', { data }, req.user?.user_id || null, req.ip);
    return success(res, 'Food Category added successfully');
  } catch (err) {
    console.error('addFoodCategory Error:', err);
    if (imagePath) deleteImageIfExists(imagePath);
    return error(res, 'Failed to add Food Category');
  }
};

// ✅ Get List
exports.getFoodCategoryList = async (req, res) => {
  try {
    const offset = (req.body.offset || 0);
    const limit = (req.body.limit || 10);
    const searchValue = (req.body.searchValue || '').trim();
    const statusFilter = req.body.status || null;
    const restaurant_id = req.body.restaurant_id ? BigInt(req.body.restaurant_id) : null;

    const skip = offset * limit;

    const where = {
      AND: [
        restaurant_id ? { restaurant_id } : null,
        searchValue ? { name: { contains: searchValue, mode: 'insensitive' } } : null,
        statusFilter ? { status: { equals: statusFilter } } : null,
      ].filter(Boolean),
    };

    const [total, filteredCount, data] = await Promise.all([
      prisma.food_categories.count(),
      prisma.food_categories.count({ where }),
      prisma.food_categories.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    const formattedData = data.map((item, index) => ({
      id: item.id,
      restaurant_id: item.restaurant_id,
      name: item.name,
      slug: item.slug,
      icon: item.icon,
      description: item.description,
      status: item.status,
      sequence: item.sequence,
      created_at: ISTFormat(item.created_at),
      updated_at: ISTFormat(item.updated_at),
      serial_no: skip + index + 1,
    }));

    return successGetAll(res, 'Data fetched successfully', formattedData, total, filteredCount);
  } catch (err) {
    console.error('getFoodCategoryList Error:', err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// ✅ Get by ID
exports.getFoodCategoryById = async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const category = await prisma.food_categories.findUnique({
      where: { id },
      select: {
        id: true,
        restaurant_id: true,
        name: true,
        slug: true,
        icon: true,
        description: true,
        status: true,
        sequence: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!category)
      return error(res, 'Food Category not found', RESPONSE_CODES.NOT_FOUND, 404);

    return success(res, 'Data fetched successfully', category);
  } catch (err) {
    console.error('getFoodCategoryById Error:', err);
    return error(res, 'Server error');
  }
};

// ✅ Update Food Category
exports.updateFoodCategory = async (req, res) => {
  let newImagePath = null;
  try {
    const id = BigInt(req.params.id);
    const { name, status, description, sequence } = req.body;

    const existing = await prisma.food_categories.findUnique({ where: { id } });
    if (!existing)
      return error(res, 'Food Category not found', RESPONSE_CODES.NOT_FOUND, 404);

    const duplicateName = await prisma.food_categories.findFirst({
      where: {
        restaurant_id: existing.restaurant_id,
        name: { equals: name, mode: 'insensitive' },
        id: { not: id },
      },
    });
    if (duplicateName)
      return error(res, 'This Food Category already exists', RESPONSE_CODES.DUPLICATE, 409);

    const slug = slugify(name, { lower: true });

    if (req.file) {
      newImagePath = uploadImage(req.file, req, "category");
    }

    const data = {
      name,
      slug,
      description,
      status,
      sequence: sequence ? Number(sequence) : existing.sequence,
      icon: newImagePath || existing.icon,
      updated_at: ISTDate(),
    };

    const args = { where: { id }, data };

    await withAudit('update', 'food_categories', args, req.user?.user_id || null, req.ip);
  
    // STEP 4: Delete old image after update success
    if (existing.icon) deleteImageIfExists(existing.icon);

    return success(res, 'Food Category updated successfully');
  } catch (err) {
    console.error('updateFoodCategory Error:', err);
    if (newImagePath) deleteImageIfExists(newImagePath);
    return error(res, 'Server error');
  }
};

// ✅ Delete
exports.deleteFoodCategory = async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const category = await prisma.food_categories.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category)
      return error(res, 'Food Category not found', RESPONSE_CODES.NOT_FOUND, 404);

    const linkedItems = await prisma.food_items.count({
      where: { category_id: id },
    });

    if (linkedItems > 0)
      return error(
        res,
        'Cannot delete Food Category with linked food items',
        RESPONSE_CODES.FAILED,
        400
      );

    await withAudit('delete', 'food_categories', { where: { id } }, req.user?.user_id || null, req.ip);

    return success(res, 'Food Category deleted successfully');
  } catch (err) {
    console.error('deleteFoodCategory Error:', err);
    return error(res, 'Server error');
  }
};

// ✅ Change Status
exports.changeFoodCategoryStatus = async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const existing = await prisma.food_categories.findUnique({ where: { id } });
    if (!existing)
      return error(res, 'Food Category not found', RESPONSE_CODES.NOT_FOUND, 404);

    const newStatus = existing.status === 'Active' ? 'Inactive' : 'Active';
    const args = {
      where: { id },
      data: { status: newStatus, updated_at: ISTDate() },
    };

    await withAudit('change-status', 'food_categories', args, req.user?.user_id || null, req.ip);
    return success(res, `Food Category status changed to ${newStatus}`);
  } catch (err) {
    console.error('changeFoodCategoryStatus Error:', err);
    return error(res, 'Server error');
  }
};
