const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const JSONbig = require('json-bigint');
const { initSocket } = require('./services/socket.service');
const prisma = require('./utils/prisma');
const helmet = require("helmet");

dotenv.config();

const app = express();
const server = http.createServer(app);
const HOST = "0.0.0.0";
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: { imgSrc: ['self'] },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// app.set("x-powered-by", false);   

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true }));

// ✅ Safe JSON output (for BigInt)


app.use((req, res, next) => {
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSONbig.stringify(data));
  };
  next();
});

// ✅ Graceful Prisma shutdown

process.on("SIGINT", async () => {
  console.log("Closing Prisma connection...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Closing Prisma connection...");
  await prisma.$disconnect();
  process.exit(0);
});

// Routers
const authRoutes = require('./routes/authRoutes');


const restaurantRouter = require('./routes/restaurantRouter');
const foodRouter = require('./routes/foodManagementRoutes');
const orderRouter = require('./routes/orderRouter');
const payment = require('./routes/payments.routes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalyticsRoutes');
const { getRestaurantMenu } = require('./controllers/User_Dashboard/user_dashboard');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/restaurants', restaurantRouter);
app.use('/api/v1/foods', foodRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/payments', payment);
app.use('/api/v1/subscriptions', subscriptionRoutes);

app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
app.use('/api/v1/menu', getRestaurantMenu);


// Health check
app.get('/', (req, res) => {
  res.json({ message: '✅ API Server Running + Socket Ready 🚀' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ success: false, message: err.message });
});

// ✅ Initialize Socket.IO separately
initSocket(server);

// Start Server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});
