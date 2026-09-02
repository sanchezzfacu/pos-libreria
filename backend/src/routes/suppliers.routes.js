const express = require("express");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const {
  listSuppliers,
  createSupplier,
  updateSupplierParser,
  importPdfPreview,
  previewPriceUpdate,
} = require("../controllers/suppliers.controller");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = express.Router();

router.use(requireAuth);
router.get("/", listSuppliers);
router.post("/", createSupplier);
router.patch("/:id/parser", updateSupplierParser);
router.post("/:id/import-pdf", upload.single("pdf"), importPdfPreview);
router.post("/:id/preview-update", upload.single("pdf"), previewPriceUpdate);

module.exports = router;
