// src/services/zapi/zapi.service.js
const { apiClient, SEND_TEXT_URL } = require('./zapi.config');

/**
 * Envia uma mensagem de texto via Z-API, simulando digitação.
 * @param {string} phone - O número de telefone do destinatário (formato DDI+DDD+Numero, ex: "5511999999999").
 * @param {string} message - O texto da mensagem a ser enviada.
 * @param {object} [options] - Opções adicionais.
 * @param {number} [options.delayTyping=3] - Tempo em segundos que o bot aparecerá "digitando...". Padrão é 3 segundos.
 * @returns {Promise<object>} A resposta da API da Z-API em caso de sucesso.
 * @throws {Error} Lança um erro se a requisição falhar.
 */
const sendWhatsAppMessage = async (phone, message, options = {}) => {
    // Define um tempo de digitação padrão, mas permite que seja sobrescrito
    const typingDelay = options.delayTyping || 3; // Padrão de 3 segundos

    console.log(`[Z-API Service] Preparando para enviar mensagem para ${phone} com delay de ${typingDelay}s.`);

    const payload = {
        phone,
        message,
        delayTyping: typingDelay
    };

    try {
        // Usa a URL completa do endpoint de texto
        const response = await apiClient.post(SEND_TEXT_URL, payload);

        console.log(`[Z-API Service] Mensagem enviada com sucesso para ${phone}. Response ID: ${response.data?.zaapId || response.data?.id}`);
        return response.data; // Retorna os dados da resposta (ex: { zaapId, messageId })

    } catch (error) {
        console.error(`[Z-API Service] ERRO ao enviar mensagem para ${phone}.`);

        // Tratamento de erro mais detalhado do Axios
        if (error.response) {
            // A requisição foi feita e o servidor respondeu com um status de erro (fora do range 2xx)
            console.error('Status do Erro:', error.response.status);
            console.error('Dados do Erro:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // A requisição foi feita mas nenhuma resposta foi recebida
            console.error('Erro de Requisição: Nenhuma resposta recebida.', error.request);
        } else {
            // Algo aconteceu ao configurar a requisição que disparou um erro
            console.error('Erro na Configuração da Requisição:', error.message);
        }

        // Re-lança um erro padronizado para a camada que chamou o serviço saber que falhou
        throw new Error('Falha ao enviar mensagem via Z-API.');
    }
};

module.exports = {
    sendWhatsAppMessage,
};