// src/webhooks/webhook.routes.js
const express = require('express');
const webhookController = require('./webhook.controller');
const authenticateApiKey = require('../middleware/authenticateApiKey'); // Usando o existente por simplicidade

const router = express.Router();

// Rota para receber webhooks do Kirvano
// Certifique-se de que o Kirvano está configurado para enviar o token no header 'x-api-key'
// e que o valor do token é o mesmo que process.env.N8N_API_KEY
router.post('/kirvano',  webhookController.handleKirvanoEvent);

module.exports = router;