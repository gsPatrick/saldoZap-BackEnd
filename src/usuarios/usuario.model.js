const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Importa a instância Sequelize configurada

const Usuario = sequelize.define('Usuario', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_usuario' // Mapeamento para o nome da coluna no banco (se diferente do nome do atributo JS)
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false
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
  }
}, {
  tableName: 'Usuarios', // Nome da tabela no banco de dados (importante!)
  timestamps: false       // Desativa timestamps automáticos (createdAt, updatedAt) se não usar
});

module.exports = Usuario;