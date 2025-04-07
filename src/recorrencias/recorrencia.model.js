const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model'); // Importa o Model de Usuário
const Categoria = require('../categorias/categoria.model'); // Importa o Model de Categoria

const Recorrencia = sequelize.define('Recorrencia', {
  id_recorrencia: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_recorrencia'
  },
  id_usuario: { // Chave estrangeira para Usuarios
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'id_usuario',
    references: {
      model: Usuario, // Referencia o Model Usuario
      key: 'id_usuario' // Coluna chave na tabela Usuarios
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
  id_categoria: { // Chave estrangeira para Categorias (pode ser nulo para receitas)
    type: DataTypes.INTEGER,
    field: 'id_categoria',
    references: {
      model: Categoria, // Referencia o Model Categoria
      key: 'id_categoria' // Coluna chave na tabela Categorias
    }
  },
  origem: {
    type: DataTypes.STRING // Para receitas recorrentes
  },
  data_inicio: {
    type: DataTypes.DATE,
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
    field: 'dia_semana'
  },
  intervalo: {
    type: DataTypes.INTEGER
  },
  data_fim_recorrencia: {
    type: DataTypes.DATE,
    field: 'data_fim_recorrencia'
  },
  descricao: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'Recorrencias',
  timestamps: false
});

// Define as associações (relacionamentos)
Recorrencia.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' }); // Recorrencia PERTENCE a um Usuario
Recorrencia.belongsTo(Categoria, { foreignKey: 'id_categoria', as: 'categoria' }); // Recorrencia PERTENCE a uma Categoria (para despesas)


module.exports = Recorrencia;