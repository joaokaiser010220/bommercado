const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Utilitário para obter o caminho do JSON por loja
const getJsonPath = (loja) => path.join(__dirname, 'data', `${loja}.json`);
const historicoPath = path.join(__dirname, 'data', 'historico.json');

// Rota para buscar produtos da loja
app.get('/api/produtos/:loja', (req, res) => {
  const loja = req.params.loja;
  const filePath = getJsonPath(loja);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ erro: 'Loja não encontrada' });
  }

  const dados = fs.readFileSync(filePath, 'utf8');
  res.json(JSON.parse(dados));
});

// Rota para cadastrar novo produto
app.post('/api/produtos/:loja', (req, res) => {
  const loja = req.params.loja;
  const { nome, validade, funcionario } = req.body;

  if (!nome || !validade || !funcionario) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  const filePath = getJsonPath(loja);
  const historico = fs.existsSync(historicoPath)
    ? JSON.parse(fs.readFileSync(historicoPath, 'utf8'))
    : [];

  const produtos = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : [];

  const nomeNormalizado = nome.toLowerCase().replace(/\s+/g, '');

  const jaExiste = produtos.some(p => 
    p.nome.toLowerCase().replace(/\s+/g, '') === nomeNormalizado
  );

  if (jaExiste) {
    return res.status(409).json({ erro: 'Produto já cadastrado' });
  }

  const novoProduto = { nome, validade };
  produtos.push(novoProduto);
  historico.push({
    nome,
    validade,
    funcionario,
    loja,
    data: new Date().toLocaleString('pt-BR')
  });

  fs.writeFileSync(filePath, JSON.stringify(produtos, null, 2));
  fs.writeFileSync(historicoPath, JSON.stringify(historico, null, 2));

  res.json({ mensagem: 'Produto cadastrado com sucesso!' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
