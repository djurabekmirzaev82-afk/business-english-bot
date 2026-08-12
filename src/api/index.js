const express = require('express');

const router = express.Router();

router.use('/auth', require('./routes/auth'));
router.use('/progress', require('./routes/progress'));
router.use('/writing', require('./routes/writing'));
router.use('/content', require('./routes/content'));
router.use('/speaking', require('./routes/speaking'));
module.exports = router;
