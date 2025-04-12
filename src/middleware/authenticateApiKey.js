// src/middleware/authenticateApiKey.js
function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key']; // Nome do header que o N8N enviará

    if (apiKey && apiKey === process.env.N8N_API_KEY) {
        // Chave válida, permite continuar para a próxima função (a rota)
        console.log('[AuthMiddleware] API Key Válida recebida.'); // Log opcional
        next();
    } else {
        // Chave inválida ou ausente
        console.warn('[AuthMiddleware] Tentativa de acesso com API Key inválida ou ausente.'); // Log opcional
        res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }
}

module.exports = authenticateApiKey;