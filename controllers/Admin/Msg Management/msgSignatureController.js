
const prisma = require("../../../utils/prisma");
const { RESPONSE_CODES, ISTDate } = require('../../../utils/helper');
const { success, error, successGetAll } = require('../../../utils/response');
const withAudit = require("../../../utils/withAudit");



exports.addOrUpdateSignature = async (req, res) => {

  const { signature, signature_type, status } = req.body;
  const user_id = req.user?.id || null;
  const ip_address = req.ip;

  try {
    // const result = await (async () => {
    const existing = await prisma.msg_signature.findFirst({ where: { signature_type } });
    const now = ISTDate();

    if (existing) {
      if (existing.signature == signature && existing.status == status) {
         return error (res,'Already up-to-date') 
      }
      const args = {
        where: { id: existing.id },
        data: { signature, status, updated_at: now }
      }
      await withAudit("update", "msg_signature", args, req.user?.user_id || null, req.ip);
      return success(res, 'Signature updated successfully')

    } else {
      const data = { signature, signature_type, status, created_at: now, updated_at: now }
      await withAudit("create", "msg_signature", {data}, req.user?.user_id || null, req.ip);
      return success(res, 'Signature added successfully')

    }

  } catch (err) {
    console.error(err);
    return error(res, 'Server error');
  }
};


exports.getSignatureList = async (req, res) => {
  const offset = req.body?.offset ?? 0;
  const limit = req.body?.limit ?? 10;
  const searchValue = req.body?.signature || '';
  const statusFilter = req.body?.status || null;
  const typeFilter = req.body?.signature_type || null;

  const skip = offset * 10;

  if (offset < 0 || limit <= 0) {
    return error(
      res,
      'Offset must be >= 0 and limit must be > 0',
      RESPONSE_CODES.VALIDATION_ERROR,
      422
    );
  }

  try {
    const where = {
      AND: [
        searchValue ? { signature: { contains: searchValue, mode: 'insensitive' } } : null,
        typeFilter && typeFilter !== 'All' ? { signature_type: typeFilter } : null,
        statusFilter && statusFilter !== 'All' ? { status: statusFilter } : null
      ].filter(Boolean)
    };

    const [total, filteredCount, data] = await Promise.all([
      prisma.msg_signature.count(),
      prisma.msg_signature.count({ where }),
      prisma.msg_signature.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' }
      })
    ]);

    const serializedData = data.map((item, index) => ({
      ...item,
      serial_no: skip + index + 1,
      id: item.id.toString(),
      created_at: ISTDate(item.created_at),
      updated_at: ISTDate(item.updated_at)
    }));

    return successGetAll(res, 'Signatures fetched successfully', serializedData, total, filteredCount);
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};
