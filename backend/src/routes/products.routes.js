const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  searchProducts,
  activeProducts,
  bulkActivate,
  linkBarcode,
  findByBarcode,
  createGeneric,
  createManual,
  updateProduct,
  applyPriceUpdate,
  bulkPriceAdjustment,
} = require("../controllers/products.controller");

const router = express.Router();
router.use(requireAuth);

router.get("/", searchProducts);
router.get("/active", activeProducts);
router.get("/barcode/:barcode", findByBarcode);
router.post("/bulk-activate", bulkActivate);
router.post("/apply-price-update", applyPriceUpdate);
router.post("/bulk-price-adjustment", bulkPriceAdjustment);
router.post("/generic", createGeneric);
router.post("/manual", createManual);
router.patch("/:id", updateProduct);
router.patch("/:id/barcode", linkBarcode);

module.exports = router;
