INSERT INTO usuarios (nome,email,senha,setor,tipo)
VALUES
('Amauri Clementino','amauri@gmail.com','123456','DAEE','Administrador'),
('Sarah Silva','sarah@gmail.com','123456','Almoxarifado','solicitante');

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

