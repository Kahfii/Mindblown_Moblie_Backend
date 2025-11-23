require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db'); 
const User = require('./models/user'); 
const Attendance = require('./models/Attendance');
const auth = require('./middleware/auth'); 
const { GoogleGenerativeAI } = require("@google/generative-ai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Hubungkan ke Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000; 
const JWT_SECRET = process.env.JWT_SECRET; 

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET tidak ditemukan di file .env");
  process.exit(1);
}

if (!GEMINI_API_KEY) { 
    console.error("FATAL ERROR: GEMINI_API_KEY tidak ditemukan di file .env");
    process.exit(1);
}

// === Inisialisasi Gemini AI ===
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 

// === Middleware ===
app.use(cors()); 
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware untuk logging semua transaksi/request
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log('\n=== TRANSAKSI BARU ===');
  console.log(`Waktu: ${timestamp}`);
  console.log(`Method: ${method}`);
  console.log(`URL: ${url}`);
  console.log(`IP Address: ${ip}`);
  console.log(`User Agent: ${userAgent}`);
  
  // Log request body jika ada (kecuali password untuk keamanan)
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyToLog = { ...req.body };
    if (bodyToLog.password) {
      bodyToLog.password = '[HIDDEN]';
    }
    console.log('Request Body:', JSON.stringify(bodyToLog, null, 2));
  }
  
  // Log ketika response selesai
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`Response Status: ${res.statusCode}`);
    console.log('=== TRANSAKSI SELESAI ===\n');
    originalSend.call(this, data);
  };
  
  next();
}); 

// === Rute Tes ===
app.get('/', (req, res) => {
  res.send('API MindBlown Berjalan...');
});

// ==========================================
// AUTH ROUTE (Register & Login)
// ==========================================

app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log(`📝 REGISTER ATTEMPT - Username: ${username}, Email: ${email}`);
    
    if (!username || !email || !password) {
      console.log('❌ REGISTER FAILED - Data tidak lengkap');
      return res.status(400).json({ msg: 'Data tidak lengkap' });
    }
    let existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ msg: 'Username sudah terdaftar' });

    existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'Email sudah terdaftar' });

    const user = new User({ username, email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    
    console.log(`✅ REGISTER SUCCESS - User ${username} berhasil terdaftar`);
    res.status(201).json({ msg: 'Registrasi berhasil' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    console.log(`🔐 LOGIN ATTEMPT - ${emailOrUsername}`);
    
    if (!emailOrUsername || !password) {
      console.log('❌ LOGIN FAILED - Kredensial tidak lengkap');
      return res.status(400).json({ msg: 'Kredensial tidak lengkap' });
    }

    let user = await User.findOne({
      $or: [ { email: emailOrUsername }, { username: emailOrUsername } ]
    });
    
    if (!user) {
      console.log(`❌ LOGIN FAILED - User tidak ditemukan: ${emailOrUsername}`);
      return res.status(400).json({ msg: 'Kredensial salah' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ LOGIN FAILED - Password salah untuk: ${emailOrUsername}`);
      return res.status(400).json({ msg: 'Kredensial salah' });
    }

    const payload = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '7d' }, 
      (err, token) => {
        if (err) throw err;
        console.log(`✅ LOGIN SUCCESS - User ${user.username} berhasil login`);
        console.log('🔑 TOKEN GENERATED:', token.substring(0, 20) + '...');
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
















app.post('/chat/curhat', auth, async (req, res) => {
    try {
        const { message } = req.body; // Pesan dari user (Android)

        if (!message) {
            return res.status(400).json({ msg: 'Pesan tidak boleh kosong' });
        }

        // Ambil nama user agar AI bisa menyapa
        const user = await User.findById(req.user.id).select('username');
        const username = user ? user.username : 'Teman';

        console.log(`🤖 AI CHAT - User: ${username}, Message: ${message}`);

        // Prompt Engineering: Membentuk kepribadian AI
        const prompt = `
            Bertindaklah sebagai teman curhat yang sangat empatik, suportif, dan pendengar yang baik bernama "MindBlown Bot".
            Lawan bicaramu bernama ${username}.
            
            Instruksi:
            1. Gunakan bahasa Indonesia yang santai, hangat, dan gaul tapi tetap sopan.
            2. Jangan menghakimi perasaan user.
            3. Berikan validasi atas perasaan mereka (contoh: "Wajar kok kalau kamu merasa gitu...").
            4. Berikan saran yang menenangkan hanya jika situasi membutuhkan, tapi fokus utamanya adalah mendengarkan.
            5. Jangan memberikan diagnosa medis/psikologis profesional, tapi sarankan ke profesional jika masalah terlihat sangat berat (seperti depresi berat).
            6. Jawablah dengan singkat dan padat (maksimal 3-4 kalimat) agar nyaman dibaca di HP.

            User berkata: "${message}"
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textResponse = response.text();

        console.log(`🤖 AI RESPONSE: ${textResponse}`);

        // Kirim balasan ke Android
        res.json({ 
            reply: textResponse,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Gemini Error:', err);
        res.status(500).json({ msg: 'Maaf, AI sedang lelah (Server Error)' });
    }
});

/**
 * @route   POST /emotion/analyze
 * @desc    Mendeteksi emosi DAN menyimpan absensi (Dibatasi 1x per hari)
 * @access  Private
 */
app.post('/emotion/analyze', auth, async (req, res) => {
    try {
        const { text } = req.body; 

        if (!text) return res.status(400).json({ msg: 'Teks tidak boleh kosong' });

        // 1. CEK APAKAH SUDAH ABSEN HARI INI
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const existingAttendance = await Attendance.findOne({
            user: req.user.id,
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        if (existingAttendance) {
            return res.status(400).json({ 
                msg: 'Anda sudah melakukan absensi hari ini. Kembali lagi besok ya!' 
            });
        }

        console.log(`🎭 EMOTION ANALYZE - Text: ${text}`);

        // 2. PROSES GEMINI (Sama seperti sebelumnya)
        const prompt = `
            Analisis emosi utama dari kalimat: "${text}".
            Kategorikan ke dalam SATU kategori: [Bahagia, Sedih, Marah, Takut, Jijik, Terkejut, Netral, Cemas, Semangat, Lelah].
            Hanya jawab dengan satu kata kategori saja.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let emotionResult = response.text().trim();
        
        const validEmotions = ["Bahagia", "Sedih", "Marah", "Takut", "Jijik", "Terkejut", "Netral", "Cemas", "Semangat", "Lelah"];
        const match = validEmotions.find(e => e.toLowerCase() === emotionResult.toLowerCase());
        if (match) emotionResult = match;
        else emotionResult = "Netral"; 

        // 3. SIMPAN KE DATABASE
        const newAttendance = new Attendance({
            user: req.user.id,
            originalText: text,
            detectedEmotion: emotionResult
        });

        await newAttendance.save();

        console.log(`🎭 ATTENDANCE SAVED: ${emotionResult}`);

        res.json({ 
            original_text: text,
            detected_emotion: emotionResult
        });

    } catch (err) {
        console.error('Gemini Error:', err);
        res.status(500).json({ msg: 'Gagal memproses absensi' });
    }
});

/**
 * @route   GET /attendance/history
 * @desc    Mengambil riwayat absensi user
 * @access  Private
 */
app.get('/attendance/history', auth, async (req, res) => {
    try {
        // Ambil data user ini, urutkan dari yang terbaru
        const history = await Attendance.find({ user: req.user.id })
            .sort({ createdAt: -1 });
        
        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// USER PROFILE ROUTES
// ==========================================

/**
 * @route   GET /users/me
 * @desc    Ambil data user yang sedang login (termasuk foto terbaru)
 * @access  Private
 */
app.get('/users/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   PUT /users/profile
 * @desc    Update username dan foto profil
 * @access  Private
 */
app.put('/users/profile', auth, async (req, res) => {
    try {
        const { username, photo } = req.body;

        // Cari user
        let user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User tidak ditemukan' });

        // Update field jika dikirim
        if (username) user.username = username;
        if (photo) user.photo = photo; // String Base64 yang panjang

        await user.save();

        res.json({ 
            msg: 'Profil berhasil diupdate',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                photo: user.photo
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// === Jalankan Server ===
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});