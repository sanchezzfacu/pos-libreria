const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { listCategories, createCategory } = require("../controllers/categories.controller");

const router = express.Router();
router.use(requireAuth);

router.get("/", listCategories);
router.post("/", createCategory);

module.exports = router;
