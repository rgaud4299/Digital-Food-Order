const prisma = require("../../../utils/prisma");

const { RESPONSE_CODES, ISTFormat, ISTFormatDate, ISTString, ISTDate } = require('../../../utils/helper');
const { success, error, successGetAll } = require('../../../utils/response');
const { safeParseInt, convertBigIntToString } = require('../../../utils/parser');
const withAudit = require("../../../utils/withAudit");



function normalizeSendFlags(body) {
  return {
    send_sms: body.send_sms ?? 'No',
    send_whatsapp: body.send_whatsapp ?? 'No',
    send_email: body.send_email ?? 'No',
    send_notification: body.send_notification ?? 'No'
  };
}

// Add Message Content
exports.addMsgContent = async (req, res) => {
  try {
    const { message_type, sms_content, whatsapp_content, mail_content, notification_content } = req.body;
    const existing = await prisma.msg_contents.findFirst({
      where: { message_type, sms_content, whatsapp_content }
    });
    if (existing) return error(res, 'This Message Content already exists', RESPONSE_CODES.DUPLICATE, 409);
    const sendFlags = normalizeSendFlags(req.body);
    const data = {
      message_type,
      ...sendFlags,
      sms_template_id: req.body.sms_template_id,
      sms_content,
      whatsapp_content,
      mail_subject: req.body.mail_subject,
      mail_content,
      notification_title: req.body.notification_title,
      notification_content,
      keywords: req.body.keywords,
      created_at: ISTDate(),
      updated_at: ISTDate()
    }
    await withAudit("create", "msg_contents", {data}, req.user?.user_id || null, req.ip);



    return success(res, 'Message Content Added Successfully');
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to add Message Content', RESPONSE_CODES.FAILED, 500);
  }
};

// List Message Content
exports.getMsgContentList = async (req, res) => {
  const offset = safeParseInt(req.body.offset, 0);
  const limit = safeParseInt(req.body.limit, 10);
  const skip = offset * 10;

  try {
    const [total, data] = await Promise.all([
      prisma.msg_contents.count(),
      prisma.msg_contents.findMany({
        skip,
        take: limit,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          message_type: true,
          send_sms: true,
          send_whatsapp: true,
          send_email: true,
          send_notification: true,
        created_at: true,
        updated_at: true
        }
      })
    ]);

    const serializedData = data.map((item, index) => ({
      ...item,
      serial_no: skip + index + 1
    }));

    return successGetAll(res, 'Data fetched successfully', serializedData, total, 0);

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// Get Message Content By ID
exports.getMsgContentById = async (req, res) => {
  const id = parseInt(req.params.id, 10); // ensure number

  try {
    const content = await prisma.msg_contents.findUnique({
      where: { id },
      select: {
        id: true,
        message_type: true,
        sms_template_id: true,
        sms_content: true,
        whatsapp_content: true,
        mail_subject: true,
        mail_content: true,
        notification_title: true,
        notification_content: true,
        keywords: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!content) {
      return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    return success(res, 'Data fetched successfully', {
      ...content,
      created_at: ISTFormat(content.created_at),
      updated_at: ISTFormat(content.updated_at)
    });

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// Update Message Content
exports.updateMsgContent = async (req, res) => {

  const id = (req.params.id);

  try {
    const content = await prisma.msg_contents.findUnique({ where: { id } });
    if (!content) return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    const sendFlags = normalizeSendFlags(req.body);
    const {
      message_type, sms_content, whatsapp_content, mail_content, notification_content
    } = req.body;

    const isSame =
      content.message_type === message_type &&
      content.sms_content === sms_content &&
      content.whatsapp_content === whatsapp_content &&
      content.mail_content === mail_content &&
      content.notification_content === notification_content &&
      content.sms_template_id === req.body.sms_template_id &&
      content.mail_subject === req.body.mail_subject &&
      content.notification_title === req.body.notification_title &&
      content.keywords === req.body.keywords &&
      content.send_sms === sendFlags.send_sms &&
      content.send_whatsapp === sendFlags.send_whatsapp &&
      content.send_email === sendFlags.send_email &&
      content.send_notification === sendFlags.send_notification;

    if (isSame) return error(res, 'No changes detected, message content is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);


    const args = {
      where: { id },
      data: {
        message_type,
        ...sendFlags,
        sms_template_id: req.body.sms_template_id,
        sms_content,
        whatsapp_content,
        mail_subject: req.body.mail_subject,
        mail_content,
        notification_title: req.body.notification_title,
        notification_content,
        keywords: req.body.keywords,
        updated_at:ISTDate()
      }
    }
    // console.log("ISTFormatDate",ISTString);
    
    await withAudit("update", "msg_contents", args, req.user?.user_id || null, req.ip);


    return success(res, 'Message Content updated successfully');
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// Delete Message Content
exports.deleteMsgContent = async (req, res) => {
  const id = (req.params.id);
  try {
    await withAudit("delete", "msg_contents", { where: { id } }, req.user?.user_id || null, req.ip);
    return success(res, 'Message Content deleted successfully');
  } catch (err) {
    console.error(err);

    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};


// msgContentController
exports.ChangeMsgContentStatus = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { statusKey } = req.body;

  try {
    const content = await prisma.msg_contents.findUnique({ where: { id } });
    if (!content) {
      return error(res, "Message Content Not Found", RESPONSE_CODES.NOT_FOUND, 404);
    }

    const currentValue = content[statusKey] === "Yes" ? "Yes" : "No";
    const newValue = currentValue === "Yes" ? "No" : "Yes";

    const updates = {
      [statusKey]: newValue,
      updated_at: ISTFormatDate,
    };

    await withAudit(
      "update",
      "msg_contents",
      { where: { id }, data: updates },
      req.user?.user_id || null,
      req.ip
    );


    return success(res, `${statusKey} changed to ${newValue}`);

  } catch (err) {
    logger.error("ChangeMsgContentStatus Error", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};





