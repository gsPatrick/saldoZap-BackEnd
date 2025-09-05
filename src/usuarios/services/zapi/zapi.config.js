// src/services/zapi/zapi.config.js
require('dotenv').config();
const axios = require('axios'); // Vamos usar axios para as requisições

// Validação das variáveis de ambiente essenciais
const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;

if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    console.error("ERRO CRÍTICO: As credenciais da Z-API não estão definidas no arquivo .env.");
    process.exit(1); // Interrompe a aplicação se as credenciais estiverem faltando
}

// Monta a URL base da API
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;

// Endpoint específico para enviar texto
const SEND_TEXT_URL = `${ZAPI_BASE_URL}/send-text`;

// Monta os headers que serão usados em todas as requisições
const ZAPI_HEADERS = {
    'Content-Type': 'application/json',
    'Client-Token': ZAPI_CLIENT_TOKEN,
};

// Cria uma instância do Axios pré-configurada (boa prática)
const apiClient = axios.create({
    baseURL: ZAPI_BASE_URL,
    headers: ZAPI_HEADERS,
    timeout: 15000 // Timeout de 15 segundos para evitar requisições presas
});


module.exports = {
    apiClient,
    SEND_TEXT_URL,
    // Não precisamos mais exportar ZAPI_HEADERS e ZAPI_BASE_URL separadamente
};