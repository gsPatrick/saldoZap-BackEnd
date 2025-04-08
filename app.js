// src/app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./src/config/database');

const usuarioRoutes = require('./src/usuarios/usuario.routes');
const transacaoRoutes = require('./src/transacoes/transacao.routes');
const categoriaRoutes = require('./src/categorias/categoria.routes');
const tagRoutes = require('./src/tags/tag.routes');
const alertaPagamentoRoutes = require('./src/alertas-pagamento/alerta-pagamento.routes');
const recorrenciaRoutes = require('./src/recorrencias/recorrencia.routes');
const authRoutes = require('./src/auth/auth.routes');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Teste de conexão com o banco de dados
sequelize.authenticate()
    .then(() => console.log('Database connected.'))
    .catch(err => console.error('Database connection error:', err));

// Rotas da API Versionadas (V1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuarioRoutes);
app.use('/api/v1/transacoes', transacaoRoutes);
app.use('/api/v1/categorias', categoriaRoutes);
app.use('/api/v1/tags', tagRoutes);
app.use('/api/v1/alertas-pagamento', alertaPagamentoRoutes);
app.use('/api/v1/recorrencias', recorrenciaRoutes);


app.get('/api/v1', (req, res) => {
    res.send('API Smart-Custo V1 está rodando!');
});


app.listen(port, () => {
    console.log(`API Smart-Custo rodando na porta ${port}`);
});