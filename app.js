
// src/app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./src/config/database');

const usuarioRoutes = require('./src/usuarios/usuario.routes');
const transacaoRoutes = require('./src/transacoes/transacao.routes');
const categoriaRoutes = require('./src/categorias/categoria.routes');
const tagRoutes = require('./src/tags/tag.routes');
const alertaPagamentoRoutes = require('./src/alertas-pagamento/alerta-pagamento.routes');
const recorrenciaRoutes = require('./src/recorrencias/recorrencia.routes');
const authRoutes = require('./src/auth/auth.routes');
const alertScheduler = require('./src/jobs/alertScheduler'); // <<< Importar o agendador

// --- Importar Rotas ---

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- Bloco de Sincronização com o Banco de Dados ---
const syncDatabase = async () => {
    try {
        console.log('Iniciando sincronização com o banco de dados...');

        // >>>>> PONTO CRÍTICO: `force: true` apaga tudo! <<<<<
        // Mude para `force: false` ou remova a opção `force` para produção segura
        // ou use `alter: true` para tentar aplicar alterações (também arriscado sem migrações).
        await sequelize.sync({ force: true });
        // >>>>> --------------------------------------- <<<<<

        console.log('Banco de dados sincronizado com sucesso. (Tabelas recriadas!)');

    } catch (error) {
        console.error('Erro ao sincronizar o banco de dados:', error);
        // Considerar encerrar a aplicação se a sincronização falhar criticamente
        process.exit(1);
    }
};
// ----------------------------------------------------


// --- Rotas da API Versionadas (V1) ---
// Certifique-se de que os caminhos estão corretos
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuarioRoutes);
app.use('/api/v1/transacoes', transacaoRoutes);
app.use('/api/v1/categorias', categoriaRoutes);
app.use('/api/v1/tags', tagRoutes);
// A rota '/api/v1/alertas' estava duplicada, removi uma. Use '/alertas-pagamento'
app.use('/api/v1/alertas-pagamento', alertaPagamentoRoutes);
app.use('/api/v1/recorrencias', recorrenciaRoutes);
// app.use('/api/v1/alertas', alertaPagamentoRoutes); // Rota duplicada, remover.


// Rota de Teste de Conexão (Opcional, mas útil após sync)
// Precisa importar Usuario se for usar aqui
const Usuario = require('./src/usuarios/usuario.model'); // Importar para teste
app.get('/api/v1/test-db-connection', async (req, res) => {
    try {
        await sequelize.authenticate(); // Testa a conexão básica
        // Tenta buscar um usuário para verificar se a tabela existe após sync
        const users = await Usuario.findAll({ limit: 1 });
        res.json({ success: true, message: 'Database connection OK and User table seems OK.', users: users });
    } catch (error) {
        console.error("Database connection test failed:", error);
        res.status(500).json({ success: false, error: 'Database connection test failed', details: error.message });
    }
});


// Rota Raiz da API V1
app.get('/api/v1', (req, res) => {
    res.send('API Smart-Custo V1 está rodando!');
});


// --- Inicialização do Servidor ---
const startServer = async () => {
    // 1. Sincroniza o banco
    await syncDatabase();

    // 2. Inicia o servidor Express
    app.listen(PORT, () => {
        console.log(`API Smart-Custo rodando na porta ${PORT}`);

        // <<< PASSO 3: INICIA O AGENDADOR DEPOIS QUE O SERVIDOR ESTÁ RODANDO >>>
        try {
            console.log('Iniciando o agendador de alertas...');
            alertScheduler.scheduleTask(); // <<< CHAMADA DA FUNÇÃO
            // O log de agendamento ("[AlertScheduler] Agendando envio...") deve aparecer depois desta linha
        } catch (schedulerError) {
            console.error('Erro ao iniciar o agendador de alertas:', schedulerError);
            // Decida se a API deve parar se o scheduler falhar ao iniciar
        }
        // <<< FIM DA INICIALIZAÇÃO DO AGENDADOR >>>

    });
};

// Chama a função para iniciar tudo
startServer();
// ---------------------------------