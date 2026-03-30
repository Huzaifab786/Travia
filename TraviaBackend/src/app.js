const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const rideRoutes = require("./routes/rideRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const routeRoutes = require("./routes/routeRoutes");
const placeRoutes = require("./routes/placeRoutes");
const driverRoutes = require("./routes/driverRoutes");
const adminRoutes = require("./routes/adminRoutes");


const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "TraviaBackend" });
});

app.use("/api/rides", rideRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/drivers", driverRoutes);

app.use("/api/routes", routeRoutes);
app.use("/api/places", placeRoutes);
app.use("/api/admin",  adminRoutes);


/** ✅ Global error handler (MUST be last) */
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);

  const status = err.statusCode || err.status || 500;

  res.status(status).json({
    message: err.message || "Server error",
  });
});

module.exports = app;