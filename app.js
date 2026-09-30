const express = require('express');
const exphbs = require('express-handlebars');
const session = require('express-session');

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

app.use(express.static('public'));



app.use(session({
    secret: 'sgs-secret',
    resave: false,
    saveUninitialized: false
}));


function autenticado(req, res, next) {

    if (!req.session.usuario) {
        return res.redirect('/login');
    }

    next();
}


function somenteAdmin(req, res, next) {

    if (!req.session.usuario) {
        return res.redirect('/login');
    }

    if (req.session.usuario.tipo !== 'administrador') {
        return res.redirect('/');
    }

    next();
}


function somenteSolicitante(req, res, next) {

    if (!req.session.usuario) {
        return res.redirect('/login');
    }

    if (req.session.usuario.tipo !== 'solicitante') {
        return res.redirect('/');
    }

    next();
}

app.get('/login', (req, res) => {

    if (req.session.usuario) {
        return res.redirect('/');
    }

    res.render('login', {
        erro: null
    });
});


app.post('/login', async (req, res) => {

    const { email, senha } = req.body;

    const usuario = await Usuario.findOne({
        where: {
            email: email,
            senha: senha
        },
        raw: true
    });

    if (!usuario) {

        return res.render('login', {
            erro: 'E-mail ou senha incorretos.'
        });

    }

    req.session.usuario = usuario;

    res.redirect('/');
});



app.get('/logout', (req, res) => {

    req.session.destroy(() => {
        res.redirect('/login');
    });

});


app.get('/', autenticado, (req, res) => {

    if (req.session.usuario.tipo === 'Administrador') {

        return res.render('homeAdmin', {
            usuario: req.session.usuario
        });

    }

    res.render('homeSolicitante', {
        usuario: req.session.usuario
    });

});


// LISTAR USUÁRIOS

app.get('/usuarios', somenteAdmin, async (req, res) => {

    const usuarios = await Usuario.findAll({
        raw: true
    });

    res.render('listarUsuarios', {
        usuarios,
        usuario: req.session.usuario
    });

});


// FORMULÁRIO CADASTRAR

app.get('/usuarios/cadastrar', somenteAdmin, (req, res) => {

    res.render('cadastrarUsuario');

});


// SALVAR NOVO USUÁRIO

app.post('/usuarios', somenteAdmin, async (req, res) => {

    const {
        nome,
        email,
        senha,
        setor,
        tipo
    } = req.body;

    await Usuario.create({
        nome,
        email,
        senha,
        setor,
        tipo
    });

    res.redirect('/usuarios');

});


// FORMULÁRIO EDITAR

app.get('/usuarios/:id/editar', somenteAdmin, async (req, res) => {

    const id = req.params.id;

    const usuario = await Usuario.findByPk(id, {
        raw: true
    });

    res.render('editarUsuario', {
        usuario
    });

});


// SALVAR EDIÇÃO

app.post('/usuarios/:id/editar', somenteAdmin, async (req, res) => {

    const id = req.params.id;

    const {
        nome,
        email,
        senha,
        setor,
        tipo
    } = req.body;

    const usuario = await Usuario.findByPk(id);

    usuario.nome = nome;
    usuario.email = email;
    usuario.senha = senha;
    usuario.setor = setor;
    usuario.tipo = tipo;

    await usuario.save();

    res.redirect('/usuarios');

});


// EXCLUIR

app.get('/usuarios/:id/excluir', somenteAdmin, async (req, res) => {

    const id = req.params.id;

    const usuario = await Usuario.findByPk(id);

    if (usuario) {
        await usuario.destroy();
    }

    res.redirect('/usuarios');

});


// LISTAR SOLICITAÇÕES

app.get('/solicitacoes', autenticado, async (req, res) => {

    let where = {};

    // Solicitante vê somente as próprias solicitações

    if (req.session.usuario.tipo === 'solicitante') {

        where.usuarioId = req.session.usuario.id;

    }

    const solicitacoesRaw = await Solicitacao.findAll({
        where: where,
        include: Usuario
    });

    const solicitacoes = solicitacoesRaw.map(s => s.toJSON());

    res.render('listarSolicitacoes', {
        solicitacoes,
        isAdmin: req.session.usuario.tipo === 'administrador'
    });

});


// FORMULÁRIO CADASTRAR

app.get('/solicitacoes/cadastrar', somenteSolicitante, async (req, res) => {

    res.render('cadastrarSolicitacao', {
        usuario: req.session.usuario
    });

});


// SALVAR NOVA SOLICITAÇÃO

app.post('/solicitacoes', somenteSolicitante, async (req, res) => {

    const {
        titulo,
        descricao,
        prioridade
    } = req.body;

    await Solicitacao.create({

        titulo,
        descricao,
        prioridade,

        usuarioId: req.session.usuario.id,

        status: 'pendente',

        etapa: 'Aguardando análise'

    });

    res.redirect('/solicitacoes');

});


// FORMULÁRIO EDITAR

app.get('/solicitacoes/:id/editar', somenteSolicitante, async (req, res) => {

    const id = req.params.id;

    const solicitacao = await Solicitacao.findByPk(id, {
        raw: true
    });

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    // Só pode editar a própria solicitação

    if (solicitacao.usuarioId !== req.session.usuario.id) {
        return res.redirect('/solicitacoes');
    }

    // Só pode editar enquanto estiver pendente

    if (solicitacao.status !== 'pendente') {
        return res.redirect('/solicitacoes');
    }

    res.render('editarSolicitacao', {
        solicitacao
    });

});


// SALVAR EDIÇÃO

app.post('/solicitacoes/:id/editar', somenteSolicitante, async (req, res) => {

    const id = req.params.id;

    const {
        titulo,
        descricao,
        prioridade
    } = req.body;

    const solicitacao = await Solicitacao.findByPk(id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.usuarioId !== req.session.usuario.id) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.status !== 'pendente') {
        return res.redirect('/solicitacoes');
    }

    solicitacao.titulo = titulo;
    solicitacao.descricao = descricao;
    solicitacao.prioridade = prioridade;

    await solicitacao.save();

    res.redirect('/solicitacoes');

});


// EXCLUIR

app.get('/solicitacoes/:id/excluir', somenteSolicitante, async (req, res) => {

    const id = req.params.id;

    const solicitacao = await Solicitacao.findByPk(id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.usuarioId !== req.session.usuario.id) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.status !== 'pendente') {
        return res.redirect('/solicitacoes');
    }

    await solicitacao.destroy();

    res.redirect('/solicitacoes');

});


// TELA DE ACOMPANHAMENTO

app.get('/solicitacoes/:id/acompanhar', autenticado, async (req, res) => {

    const id = req.params.id;

    const solicitacaoRaw = await Solicitacao.findByPk(id, {
        include: Usuario
    });

    if (!solicitacaoRaw) {
        return res.redirect('/solicitacoes');
    }

    const solicitacao = solicitacaoRaw.toJSON();

    // Solicitante só pode acompanhar a própria solicitação

    if (
        req.session.usuario.tipo === 'solicitante' &&
        solicitacao.usuarioId !== req.session.usuario.id
    ) {

        return res.redirect('/solicitacoes');

    }

    res.render('acompanharSolicitacao', {
        solicitacao,
        isAdmin: req.session.usuario.tipo === 'administrador'
    });

});

// Somente administrador pode mudar a etapa

app.post('/solicitacoes/:id/etapa', somenteAdmin, async (req, res) => {

    const id = req.params.id;

    const {
        etapa
    } = req.body;

    const solicitacao = await Solicitacao.findByPk(id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    solicitacao.etapa = etapa;

    await solicitacao.save();

    res.redirect('/solicitacoes/' + id + '/acompanhar');

});


// LISTAR SOLICITAÇÕES PENDENTES

app.get('/solicitacoes/aprovacao', somenteAdmin, async (req, res) => {

    const solicitacoesRaw = await Solicitacao.findAll({
        where: {
            status: 'pendente'
        },
        include: Usuario
    });

    const solicitacoes = solicitacoesRaw.map(s => s.toJSON());

    res.render('aprovarSolicitacoes', {
        solicitacoes
    });

});


// APROVAR

app.post('/solicitacoes/:id/aprovar', somenteAdmin, async (req, res) => {

    const id = req.params.id;

    const solicitacao = await Solicitacao.findByPk(id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes/aprovacao');
    }

    solicitacao.status = 'aprovada';

    solicitacao.etapa = 'Em análise';

    solicitacao.motivoRejeicao = null;

    await solicitacao.save();

    res.redirect('/solicitacoes/aprovacao');

});


// REJEITAR

app.post('/solicitacoes/:id/rejeitar', somenteAdmin, async (req, res) => {

    const id = req.params.id;

    const {
        motivoRejeicao
    } = req.body;

    const solicitacao = await Solicitacao.findByPk(id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes/aprovacao');
    }

    solicitacao.status = 'rejeitada';

    solicitacao.etapa = 'Solicitação rejeitada';

    solicitacao.motivoRejeicao = motivoRejeicao;

    await solicitacao.save();

    res.redirect('/solicitacoes/aprovacao');

});

async function iniciar() {

    await sequelize.sync({
        alter: true
    });

    console.log('Banco de dados conectado!');

    app.listen(3000, () => {

        console.log(
            'Servidor rodando em http://localhost:3000'
        );

    });

}

iniciar();