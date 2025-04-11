// src/alertas-pagamento/alerta-pagamento.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model');
const Recorrencia = require('../recorrencias/recorrencia.model'); // <<< ADICIONAR IMPORT
const { nanoid } = require('nanoid'); // Certifique-se que está importado

const AlertaPagamento = sequelize.define('AlertaPagamento', {
  id_alerta: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_alerta'
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'id_usuario',
    references: {
      model: Usuario,
      key: 'id_usuario'
    }
  },
  valor: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  data_vencimento: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'data_vencimento'
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  codigo_unico: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false, // <<< Gerado automaticamente, não deve ser nulo
    field: 'codigo_unico'
  },
  status: {
    // Adicionar 'cancelado' se quiser explicitamente cancelar uma ocorrência
    type: DataTypes.ENUM('pendente', 'pago', 'cancelado'), // <<< MODIFICAR ENUM (Opcional)
    allowNull: false,
    defaultValue: 'pendente'
  },
  // --- CAMPOS ADICIONADOS ---
  id_recorrencia_pai: {
      type: DataTypes.INTEGER,
      allowNull: true, // Permite NULO para alertas manuais
      field: 'id_recorrencia_pai',
      references: {
          model: Recorrencia, // <<< REFERENCIAR MODELO
          key: 'id_recorrencia'
      }
  },
  tipo: { // <<< ADICIONAR CAMPO TIPO (despesa/receita)
      type: DataTypes.ENUM('despesa', 'receita'),
      allowNull: false,
      // Defina um default ou torne obrigatório na criação via N8N
      // Ex: defaultValue: 'despesa'
  },
  nome_categoria: { // <<< ADICIONAR (Opcional, para cópia da recorrência)
      type: DataTypes.STRING,
      allowNull: true
  }
  // --- FIM DOS CAMPOS ADICIONADOS ---
}, {
  tableName: 'alertas_pagamento',
  timestamps: false,
  indexes: [ // <<< ADICIONAR ÍNDICES
      { fields: ['id_usuario', 'status', 'data_vencimento'] }, // Otimiza consulta de pendentes
      { fields: ['id_recorrencia_pai', 'status'] } // Otimiza limpeza ao deletar recorrência
  ]
});

// --- ASSOCIAÇÕES ADICIONADAS ---
AlertaPagamento.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' }); // Já deve existir
AlertaPagamento.belongsTo(Recorrencia, { foreignKey: 'id_recorrencia_pai', as: 'recorrenciaPai' });
Recorrencia.hasMany(AlertaPagamento, { foreignKey: 'id_recorrencia_pai', as: 'alertasGerados' });
// --- FIM DAS ASSOCIAÇÕES ---

// Hook para gerar código único (Deve já existir do passo anterior)
AlertaPagamento.beforeValidate(async (alerta, options) => {
  if (!alerta.codigo_unico) {
    let code;
    let existing = true;
    while(existing) {
      code = `ALT-${nanoid(7)}`; // Mantenha seu prefixo
      existing = await AlertaPagamento.findOne({ where: { codigo_unico: code } });
    }
    alerta.codigo_unico = code;
  }
});

module.exports = AlertaPagamento;