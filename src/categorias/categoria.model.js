const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Categoria = sequelize.define('Categoria', {
  id_categoria: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_categoria'
  },
  nome_categoria: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'nome_categoria'
  }
}, {
  tableName: 'Categorias',
  timestamps: false
});

module.exports = Categoria;