const { Sequelize } = require('sequelize');
require('dotenv').config();


const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false, // Ajuste para produção se necessário
  logging: false,
});

module.exports = sequelize;