const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { searchCustomers, createCustomer } = require("../controllers/customers.controller");

const router = express.Router();
router.use(requireAuth);

router.get("/", searchCustomers);
router.post("/", createCustomer);

module.exports = router;
