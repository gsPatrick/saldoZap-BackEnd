const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tag = sequelize.define('Tag', {
  id_tag: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_tag'
  },
  nome_tag: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'nome_tag'
  }
}, {
  tableName: 'Tags',
  timestamps: false
});

module.exports = Tag;