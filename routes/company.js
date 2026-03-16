const express = require('express');
const router = express.Router();
const { getCompany, updateCompany, uploadMiddleware } = require('../controllers/companyController');
const protect = require('../middleware/auth');

router.get('/', protect, getCompany);
router.put('/', protect, uploadMiddleware, updateCompany);

module.exports = router;