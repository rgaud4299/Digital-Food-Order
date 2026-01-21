const prisma = require("../../../utils/prisma");
const { success, error, successGetAll } = require('../../../utils/response');
const { RESPONSE_CODES, ISTFormat, ISTFormatDate, ISTDate } = require('../../../utils/helper');
const withAudit = require("../../../utils/withAudit");


exports.addMsgApi = async (req, res) => {
  const { api_name, api_type, base_url, params, method, status } = req.body;
  try {
    const existingApi = await prisma.msg_apis.findFirst({
      where: { api_name: { equals: api_name, mode: 'insensitive' } }
    });
    if (existingApi) {
      throw new Error('DUPLICATE_API');
    }
    const data = {
      api_name,
      api_type,
      base_url,
      params,
      method,
      status,
      created_at: ISTDate(),
      updated_at: ISTDate(),
    }

    await withAudit("create", "msg_apis",{ data}, req.user?.user_id || null, req.ip);



    return success(res, 'Message API Added Successfully');

  } catch (err) {
    if (err.message === 'DUPLICATE_API') {
      return error(
        res,
        'API with the same name already exists',
        RESPONSE_CODES.DUPLICATE,
        409
      );
    }

    console.error('Failed to add API:', err);
    return error(res, 'Failed to add Message API', RESPONSE_CODES.FAILED, 500);
  }
};

// List APIs
exports.getMsgApiList = async (req, res) => {
  const offset = Number(req.body.offset) || 0;
  const limit = Number(req.body.limit) || 10;
  const api_name = req.body.api_name || "";
  const statusFilter = req.body.status || null;
  const apiType = req.body.api_type || "";

  const skip = offset * 10;

  if (offset < 0 || limit <= 0) {
    return error(
      res,
      "Offset must be >= 0 and limit must be > 0",
      RESPONSE_CODES.VALIDATION_ERROR,
      422
    );
  }

  try {
    // ✅ build filters dynamically
    const where = {};

    if (api_name) {
      where.api_name = { contains: api_name, mode: "insensitive" };
    }

    if (apiType && apiType !== "All") {
      where.api_type = apiType;
    }

    if (statusFilter && statusFilter !== "All") {
      where.status = statusFilter;
    }

    const [total, filteredCount, data] = await Promise.all([
      prisma.msg_apis.count(),              // total rows
      prisma.msg_apis.count({ where }),     // filtered rows
      prisma.msg_apis.findMany({            // filtered + paginated data
        where,
        skip,
        take: limit,
        orderBy: { id: "asc" }
      })
    ]);

    const serializedData = data.map((item, index) => ({
      ...item,
      serial_no: skip + index + 1,
      id: item.id.toString(),
      created_at: ISTFormat(item.created_at),
      updated_at: ISTFormat(item.updated_at)
    }));

    return successGetAll(
      res,
      "Data fetched successfully",
      serializedData,
      total,
      filteredCount
    );
  } catch (err) {
    console.error("Error in getMsgApiList:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};


// Get API by ID
exports.getMsgApiById = async (req, res) => {
  const id = (req.params.id);
  try {
    const api = await prisma.msg_apis.findUnique({
      where: { id },
      select: {
        id: true, api_name: true, api_type: true, base_url: true, params: true,
        method: true, status: true, created_at: true, updated_at: true
      }
    });
    if (!api) {
      return error(res, 'Message API Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    const safeApi = (api);

    return success(res, 'Data fetched successfully', {
      ...safeApi,
      created_at: ISTFormat(api.created_at),
      updated_at: ISTFormat(api.updated_at)
    });

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// Update API
exports.updateMsgApi = async (req, res) => {
  const id = (req.params.id);
  const { api_name, api_type, base_url, params, method, status } = req.body;
  try {

    const api = await prisma.msg_apis.findUnique({ where: { id } });
    if (!api) throw new Error('API_NOT_FOUND');
    const duplicate = await prisma.msg_apis.findFirst({
      where: {
        api_name: { equals: api_name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (duplicate) throw new Error('DUPLICATE_NAME');
    const isSame =
      api.api_name === api_name &&
      api.api_type === api_type &&
      api.base_url === base_url &&
      api.params === params &&
      api.method === method &&
      api.status === status;

    if (isSame) {
      return error(res, 'No changes detected. API already up-to-date', RESPONSE_CODES.FAILED, 200);
    }
    const args = {
      where: { id },
      data: { api_name, api_type, base_url, params, method, status, updated_at: ISTDate() }
    }

    await withAudit("update", "msg_apis", args, req.user?.user_id || null, req.ip);



    return success(res, 'Message API updated successfully');

  } catch (err) {
    console.error(err);
    if (err.message === 'API_NOT_FOUND') {
      return error(res, 'Messaging API not found', RESPONSE_CODES.NOT_FOUND, 404);
    }
    if (err.message === 'DUPLICATE_NAME') {
      return error(res, 'Another API with same name exists', RESPONSE_CODES.DUPLICATE, 409);
    }
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// Delete API
exports.deleteMsgApi = async (req, res) => {
  const id = (req.params.id);
  try {
    const api = await prisma.msg_apis.findUnique({ where: { id } });
    if (!api) {
      return error(res, 'Message API Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }
    await withAudit("delete", "msg_apis", { where: { id } }, req.user?.user_id || null, req.ip);

    return success(res, 'Message API deleted successfully');
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// change status of Messaging API
exports.changeMsgApiStatus = async (req, res) => {
  const id = (req.params.id);
  try {
    // Current record fetch
    const api = await prisma.msg_apis.findUnique({ where: { id } });
    if (!api) {
      return error(res, 'Message API not found', RESPONSE_CODES.NOT_FOUND, 404);
    }
    // Toggle logic
    const newStatus = api.status === 'Active' ? 'Inactive' : 'Active';
    // Update DB
    const args = {
      where: { id },
      data: {
        status: newStatus,
        updated_at: ISTDate()
      }
    }

    await withAudit("change-status", "msg_apis", args, req.user?.user_id || null, req.ip);

    return success(res, ` Message API status changed to ${newStatus}`);

  } catch (err) {
    console.error('changeMsgApiStatus error:', err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

