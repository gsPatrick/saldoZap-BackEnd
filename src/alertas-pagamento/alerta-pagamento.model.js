// src/alertas-pagamento/alerta-pagamento.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model');

const AlertaPagamento = sequelize.define('AlertaPagamento', {
  id_alerta: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_alerta' // Garante mapeamento correto se houver convenções diferentes
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'id_usuario', // Garante mapeamento correto
    references: {
      model: Usuario, // Referencia o Model importado
      key: 'id_usuario'
    }
  },
  valor: {
    type: DataTypes.DECIMAL(10, 2), // Corresponde a numeric(10,2)
    allowNull: false
  },
  data_vencimento: {
    type: DataTypes.DATEONLY, // Melhor tipo para mapear DATE do SQL
    allowNull: false,
    field: 'data_vencimento' // Garante mapeamento correto
  },
  descricao: {
    type: DataTypes.TEXT, // Corresponde a text
    allowNull: true // O DB permite null (não tem 'not null')
  },
  codigo_unico: {
    type: DataTypes.STRING(50), // Corresponde a character varying(50)
    unique: true,
    allowNull: false,
    field: 'codigo_unico' // Garante mapeamento correto
  },
  status: {
    // Usar ENUM com os valores definidos no DB (o tipo 'status_alerta' no DB valida)
    type: DataTypes.ENUM('pendente', 'pago'),
    allowNull: false, // O DB tem 'not null'
    defaultValue: 'pendente' // O DB também tem o default
    // field: 'status' // Opcional, nome é igual
  }
}, {
  tableName: 'alertas_pagamento', // <<< CORRIGIDO PARA MINÚSCULO
  timestamps: false // Não há colunas createdAt/updatedAt no DB
});

// Define a associação
AlertaPagamento.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

module.exports = AlertaPagamento;