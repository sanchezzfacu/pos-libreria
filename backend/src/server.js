require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const supplierRoutes = require("./routes/suppliers.routes");
const productRoutes = require("./routes/products.routes");
const saleRoutes = require("./routes/sales.routes");
const expenseRoutes = require("./routes/expenses.routes");
const customerRoutes = require("./routes/customers.routes");
const categoryRoutes = require("./routes/categories.routes");

const app = express();

app.use(morgan("dev"));

// Configuración de CORS
const origin = process.env.FRONTEND_URL || "*";

app.use(cors({
  origin: origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight universal para Express 4.x
app.options('*', cors());

app.use(express.json({ limit: "25mb" }));

// Health Check (útil para que Railway sepa que la app está viva)
app.get("/api/health", (req, res) => res.json({ ok: true, status: "healthy" }));

app.use("/api/auth", authRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/categories", categoryRoutes);

// Manejo centralizado de errores con cabecera de fallback
app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 4000;

// Levantar el servidor HTTP primero e intentar conectar a DB
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Backend escuchando en 0.0.0.0:${PORT}`);
  
  connectDB()
    .then(() => {
      console.log("[server] Conexión exitosa a MongoDB.");
    })
    .catch((err) => {
      console.error("[server] Error al conectar a MongoDB:", err.message);
    });
});