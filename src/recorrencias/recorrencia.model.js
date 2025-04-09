// src/recorrencias/recorrencia.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model');
// const Categoria = require('../categorias/categoria.model'); // REMOVIDO

const Recorrencia = sequelize.define('Recorrencia', {
  id_recorrencia: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_recorrencia'
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
  tipo: {
    type: DataTypes.ENUM('despesa', 'receita'),
    allowNull: false
  },
  valor: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  // id_categoria: { ... }, // REMOVIDO
  nome_categoria: { // ADICIONADO
    type: DataTypes.STRING, // Corresponde ao VARCHAR(255) adicionado no DB
    allowNull: true // Permite nulo
  },
  origem: {
    type: DataTypes.STRING // Para receitas recorrentes
  },
  data_inicio: {
    type: DataTypes.DATEONLY, // Mapeia para DATE
    allowNull: false,
    field: 'data_inicio'
  },
  frequencia: {
    type: DataTypes.ENUM('diaria', 'semanal', 'mensal', 'anual'),
    allowNull: false
  },
  dia_mes: {
    type: DataTypes.INTEGER,
    field: 'dia_mes'
  },
  dia_semana: {
    type: DataTypes.ENUM('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'),
    field: 'dia_semana' // Nome no DB pode ser diferente, verifique
  },
  intervalo: {
    type: DataTypes.INTEGER,
    defaultValue: 1 // Um intervalo padrão de 1 faz sentido
  },
  data_fim_recorrencia: {
    type: DataTypes.DATEONLY, // Mapeia para DATE
    field: 'data_fim_recorrencia'
  },
  descricao: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'recorrencias', // Corrigido para minúsculo
  timestamps: false
});

// Define as associações
Recorrencia.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
// Recorrencia.belongsTo(Categoria, { foreignKey: 'id_categoria', as: 'categoria' }); // REMOVIDO


module.exports = Recorrencia;