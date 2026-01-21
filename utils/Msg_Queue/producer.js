const { messageQueue } = require("./messageQueue");

async function sendDynamicMessageQ(msg_data) {
  await messageQueue.add("sendMessage", msg_data);
  console.log("📩 msg added:", msg_data);
  return 'OTP sent to your registered mobile no.'
}

module.exports = { sendDynamicMessageQ };
