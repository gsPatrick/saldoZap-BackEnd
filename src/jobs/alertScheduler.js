// src/jobs/alertScheduler.js
const cron = require('node-cron');
const axios = require('axios');
const { Op } = require('sequelize');
const AlertaPagamento = require('../alertas-pagamento/alerta-pagamento.model');
const Usuario = require('../usuarios/usuario.model');

// --- Credenciais Z-API Hardcoded ---
const ZAPI_INSTANCE_ID = '3DF5DE88F3E4A06538B632C54B267657';
const ZAPI_TOKEN = '33C4D90A5B63208868D1CAAC';
const ZAPI_CLIENT_TOKEN = 'Fb60f69a4625b40b9a67f7083974da62cS';
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
// --- Fim Credenciais ---

// <<< Conjunto para rastrear IDs já notificados nesta sessão da API >>>
let notificadosNestaSessao = new Set();
// <<< Flag para controlar limpeza inicial >>>
let schedulerIniciado = false;

// Função para buscar alertas que vencem HOJE
const findTodaysAlerts = async () => {
    // Não loga mais a cada minuto para não poluir muito
    // console.log('[AlertScheduler] Verificando alertas que vencem HOJE...');
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    try {
        const alerts = await AlertaPagamento.findAll({
            where: {
                status: 'pendente',
                data_vencimento: { [Op.eq]: hojeStr }
                // Não precisa mais filtrar por notificação aqui
            },
             include: [{
                 model: Usuario,
                 as: 'usuario',
                 attributes: ['telefone', 'nome']
             }]
        });
        // console.log(`[AlertScheduler] Encontrados ${alerts.length} alertas vencendo hoje.`);
        return alerts;
    } catch (error) {
        console.error('[AlertScheduler] Erro ao buscar alertas de hoje:', error);
        return [];
    }
};

// Função para montar a mensagem E ENVIAR via Z-API (com verificação em memória)
const sendWhatsAppReminder = async (alert) => {
     // <<< VERIFICA SE JÁ FOI NOTIFICADO NESTA SESSÃO >>>
     if (notificadosNestaSessao.has(alert.id_alerta)) {
        // console.log(`[AlertScheduler] Alerta ${alert.id_alerta} já notificado nesta sessão. Pulando.`);
        return; // Pula o envio
     }

     if (!alert.usuario || !alert.usuario.telefone) {
         console.warn(`[AlertScheduler] Alerta ID ${alert.id_alerta} sem usuário ou telefone. Não notificado.`);
         return;
     }

    // --- Montagem da Mensagem ---
    let messageText = "";
    const valorFormatado = (parseFloat(alert.valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const descricao = alert.descricao || alert.nome_categoria || 'Item';
    const nomeUsuario = alert.usuario.nome ? `, ${alert.usuario.nome}` : '';
    if (alert.tipo === 'despesa') {
        messageText = `Olá${nomeUsuario}! 👋\nLembrete de Pagamento Smart-Custo! ⏰\n\nSua conta de *${descricao}* no valor de *${valorFormatado}* vence *HOJE*! 🗓️\n\nCódigo para confirmação: ${alert.codigo_unico}`;
    } else if (alert.tipo === 'receita') {
        messageText = `Olá${nomeUsuario}! 👋\nPrevisão de Recebimento Smart-Custo! 💰\n\nEstá previsto para você receber *${descricao}* no valor de *${valorFormatado}* *HOJE*! 🗓️\n\nCódigo para confirmação: ${alert.codigo_unico}`;
    } else { /* ... */ return; }
    // --- Fim da Montagem da Mensagem ---

    // --- Envio via Z-API ---
    const zapiUrl = `${ZAPI_BASE_URL}/send-text`;
    const payload = { phone: alert.usuario.telefone, message: messageText };
    console.log(`[AlertScheduler] Enviando lembrete via Z-API para ${payload.phone}. Alerta ID: ${alert.id_alerta}`);
    try {
        const response = await axios.post(zapiUrl, payload, { /* ... headers e timeout ... */
             headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN }, timeout: 15000
        });
        console.log(`[AlertScheduler] Lembrete enviado com sucesso para ${payload.phone}. Z-API Response ID: ${response.data?.zaapId || response.data?.id || 'N/A'}`);
        // <<< ADICIONA AO SET APÓS ENVIO BEM SUCEDIDO >>>
        notificadosNestaSessao.add(alert.id_alerta);
    } catch (error) { /* ... tratamento erro Z-API ... */ }
    // --- Fim Envio Z-API ---
};


// Agenda a tarefa para rodar a cada minuto
const scheduleTask = () => {
    const cronPattern = '*/1 * * * *'; // A cada 1 minuto
    const timezone = process.env.TZ || 'America/Sao_Paulo';

    console.log(`[AlertScheduler] Agendando envio de lembretes (rastreio em memória) via Z-API com padrão "${cronPattern}" no fuso "${timezone}".`);

    cron.schedule(cronPattern, async () => {
        // Limpa o rastreamento apenas uma vez no início de cada dia (opcional, mas bom)
        // Ou simplesmente confia que a memória será limpa na reinicialização (se ocorrer)
        const agora = new Date();
        if (!schedulerIniciado || agora.getHours() === 0 && agora.getMinutes() === 0) { // Ex: Limpa à meia-noite
             if (!schedulerIniciado) {
                console.log('[AlertScheduler] Primeira execução, iniciando rastreamento em memória.');
                schedulerIniciado = true;
             } else {
                 console.log('[AlertScheduler] Limpando rastreamento de notificações em memória (início do dia).');
                 notificadosNestaSessao.clear();
             }
        }


        // Não loga mais a cada minuto para evitar poluição
        // const now = new Date().toLocaleString('pt-BR', { timeZone: timezone });
        // console.log(`[AlertScheduler] Executando tarefa agendada em ${now}...`);
        const alertsToNotify = await findTodaysAlerts();

        if (alertsToNotify.length > 0) {
            // Loga apenas se encontrar algo para processar
            console.log(`[AlertScheduler] Tarefa agendada: ${alertsToNotify.length} alertas encontrados para HOJE. Processando...`);
            for (const alert of alertsToNotify) {
                // A verificação se já foi notificado está dentro de sendWhatsAppReminder
                await sendWhatsAppReminder(alert);
                await new Promise(resolve => setTimeout(resolve, 500)); // Mantém delay
            }
            console.log('[AlertScheduler] Processamento de alertas concluído.');
        } else {
            // Não loga nada se não encontrar alertas
            // console.log('[AlertScheduler] Nenhum alerta vencendo hoje encontrado.');
        }
         // console.log('[AlertScheduler] Tarefa agendada concluída.'); // Log muito frequente
    }, {
        scheduled: true,
        timezone: timezone
    });
};

module.exports = { scheduleTask };