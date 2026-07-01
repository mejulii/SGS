const express = require('express');
const exphbs = require('express-handlebars');
const sequelize = require('./config/bd');
const Usuario = require('./model/usuario.model');
const Solicitacao = require('./model/solicitacao.model');

const app = express();

app.engine('handlebars', exphbs.engine({
    defaultLayout: false,
    helpers: {
        ifEquals: function (a, b, options) {
            return a == b ? options.fn(this) : options.inverse(this);
        }
    }
}));
app.set('view engine', 'handlebars');

app.use(express.urlencoded({ extended: true }));

// HOME
app.get('/', (req, res) => {
    res.render('home');
});

// LISTAR USUÁRIOS
app.get('/usuarios', async (req, res) => {
    const usuarios = await Usuario.findAll({ raw: true });
    res.render('listarUsuarios', { usuarios });
});

// FORMULÁRIO CADASTRAR
app.get('/usuarios/cadastrar', (req, res) => {
    res.render('cadastrarUsuario');
});

// SALVAR NOVO USUÁRIO
app.post('/usuarios', async (req, res) => {
    const { nome, email, setor, tipo } = req.body;
    await Usuario.create({ nome, email, setor, tipo });
    res.redirect('/usuarios');
});

// FORMULÁRIO EDITAR
app.get('/usuarios/:id/editar', async (req, res) => {
    const id = req.params.id;
    const usuario = await Usuario.findByPk(id, { raw: true });
    res.render('editarUsuario', { usuario });
});

// SALVAR EDIÇÃO
app.post('/usuarios/:id/editar', async (req, res) => {
    const id = req.params.id;
    const { nome, email, setor, tipo } = req.body;
    const usuario = await Usuario.findByPk(id);
    usuario.nome = nome;
    usuario.email = email;
    usuario.setor = setor;
    usuario.tipo = tipo;
    await usuario.save();
    res.redirect('/usuarios');
});

// EXCLUIR
app.get('/usuarios/:id/excluir', async (req, res) => {
    const id = req.params.id;
    const usuario = await Usuario.findByPk(id);
    await usuario.destroy();
    res.redirect('/usuarios');
});

// ===================== SOLICITAÇÕES =====================

// LISTAR SOLICITAÇÕES
app.get('/solicitacoes', async (req, res) => {
    const solicitacoesRaw = await Solicitacao.findAll({ include: Usuario });
    const solicitacoes = solicitacoesRaw.map(s => s.toJSON());
    res.render('listarSolicitacoes', { solicitacoes });
});

// FORMULÁRIO CADASTRAR
app.get('/solicitacoes/cadastrar', async (req, res) => {
    const usuarios = await Usuario.findAll({ where: { tipo: 'solicitante' }, raw: true });
    res.render('cadastrarSolicitacao', { usuarios });
});

// SALVAR NOVA SOLICITAÇÃO
app.post('/solicitacoes', async (req, res) => {
    const { titulo, descricao, usuarioId, prioridade } = req.body;
    await Solicitacao.create({ titulo, descricao, usuarioId, prioridade, status: 'pendente' });
    res.redirect('/solicitacoes');
});

// FORMULÁRIO EDITAR
app.get('/solicitacoes/:id/editar', async (req, res) => {
    const id = req.params.id;
    const solicitacao = await Solicitacao.findByPk(id, { raw: true });
    const usuarios = await Usuario.findAll({ where: { tipo: 'solicitante' }, raw: true });
    res.render('editarSolicitacao', { solicitacao, usuarios });
});

// SALVAR EDIÇÃO
app.post('/solicitacoes/:id/editar', async (req, res) => {
    const id = req.params.id;
    const { titulo, descricao, usuarioId, prioridade } = req.body;
    const solicitacao = await Solicitacao.findByPk(id);
    solicitacao.titulo = titulo;
    solicitacao.descricao = descricao;
    solicitacao.usuarioId = usuarioId;
    solicitacao.prioridade = prioridade;
    await solicitacao.save();
    res.redirect('/solicitacoes');
});

// EXCLUIR
app.get('/solicitacoes/:id/excluir', async (req, res) => {
    const id = req.params.id;
    const solicitacao = await Solicitacao.findByPk(id);
    await solicitacao.destroy();
    res.redirect('/solicitacoes');
});

// ===================== APROVAÇÃO / REJEIÇÃO =====================

// LISTAR SOLICITAÇÕES PENDENTES PARA APROVAÇÃO
app.get('/solicitacoes/aprovacao', async (req, res) => {
    const solicitacoesRaw = await Solicitacao.findAll({
        where: { status: 'pendente' },
        include: Usuario
    });
    const solicitacoes = solicitacoesRaw.map(s => s.toJSON());
    res.render('aprovarSolicitacoes', { solicitacoes });
});

// APROVAR SOLICITAÇÃO
app.post('/solicitacoes/:id/aprovar', async (req, res) => {
    const id = req.params.id;
    const solicitacao = await Solicitacao.findByPk(id);
    solicitacao.status = 'aprovada';
    solicitacao.motivoRejeicao = null;
    await solicitacao.save();
    res.redirect('/solicitacoes/aprovacao');
});

// REJEITAR SOLICITAÇÃO
app.post('/solicitacoes/:id/rejeitar', async (req, res) => {
    const id = req.params.id;
    const { motivoRejeicao } = req.body;
    const solicitacao = await Solicitacao.findByPk(id);
    solicitacao.status = 'rejeitada';
    solicitacao.motivoRejeicao = motivoRejeicao;
    await solicitacao.save();
    res.redirect('/solicitacoes/aprovacao');
});

async function iniciar() {
    await sequelize.sync();
    console.log('Banco de dados conectado!');
    app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));
}

iniciar();

