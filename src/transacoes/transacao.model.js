// src/transacoes/transacao.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model');
// const Categoria = require('../categorias/categoria.model'); // REMOVIDO

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
        type: DataTypes.ENUM('despesa', 'receita'), // No seu DB real, o tipo é 'tipo_transacao', ajuste se necessário
        allowNull: false
    },
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    // id_categoria: { ... }, // REMOVIDO
    nome_categoria: { // ADICIONADO
        type: DataTypes.STRING, // Corresponde ao VARCHAR(255) adicionado no DB
        allowNull: true // Permite nulo (ex: para receitas)
    },
    data_transacao: {
        // type: DataTypes.DATE, // Seu DB usa DATE, não TIMESTAMP
        type: DataTypes.DATEONLY, // Melhor usar DATEONLY para mapear para DATE do SQL
        // defaultValue: DataTypes.NOW, // Default no DB já é CURRENT_DATE, pode remover
        allowNull: false, // Mantido conforme DB
        field: 'data_transacao'
    },
    codigo_unico: {
        // type: DataTypes.STRING, // VARCHAR(50) no DB
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true, // MUDADO PARA TRUE - Você pode remover a geração no N8N se não precisar
        field: 'codigo_unico'
    },
    descricao: {
        type: DataTypes.TEXT
    },
    comprovante_url: {
        // type: DataTypes.STRING, // VARCHAR(255) no DB
        type: DataTypes.STRING(255),
        field: 'comprovante_url'
    },
    id_transacao_pai: {
        type: DataTypes.INTEGER,
        field: 'id_transacao_pai',
        references: { // Adicionado para clareza, embora já exista no DB
            model: 'Transacao', // Referencia a própria tabela
            key: 'id_transacao'
        }
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
    tableName: 'transacoes', // Corrigido para minúsculo conforme seu DB
    timestamps: false
});

// Define as associações
Transacao.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
// Transacao.belongsTo(Categoria, { foreignKey: 'id_categoria', as: 'categoria' }); // REMOVIDO
Transacao.belongsTo(Transacao, { foreignKey: 'id_transacao_pai', as: 'transacaoPai' });

module.exports = Transacao;