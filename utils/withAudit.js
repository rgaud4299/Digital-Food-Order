
// const { convertBigIntToString } = require("./parser");
// const prisma = require("./prisma");
// const now = new Date();
// async function createAudit(tx, model, action, result, oldRecord, userId, ip, actionByField, actionAtField) {

//   const lastLogin = await prisma.login_history.findFirst({
//     where: { user_id: userId },
//     orderBy: { id: 'desc' },
//     select: { latitude: true, longitude: true }
//   });

//   return tx.audit_trail.create({
//     data: {
//       table_name: model,
//       row_id: result?.id || oldRecord?.id,
//       action,
//       old_data: oldRecord ? JSON.stringify(convertBigIntToString(oldRecord)) : null,
//       new_data: result ? JSON.stringify(convertBigIntToString(result)) : null,
//       ip_address: ip || null,
//       remark: `${model} ${action.toLowerCase()}d`,
//       ...actionByField,
//       ...actionAtField,
//       ...lastLogin,
//       row_created_at: now
//     }
//   });
// }

// const withAudit = async function withAudit(action, model, args, userId, ip,trx = prisma) {
//   return await trx.$transaction(async (tx) => {
//     let result, oldRecord;

//     if (action === "create") {
//       actionByField = { created_by: userId };
//       actionAtField = { created_at: now };
//       const data = args;
//       result = await tx[model].create({ data });
//       await createAudit(tx, model, "CREATE", result, null, userId, ip, actionByField, actionAtField);

//     } else if (action === "update") {
//       actionByField = { updated_by: userId };
//       actionAtField = { updated_at: now };

//       oldRecord = await tx[model].findUnique({ where: args.where });
//       result = await tx[model].update(args);
//       await createAudit(tx, model, "UPDATE", result, oldRecord, userId, ip, actionByField, actionAtField);
//     }
//     else if (action === "delete") {
//       actionByField = { deleted_by: userId };
//       actionAtField = { deleted_at: now };

//       oldRecord = await tx[model].findUnique({ where: args.where });
//       result = await tx[model].delete(args);
//       await createAudit(tx, model, "DELETE", null, oldRecord, userId, ip, actionByField, actionAtField);
//     }
//     else if (action === "change-status") {

//       actionByField = { updated_by: userId };
//       actionAtField = { updated_at: now };

//       oldRecord = await tx[model].findUnique({ where: args.where, select: { id: true, status: true } });
//       result = await tx[model].update({ ...args, select: { id: true, status: true } });

//       await createAudit(tx, model, "CHANGE-STATUS", result,  oldRecord, userId, ip, actionByField, actionAtField);

//     }

//     return result;
//   });
// }


// module.exports = withAudit;
























const { ISTDate } = require("./helper");
const { convertBigIntToString } = require("./parser");
const prisma = require("./prisma");

async function createAudit(tx, model, action, result, oldRecord, userId, ip, actionByField, actionAtField) {
  const lastLogin = await prisma.login_history.findFirst({
    where: { user_id: userId },
    orderBy: { id: 'desc' },
    select: { latitude: true, longitude: true }
  });

  return tx.audit_trail.create({
    data: {
      table_name: model,
      row_id: result?.id || oldRecord?.id,
      action,
      old_data: oldRecord ? JSON.stringify(convertBigIntToString(oldRecord)) : null,
      new_data: result ? JSON.stringify(convertBigIntToString(result)) : null,
      ip_address: ip || null,
      remark: `${model} ${action.toLowerCase()}d`,
      ...actionByField,
      ...actionAtField,
      ...lastLogin,
      row_created_at: ISTDate()
    }
  });
}

async function _withAuditInternal(action, model, args, userId, ip, tx) {
  let result, oldRecord;
  const now = ISTDate();

  if (action === "create") {
    const actionByField = { created_by: userId };
    const actionAtField = { created_at: now };

    // const data = args;
    console.log("Creating new record:", args);

    result = await tx[model].create(args);
    await createAudit(tx, model, "CREATE", result, null, userId, ip, actionByField, actionAtField);

  } else if (action === "update") {
    const actionByField = { updated_by: userId };
    const actionAtField = { updated_at: now };

    oldRecord = await tx[model].findUnique({ where: args.where });
    result = await tx[model].update(args);
    await createAudit(tx, model, "UPDATE", result, oldRecord, userId, ip, actionByField, actionAtField);

  } else if (action === "delete") {
    const actionByField = { deleted_by: userId };
    const actionAtField = { deleted_at: now };

    oldRecord = await tx[model].findUnique({ where: args.where });
    result = await tx[model].delete(args);
    await createAudit(tx, model, "DELETE", null, oldRecord, userId, ip, actionByField, actionAtField);

  } else if (action === "change-status") {
    const actionByField = { updated_by: userId };
    const actionAtField = { updated_at: now };

    oldRecord = await tx[model].findUnique({ where: args.where, select: { id: true, status: true } });
    result = await tx[model].update({ ...args, select: { id: true, status: true } });

    await createAudit(tx, model, "CHANGE-STATUS", result, oldRecord, userId, ip, actionByField, actionAtField);
  }

  return result;
}

const withAudit = async function withAudit(action, model, args, userId, ip, tx = null) {
  if (tx) {
    // already in a transaction → direct run
    return _withAuditInternal(action, model, args, userId, ip, tx);
  } else {
    // no transaction passed → start a new one
    return prisma.$transaction(async (trx) => {
      return _withAuditInternal(action, model, args, userId, ip, trx);
    }, {
      timeout: 15000 // 15 seconds
    });
  }
};

module.exports = withAudit;
