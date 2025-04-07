const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model'); // Importa o Model de Usuário

const AlertaPagamento = sequelize.define('AlertaPagamento', {
  id_alerta: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_alerta'
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
  valor: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  data_vencimento: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'data_vencimento'
  },
  descricao: {
    type: DataTypes.TEXT
  },
  codigo_unico: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'codigo_unico'
  },
  status: {
    type: DataTypes.ENUM('pendente', 'pago'),
    defaultValue: 'pendente'
  }
}, {
  tableName: 'Alertas_Pagamento',
  timestamps: false
});

// Define as associações (relacionamentos)
AlertaPagamento.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' }); // AlertaPagamento PERTENCE a um Usuario


module.exports = AlertaPagamento;