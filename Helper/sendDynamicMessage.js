const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const dayjs = require("dayjs");
const { makeAxiosRequest } = require('../utils/httpHelper');


// ================= Main Function =================
async function sendDynamicMessage(data) {

  // Step 1: Fetch message template from DB using msg_id
  const messageContents = await db.msg_contents.findFirst({
    where: { id: data.msg_cont_id },
  });

  if (!messageContents) {
    return false; // Exit if template not found
  }


  // Step 3: Read flags from DB (Yes/No -> whether to send SMS/WhatsApp/Email)
  const sendSms = messageContents.send_sms;
  const sendWhatsapp = messageContents.send_whatsapp;
  const sendEmail = messageContents.send_email;

  // Step 4: Fetch user’s contact details
  const mobileNo = data.mobile_no;
  const emailId = data.email;
  const attachment = data.attachment;

  // ================= WhatsApp Message Send =================
  if (sendWhatsapp === "Yes") {
    const whatsappContent = replacePlaceholders(messageContents.whatsapp_content, data.placeholders);
    console.log("WhatsApp Content:", mobileNo, whatsappContent, attachment);
    await sendWhatsappMessage(mobileNo, whatsappContent, attachment);
  }

  // ================= SMS Message Send =================
  if (sendSms === "Yes") {
    const smsContent = replacePlaceholders(messageContents.sms_content, data.placeholders);
    await sendSmsMessage(mobileNo, smsContent, attachment, messageContents.sms_template_id);
  }

  // ================= Email Send =================
  // Condition: only send email if msg_id is not between 2–6 and not equal to 10
  if (sendEmail === "Yes" && (data.msg_id < 2 || data.msg_id > 6) && data.msg_id !== 10) {
    if (!messageContents.mail_subject || !messageContents.mail_content) {
      return false; // Exit if email subject/content is missing
    }
    // Step 2: Replace placeholders in the template (example: {FULL_NAME}, {OTP})
    const emailContent = replacePlaceholders(messageContents.mail_content, data.placeholders);
    const emailSubject = replacePlaceholders(messageContents.mail_subject, data.placeholders);

    await sendEmailMessage(emailId, emailSubject, emailContent);
  }
  return true;
}


// ================= Helper: Placeholder Replace =================
function replacePlaceholders(template, placeholders) {
  if (!template) return "";
  let result = template;

  // Loop through all placeholders and replace with actual values
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(key, "g"), value);
  }
  return result;
}

// ================= Send WhatsApp =================
async function sendWhatsappMessage(mobileNo, whatsappContent, tempId = '', attachment) {
  console.log("Sending WhatsApp message...");
  // Fetch active WhatsApp API from DB
  const waApi = await db.msg_apis.findFirst({
    where: { api_type: "Whatsapp", status: "Active" },
  });
  console.log("WhatsApp API:", waApi);

  if (!waApi) return false;
  // Fetch WhatsApp signature (if active)
  const signatureData = await db.msg_signature.findFirst({
    where: { status: "Active" },
  });

  if (signatureData?.whatsapp_signature) {
    whatsappContent += `\n\n${signatureData.whatsapp_signature}`;
  }

  // Encode message for URL
  const whatsappMsg = encodeURIComponent(whatsappContent);

  // Replace placeholders in API URL
  const params = waApi.params
    .replace("[NUMBER]", mobileNo)
    .replace("[MESSAGE]", whatsappMsg)
    .replace("file", attachment || "")
    .replace("[TEMP_ID]", tempId || "");

  const completeUrl = `${waApi.base_url}?${params}`

  try {
    // Send request to SMS API
    const result = await makeAxiosRequest(
      completeUrl,
      {},
      waApi.method,
    );

    console.log("WhatsApp API response:", result, "api url " + completeUrl);

    await db.msg_logs.create({
      data: {
        api_id: waApi.id,
        numbers: mobileNo + "",
        message: whatsappContent,
        base_url: waApi.base_url,
        params: params,
        api_response: JSON.stringify(result.response),
        created_at: dayjs().toDate(),
        updated_at: dayjs().toDate(),
      },
    });

    console.log("otp send on whatapp successfully ");
  } catch (err) {
    console.error("WhatsApp error:", err.message);
  }
}

// ================= Send SMS =================
async function sendSmsMessage(mobileNo, smsContent, attachment, tempId) {
  // Fetch active SMS API from DB
  const smsApi = await db.msg_apis.findFirst({
    where: { api_type: "SMS", status: "Active" },
  });

  if (!smsApi) {
    console.log("send msg error mgs api not define  ");
    return false;
  }

  // Fetch SMS signature (if active)
  const signatureData = await db.msg_signature.findFirst({
    where: { status: "Active" },
  });
  if (signatureData?.signature) {
    smsContent += `\n\n${signatureData.signature}`; // Add signature at the end
  }

  // Encode message for URL
  const textMsg = encodeURIComponent(smsContent);

  // Replace placeholders in API URL
  const params = smsApi.params
    .replace("[NUMBER]", mobileNo)
    .replace("[MESSAGE]", textMsg)
    .replace("file", attachment || "")
    .replace("[TEMP_ID]", tempId || "");

  const completeUrl = `${smsApi.base_url}?${params}`

  try {

    // Send request to SMS API
    const Api_response = await makeAxiosRequest(
      completeUrl,
      {},
      smsApi.method,
    );

    console.log(Api_response);

    // Save API log into database
    await db.msg_logs.create({
      data: {
        api_id: smsApi.id,
        numbers: mobileNo,
        message: smsContent,
        base_url: smsApi.base_url,
        params: params,
        api_response: JSON.stringify(Api_response.response),
        created_at: dayjs().toDate(),
        updated_at: dayjs().toDate(),
      },
    });
  } catch (err) {
    console.error("SMS error:", err.message);
  }
}

// ================= Send Email =================
async function sendEmailMessage(emailId, mail_subject, mail_content) {


  const emailData = {
    subject: mail_subject,
    message: messageContents.mail_content,
    email_type: "Message",
  };

  // await sendEmail(emailId, mail_subject, mail_subject, emailData.email_type);

  console.log("Queued email to:", emailId);

}


module.exports = {
  sendDynamicMessage
}