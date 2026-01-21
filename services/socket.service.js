// services/socket.service.js
const { Server } = require('socket.io');
const prisma = require('../utils/prisma');
const { sendNotification } = require('./notification.service');

let io = null;

/**
 * Initialize Socket.IO server
 */
function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`🟢 Socket connected: ${socket.id}`);

    /**
     * Rooms
     * - customer_<id>
     * - restaurant_<id>
     * - kitchen_<id>
     */
    socket.on('joinRoom', ({ type, id }) => {
      const room = `${type}_${id}`;
      socket.join(room);
      console.log(`➡️ ${type} joined room: ${room}`);
    });

    /**
     * 🔹 Kitchen updates order status
     * Emits updates to both customer and restaurant
     */
    socket.on('updateOrderStatus', async ({ order_id, status, user_id }) => {
      try {
        const order = await prisma.orders.findUnique({
          where: { id: BigInt(order_id) },
          select: {
            id: true,
            order_no: true,
            restaurant_id: true,
            customer_id: true,
            status: true,
          },
        });

        if (!order) {
          console.warn(`⚠️ Order not found: ${order_id}`);
          return;
        }

        // Update order + log history
        const updatedOrder = await prisma.orders.update({
          where: { id: BigInt(order_id) },
          data: { status },
        });

        await prisma.order_status_history.create({
          data: {
            order_id: BigInt(order_id),
            from_status: order.status,
            to_status: status,
            changed_by: user_id ? BigInt(user_id) : null,
            note: 'Updated via socket event',
          },
        });

        // Save event in DB for analytics / retry
        await prisma.order_events.create({
          data: {
            order_id: BigInt(order_id),
            event_type: status,
            payload: {
              updated_by: 'Kitchen',
              timestamp: new Date().toISOString(),
            },
          },
        });

        // Notify both sides (customer + restaurant)
        emitEvent(
          'orderStatusUpdated',
          {
            order_id,
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
    socket.on('cancelOrder', async ({ order_id, customer_id, reason }) => {
      try {
        const order = await prisma.orders.update({
          where: { id: BigInt(order_id) },
          data: { status: 'Cancelled' },
          select: { order_no: true, restaurant_id: true },
        });

        await prisma.order_status_history.create({
          data: {
            order_id: BigInt(order_id),
            from_status: 'Pending',
            to_status: 'Cancelled',
            changed_by: BigInt(customer_id),
            note: reason || 'Cancelled by customer',
          },
        });

        emitEvent(
          'orderCancelled',
          {
            order_id,
            reason,
            message: 'Order cancelled by customer',
          },
          [`restaurant_${order.restaurant_id}`]
        );

        console.log(`❌ Order ${order_id} cancelled by customer`);
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
function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { initSocket, emitEvent, getIO };
