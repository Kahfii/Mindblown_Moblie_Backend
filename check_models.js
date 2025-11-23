require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Script menggunakan fetch bawaan Node.js (v18+)
async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if(!key) {
        console.log("API Key belum ada di .env!");
        return;
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    
    try {
        // Fetch sudah tersedia global di Node v22
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.models) {
            console.log("\n=== MODEL YANG TERSEDIA ===");
            data.models.forEach(m => {
                // Filter hanya model yang bisa generateContent
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name.replace('models/', '')}`);
                }
            });
            console.log("===========================\n");
            console.log("Gunakan salah satu nama di atas di index.js Anda.");
        } else {
            console.log("Gagal mengambil list model:", data);
        }
    } catch (e) {
        console.log("Error koneksi:", e);
    }
}

listModels();