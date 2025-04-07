// src/transacoes/transacao.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model');
const Categoria = require('../categorias/categoria.model');

const Transacao = sequelize.define('Transacao', {
    id_transacao: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_transacao'
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
    id_categoria: {
        type: DataTypes.INTEGER,
        field: 'id_categoria',
        references: {
            model: Categoria,
            key: 'id_categoria'
        }
    },
    data_transacao: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'data_transacao'
    },
    codigo_unico: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        field: 'codigo_unico'
    },
    descricao: {
        type: DataTypes.TEXT
    },
    comprovante_url: {
        type: DataTypes.STRING,
        field: 'comprovante_url'
    },
    id_transacao_pai: {
        type: DataTypes.INTEGER,
        field: 'id_transacao_pai'
    },
    parcela_numero: {
        type: DataTypes.INTEGER,
        field: 'parcela_numero'
    },
    total_parcelas: {
        type: DataTypes.INTEGER,
        field: 'total_parcelas'
    }
}, {
    tableName: 'Transacoes',
    timestamps: false
});

// Define as associações AFTER the Transacao model is defined
Transacao.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
Transacao.belongsTo(Categoria, { foreignKey: 'id_categoria', as: 'categoria' });
Transacao.belongsTo(Transacao, { foreignKey: 'id_transacao_pai', as: 'transacaoPai' }); // Self-association moved here

module.exports = Transacao;