// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Caminho do arquivo produtos.json
const produtosFile = path.join(__dirname, 'produtos.json');

// Middleware para servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static('public'));
app.use(bodyParser.json());

// ===== Rota para listar produtos =====
app.get('/produtos', (req, res) => {
  fs.readFile(produtosFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Erro ao ler produtos.json:', err);
      return res.status(500).json({ error: 'Erro ao ler produtos' });
    }
    const produtos = data ? JSON.parse(data) : [];
    res.json(produtos);
  });
});

// ===== Rota para adicionar produto =====
app.post('/produtos', (req, res) => {
  const novoProduto = req.body;

  fs.readFile(produtosFile, 'utf8', (err, data) => {
    let produtos = [];
    if (!err && data) {
      produtos = JSON.parse(data);
    }

    produtos.push(novoProduto);

    fs.writeFile(produtosFile, JSON.stringify(produtos, null, 2), (err) => {
      if (err) {
        console.error('Erro ao salvar produto:', err);
        return res.status(500).json({ error: 'Erro ao salvar produto' });
      }
      res.json({ success: true, produto: novoProduto });
    });
  });
});

// ===== Iniciar servidor =====
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
