const { getIO } = require('./socket.service');

// 🔹 Send to specific rooms (restaurant_x, customer_y)
function sendNotification(event, payload, rooms = []) {
  try {
    const io = getIO();
    rooms.forEach((room) => {
      io.to(room).emit(event, payload);
      console.log(`📢 Sent ${event} to ${room}`);
    });
  } catch (err) {
    console.error("⚠️ sendNotification failed:", err);
  }
}

// 🔹 Send broadcast (e.g., for admins)
function broadcast(event, payload) {
  try {
    const io = getIO();
    io.emit(event, payload);
    console.log(`🌍 Broadcasted ${event}`);
  } catch (err) {
    console.error("⚠️ broadcast failed:", err);
  }
}

module.exports = { sendNotification, broadcast };
