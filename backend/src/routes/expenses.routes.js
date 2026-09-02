const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createExpense, listExpenses, deleteExpense } = require("../controllers/expenses.controller");

const router = express.Router();
router.use(requireAuth);

router.get("/", listExpenses);
router.post("/", createExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
