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

// Utilitário para caminho dos JSONs salvos NA RAIZ
const getJsonPath = loja => path.join(__dirname, `${loja}.json`);

const historicoTemp = []; // histórico em memória

// Rota GET para exibir produtos da loja
app.get('/api/produtos/:loja', (req, res) => {
  const loja = req.params.loja;
  const filePath = getJsonPath(loja);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ erro: 'Loja não encontrada' });
  }

  const dados = fs.readFileSync(filePath, 'utf8');
  res.json(JSON.parse(dados));
});

// Rota GET para mostrar o histórico (temporário, não salvo em arquivo)
app.get('/api/historico', (req, res) => {
  res.json(historicoTemp.slice(-10).reverse()); // últimos 10 cadastros
});

// Rota POST para cadastrar um novo produto
app.post('/api/produtos/:loja', (req, res) => {
  const loja = req.params.loja;
  const filePath = getJsonPath(loja);
  const { nome, validade, funcionario } = req.body;

  if (!nome || !validade || !funcionario) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  const produtos = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : [];

  const nomeNormalizado = nome.toLowerCase().replace(/\s+/g, '');
  const duplicado = produtos.some(p => 
    p.nome.toLowerCase().replace(/\s+/g, '') === nomeNormalizado
  );

  if (duplicado) {
    return res.status(409).json({ erro: 'Produto já cadastrado!' });
  }

  const novoProduto = { nome, validade };
  produtos.push(novoProduto);
  fs.writeFileSync(filePath, JSON.stringify(produtos, null, 2));

  historicoTemp.push({
    nome,
    validade,
    funcionario,
    loja,
    horario: new Date().toLocaleString('pt-BR')
  });

  res.json({ mensagem: 'Produto cadastrado com sucesso!' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
