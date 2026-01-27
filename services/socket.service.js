// services/socket.service.js
const { Server } = require('socket.io');
const prisma = require('../utils/prisma');
const { verifyTokenUtil } = require('../utils/tokenUtils');

let io = null;

/**
 * Initialize Socket.IO server
 */
function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*' },
  });

  io.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;
      console.log("token", token)
      if (!token) {
        return next(new Error("Authentication token is missing"));
      }

      const result = await verifyTokenUtil(token);

      if (!result?.success) {
        return next(new Error(result.message || "Unauthorized"));
      }
      console.log('result', result);

      // =========================
      // 👤 USER (Admin / Staff)
      // =========================

      if (result.user) {
        socket.user = result.user;
        socket.user_id = Number(result.user.user_id);
        socket.role = result.user.role;
        socket.restaurant_id = result.user.restaurant_id;
      }

      // =========================
      // 🧑‍🍳 CUSTOMER
      // =========================

      if (result.customer) {
        socket.customer = result.customer;
        socket.customer_id = Number(result.customer.customer_id);
        socket.role = result.customer.role;
        socket.restaurant_id = result.customer.restaurant_id;
      }

      socket.authType = result.type;
      socket.token = token;

      next();
    } catch (err) {
      console.error("Socket auth error:", err);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    /**
     * Rooms
     * - customer_<id>
     * - restaurant_<id>
     * - kitchen_<id>
     */

    socket.on("joinRoom", () => {
      let room = null;
      const type = socket.authType
      console.log("joinRoom", type);

      // =========================
      // 🧑‍🍳 CUSTOMER
      // =========================
      if (type === "Customer" && socket.customer_id) {
        room = `customer_${socket.customer_id}`;
      }

      // =========================
      // 🏪 RESTAURANT (USER TYPE)
      // =========================
      else if (
        type === "User" &&
        socket.restaurant_id &&
        ["PlatformAdmin", "RestaurantStaff", "KitchenStaff"].includes(socket.role)
      ) {
        room = `restaurant_${socket.restaurant_id}`;
      }


      if (!room) {
        console.log("❌ Unauthorized room join attempt");
        return;
      }

      socket.join(room);
      console.log(`➡️ ${socket.role} joined room: ${room}`);
    });




    /**
     * 🔹 Kitchen updates order status
     * Emits updates to both customer and restaurant
     */
    socket.on('updateOrderStatus', async ({ order_no, status, user_id }) => {
      try {
        const order = await prisma.orders.findUnique({
          where: { order_no: String(order_no) },
          select: {
            id: true,
            order_no: true,
            restaurant_id: true,
            customer_id: true,
            status: true,
          },
        });

        if (!order) {
          console.warn(`⚠️ Order not found: ${order_no}`);
          return;
        }

        // Update order + log history
        const updatedOrder = await prisma.orders.update({
          where: { order_no: String(order_no) },
          data: { status },
        });

        // await prisma.order_status_history.create({
        //   data: {
        //     order_no: (order_no),
        //     from_status: order.status,
        //     to_status: status,
        //     changed_by: user_id ? BigInt(user_id) : null,
        //     note: 'Updated via socket event',
        //   },
        // });

        // Save event in DB for analytics / retry
        // await prisma.order_events.create({
        //   data: {
        //     order_no: (order_no),
        //     event_type: status,
        //     payload: {
        //       updated_by: 'Kitchen',
        //       timestamp: new Date().toISOString(),
        //     },
        //   },
        // });

        // Notify both sides (customer + restaurant)

        emitEvent(
          'orderStatusUpdated',
          {
            order_no: order.order_no,
            from_status: order.status,
            to_status: status,
          },
          [`customer_${order.customer_id}`, `restaurant_${order.restaurant_id}`]
        );

        console.log(
          `✅ Order ${order.order_no} updated ${order.status} → ${status}`
        );
      } catch (err) {
        console.error('❌ Socket order update error:', err);
      }
    });

    /**
     * 🔹 Customer cancels an order
     */
    socket.on('cancelOrder', async ({ order_no, customer_id, reason }) => {
      try {
        const order = await prisma.orders.update({
          where: { order_no: String(order_no) },
          data: { status: 'Cancelled' },
          select: { order_no: true, restaurant_id: true },
        });

        // await prisma.order_status_history.create({
        //   data: {
        //     order_no: BigInt(order_no),
        //     from_status: 'Pending',
        //     to_status: 'Cancelled',
        //     changed_by: BigInt(customer_id),
        //     note: reason || 'Cancelled by customer',
        //   },
        // });

        emitEvent(
          'orderCancelled',
          {
            order_no,
            reason,
            message: 'Order cancelled by customer',
          },
          [`restaurant_${order.restaurant_id}`]
        );

        console.log(`❌ Order ${order_no} cancelled by customer`);
      } catch (err) {
        console.error('⚠️ Cancel order error:', err);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔴 Socket disconnected: ${socket.id}`);
    });
  });

  console.log('✅ Socket.IO initialized with rooms & event handlers');
}

/**
 * Emit an event safely
 */
function emitEvent(eventName, payload, rooms) {
  if (!io) {
    console.error('⚠️ Socket.io not initialized yet!');
    return;
  }

  if (Array.isArray(rooms)) {
    rooms.forEach((room) => io.to(room).emit(eventName, payload));
  } else {
    io.to(rooms).emit(eventName, payload);
  }

  console.log(`📤 Emitted [${eventName}] → ${Array.isArray(rooms) ? rooms.join(', ') : rooms}`);
}

/**
 * Exported getIO method (for external use)
 */

async function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}


// 🔹 Send to specific rooms (restaurant_x, customer_y)
async function sendNotification(event, payload, rooms = []) {
  try {
    const io = await getIO();
    console.log("sendNotification payload", payload);

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


module.exports = { initSocket, emitEvent, getIO, sendNotification, broadcast };
