// src/jobs/alertScheduler.js
const cron = require('node-cron');
const axios = require('axios'); // Para fazer a chamada HTTP
const { Op } = require('sequelize');
const AlertaPagamento = require('../alertas-pagamento/alerta-pagamento.model'); // Ajuste o caminho se necessário
const Usuario = require('../usuarios/usuario.model'); // Para pegar o telefone?

const N8N_WEBHOOK_URL = process.env.N8N_ALERT_WEBHOOK_URL; // Pegar a URL do .env

// Função para buscar alertas próximos
const findUpcomingAlerts = async () => {
    console.log('[AlertScheduler] Verificando alertas próximos...');
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);

    const hojeStr = hoje.toISOString().split('T')[0];
    const amanhaStr = amanha.toISOString().split('T')[0];

    try {
        const alerts = await AlertaPagamento.findAll({
            where: {
                status: 'pendente',
                data_vencimento: {
                    // Vence hoje OU amanhã
                    [Op.in]: [hojeStr, amanhaStr]
                    // Ou apenas hoje:
                    // [Op.eq]: hojeStr
                    // Ou entre hoje e próximos X dias:
                    // [Op.between]: [hojeStr, dataFuturaStr]
                }
            },
             include: [{ // Incluir usuário para pegar telefone
                 model: Usuario,
                 as: 'usuario',
                 attributes: ['telefone'] // Pega só o telefone
             }]
        });
        console.log(`[AlertScheduler] Encontrados ${alerts.length} alertas próximos.`);
        return alerts;
    } catch (error) {
        console.error('[AlertScheduler] Erro ao buscar alertas:', error);
        return []; // Retorna vazio em caso de erro
    }
};

// Função para enviar notificação para o N8N
const notifyN8N = async (alert) => {
    if (!N8N_WEBHOOK_URL) {
        console.error('[AlertScheduler] URL do Webhook N8N não configurada em N8N_ALERT_WEBHOOK_URL.');
        return;
    }
    if (!alert.usuario || !alert.usuario.telefone) {
         console.warn(`[AlertScheduler] Alerta ID ${alert.id_alerta} sem usuário ou telefone associado. Não é possível notificar.`);
         return;
    }


    const payload = {
        eventType: 'PAYMENT_REMINDER', // Tipo de evento para o N8N identificar
        alertId: alert.id_alerta,
        userId: alert.id_usuario,
        userPhone: alert.usuario.telefone, // Envia o telefone do usuário
        description: alert.descricao,
        value: alert.valor,
        dueDate: alert.data_vencimento,
        alertCode: alert.codigo_unico, // Envia o código único
        alertType: alert.tipo // Envia 'despesa' ou 'receita'
    };

    console.log(`[AlertScheduler] Enviando notificação para N8N para Alerta ID ${alert.id_alerta}, Usuário ${alert.id_usuario} (Tel: ${alert.usuario.telefone})`);

    try {
        const response = await axios.post(N8N_WEBHOOK_URL, payload, {
             headers: { 'Content-Type': 'application/json' }
             // Adicione API Key se o webhook N8N for protegido
             // headers: { 'X-N8N-API-Key': 'SUA_CHAVE_N8N' }
        });
        console.log(`[AlertScheduler] Notificação enviada com sucesso para Alerta ID ${alert.id_alerta}. Resposta N8N: ${response.status}`);
    } catch (error) {
        console.error(`[AlertScheduler] Erro ao enviar notificação para N8N para Alerta ID ${alert.id_alerta}:`, error.response?.status, error.response?.data || error.message);
    }
};

// Agenda a tarefa para rodar todo dia às 8:00 AM (ajuste o cron pattern)
// Formato: 'segundo minuto hora dia-do-mês mês dia-da-semana'
// '* * * * * *' = a cada segundo (para teste)
// '0 8 * * *' = todo dia às 8:00:00
const scheduleTask = () => {
    // Verifica se a URL do webhook está configurada antes de agendar
     if (!N8N_WEBHOOK_URL) {
        console.warn('[AlertScheduler] A variável de ambiente N8N_ALERT_WEBHOOK_URL não está definida. O agendador de alertas não será iniciado.');
        return; // Não agenda se a URL não existe
    }

    console.log('[AlertScheduler] Agendando verificação de alertas para rodar todo dia às 08:00.');
    cron.schedule('0 8 * * *', async () => { // <<< Ajuste o horário aqui
        console.log('[AlertScheduler] Executando tarefa agendada...');
        const alertsToNotify = await findUpcomingAlerts();

        if (alertsToNotify.length > 0) {
            // Envia notificações em sequência (ou paralelo com Promise.all)
            for (const alert of alertsToNotify) {
                await notifyN8N(alert);
                // Adicionar um pequeno delay se necessário para não sobrecarregar o N8N
                await new Promise(resolve => setTimeout(resolve, 100)); // Delay de 100ms
            }
        } else {
            console.log('[AlertScheduler] Nenhum alerta próximo encontrado para notificar.');
        }
         console.log('[AlertScheduler] Tarefa agendada concluída.');
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo" // <<< Defina seu fuso horário
    });
};

// Exporta a função para iniciar o agendador
module.exports = { scheduleTask };