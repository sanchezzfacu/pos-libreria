const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  createSale,
  getSale,
  facturarVenta,
  closeToday,
  salesByDate,
  deleteSale,
  stats,
  productStats,
} = require("../controllers/sales.controller");

const router = express.Router();
router.use(requireAuth);

router.post("/", createSale);
router.post("/:id/facturar", facturarVenta);
router.get("/close-today", closeToday);
router.get("/by-date", salesByDate);
router.get("/stats", stats);
router.get("/stats/productos", productStats);
// "/:id" matchea cualquier cosa, así que va después de las rutas GET
// específicas de arriba (close-today, by-date, stats) para no taparlas.
router.get("/:id", getSale);
router.delete("/:id", deleteSale);

module.exports = router;
