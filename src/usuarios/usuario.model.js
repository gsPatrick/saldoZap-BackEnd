// src/usuarios/usuario.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_usuario'
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telefone: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true
  },
  data_cadastro: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'data_cadastro'
  },
  trial_fim: {
    type: DataTypes.DATE,
    field: 'trial_fim'
  },
  assinatura_ativa: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'assinatura_ativa'
  },
  assinatura_expira_em: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'assinatura_expira_em'
  },
  plano: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'plano'
  },
  // --- NOVO CAMPO ---
  primeiraMensagem: {
    type: DataTypes.BOOLEAN,
    allowNull: false,       // Não pode ser nulo
    defaultValue: true,     // Começa como true (primeira mensagem pendente)
    field: 'primeira_mensagem' // Nome da coluna no banco de dados
  }
  // --- FIM NOVO CAMPO ---
}, {
  tableName: 'usuarios',
  timestamps: false
});

module.exports = Usuario;