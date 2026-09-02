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

// Log de todas las peticiones HTTP en consola: método, ruta, status y tiempo.
// "dev" es el formato compacto y coloreado, pensado para desarrollo.
app.use(morgan("dev"));

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Responder a las solicitudes Preflight
app.options('*', cors());
// Límite alto porque activar productos desde un PDF grande (miles de ítems)
// manda un payload considerable en un solo POST.
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/categories", categoryRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`[server] Backend corriendo en http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("[server] No se pudo conectar a MongoDB:", err.message);
    process.exit(1);
  });
