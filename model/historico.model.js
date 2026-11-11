const { DataTypes } = require('sequelize');
const sequelize = require('../config/bd');
const Solicitacao = require('./solicitacao.model');

const Historico = sequelize.define('Historico', {
    evento: {
        type: DataTypes.STRING,
    },

    descricao: {
        type: DataTypes.TEXT,
    },

    responsavel: {
        type: DataTypes.STRING,
    }
});

Historico.belongsTo(Solicitacao, {
    foreignKey: 'solicitacaoId',
    onDelete: 'CASCADE'
});

Solicitacao.hasMany(Historico, {
    foreignKey: 'solicitacaoId',
    onDelete: 'CASCADE'
});

module.exports = Historico;