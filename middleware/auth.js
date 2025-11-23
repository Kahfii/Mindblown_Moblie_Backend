const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Log untuk debugging
  console.log('🔐 AUTH CHECK - Headers received:', {
    'x-auth-token': req.header('x-auth-token'),
    'authorization': req.header('authorization'),
    'Authorization': req.header('Authorization')
  });

  // 1. Ambil token dari berbagai format header yang umum digunakan
  let token = req.header('x-auth-token') || 
              req.header('authorization') || 
              req.header('Authorization');

  // Jika token menggunakan format "Bearer <token>", ambil token-nya saja
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7, token.length).trimLeft();
  }

  console.log('🎯 TOKEN EXTRACTED:', token ? 'Token found' : 'No token');

  // 2. Cek jika tidak ada token
  if (!token) {
    console.log('❌ AUTH FAILED - No token provided');
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // 3. Verifikasi token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Simpan data user (id) yang ada di token ke dalam request
    req.user = decoded.user;
    
    console.log(`✅ AUTH SUCCESS - User: ${decoded.user.username || decoded.user.id}`);
    next(); // Lanjut ke fungsi berikutnya (route handler)
  } catch (err) {
    console.log('❌ AUTH FAILED - Invalid token:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};