INSERT INTO usuarios (nome,email,setor,tipo)
VALUES
('João Silva','joao@email.com','TI','Administrador'),
('Maria Souza','maria@email.com','RH','Usuário');

INSERT INTO solicitacoes
(titulo,descricao,prioridade,status,motivoRejeicao,usuarioId)
VALUES
(
'Troca de notebook',
'Notebook apresenta defeito',
'Alta',
'pendente',
NULL,
1
);