SELECT * FROM usuarios;

SELECT * FROM solicitacoes;

SELECT
    solicitacoes.id,
    solicitacoes.titulo,
    solicitacoes.status,
    usuarios.nome
FROM solicitacoes
INNER JOIN usuarios
ON solicitacoes.usuarioId = usuarios.id;