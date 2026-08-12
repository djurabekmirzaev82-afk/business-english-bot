const jwt = require('jsonwebtoken');
const config = require('../../config');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Tizimga kirish talab qilinadi.' });
  }
  try {
    const payload = jwt.verify(header.split(' ')[1], config.jwtSecret);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Token yaroqsiz yoki muddati o'tgan." });
  }
}

module.exports = { requireAuth };
