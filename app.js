// src/app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./src/config/database');
const bcrypt = require('bcrypt'); // <<< 1. IMPORTAR BCRYPT

const usuarioRoutes = require('./src/usuarios/usuario.routes');
const transacaoRoutes = require('./src/transacoes/transacao.routes');
const categoriaRoutes = require('./src/categorias/categoria.routes');
const tagRoutes = require('./src/tags/tag.routes');
const alertaPagamentoRoutes = require('./src/alertas-pagamento/alerta-pagamento.routes');
const recorrenciaRoutes = require('./src/recorrencias/recorrencia.routes');
const authRoutes = require('./src/auth/auth.routes');
const alertScheduler = require('./src/jobs/alertScheduler');
const webhookRoutes = require('./src/webhooks/webhook.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- Bloco de Sincronização com o Banco de Dados ---
const syncDatabase = async () => {
    try {
        console.log('Iniciando sincronização com o banco de dados...');
        // Em desenvolvimento, force: true pode ser útil.
        // Para produção, mude para force: false ou use migrações.
        await sequelize.sync({ force: false }); 
        console.log('Banco de dados sincronizado com sucesso. (Tabelas recriadas!)');
    } catch (error) {
        console.error('Erro ao sincronizar o banco de dados:', error);
        process.exit(1);
    }
};

// <<< 2. FUNÇÃO PARA CRIAR O ADMIN SE NÃO EXISTIR >>>
const createAdminUserIfNotExists = async () => {
    const Usuario = require('./src/usuarios/usuario.model'); // Importa o modelo aqui dentro
    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'senhadoadmin';

    try {
        const adminExists = await Usuario.findOne({ where: { email: adminEmail } });

        if (!adminExists) {
            console.log('Usuário admin não encontrado. Criando...');
            
            // Criptografar a senha
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);
            
            // Criar o usuário
            await Usuario.create({
                nome: 'Administrador',
                email: adminEmail,
                senha: hashedPassword,
                telefone: '00000000000', // Telefone é obrigatório e único, use um placeholder
                assinatura_ativa: true,
                plano: 'Admin Vitalicio',
                assinatura_expira_em: null // Nunca expira
            });
            console.log('Usuário admin criado com sucesso!');
        } else {
            console.log('Usuário admin já existe no banco de dados.');
        }
    } catch (error) {
        console.error('ERRO AO TENTAR CRIAR USUÁRIO ADMIN:', error);
    }
};
// <<< FIM DA FUNÇÃO ADMIN >>>

// --- Rotas da API Versionadas (V1) ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuarioRoutes);
app.use('/api/v1/transacoes', transacaoRoutes);
app.use('/api/v1/categorias', categoriaRoutes);
app.use('/api/v1/tags', tagRoutes);
app.use('/api/v1/alertas-pagamento', alertaPagamentoRoutes);
app.use('/api/v1/recorrencias', recorrenciaRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// Rota de Teste de Conexão
const Usuario = require('./src/usuarios/usuario.model');
app.get('/api/v1/test-db-connection', async (req, res) => {
    try {
        await sequelize.authenticate();
        const users = await Usuario.findAll({ limit: 1 });
        res.json({ success: true, message: 'Database connection OK and User table seems OK.', users: users });
    } catch (error) {
        console.error("Database connection test failed:", error);
        res.status(500).json({ success: false, error: 'Database connection test failed', details: error.message });
    }
});

// Rota Raiz da API V1
app.get('/api/v1', (req, res) => {
    res.send('API Saldo Zap V1 está rodando!');
});

// --- Inicialização do Servidor ---
const startServer = async () => {
    // 1. Sincroniza o banco
    await syncDatabase();

    // <<< 3. CHAMA A FUNÇÃO DE CRIAÇÃO DO ADMIN >>>
    await createAdminUserIfNotExists();

    // 2. Inicia o servidor Express
    app.listen(PORT, () => {
        console.log(`API Saldo Zap rodando na porta ${PORT}`);

        // 3. Inicia o agendador de alertas
        try {
            console.log('Iniciando o agendador de alertas...');
            alertScheduler.scheduleTask();
        } catch (schedulerError) {
            console.error('Erro ao iniciar o agendador de alertas:', schedulerError);
        }
    });
};

// Chama a função para iniciar tudo
startServer();