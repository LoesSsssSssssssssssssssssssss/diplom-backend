const express = require('express');
const router = express.Router();
const Textbook = require('../models/Textbook');
const Category = require('../models/Category');

// Получение всех учебников
router.get('/books', async (req, res) => {
  try {
    const textbooks = await Textbook.find();
    res.json(textbooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch textbooks' });
  }
});

// Получение одного учебника по ID
router.get('/books/:id', async (req, res) => {
  try {
    const textbook = await Textbook.findById(req.params.id);
    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }
    res.json(textbook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch textbook' });
  }
});

//получение категорий
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Получение темы из учебника по индексу темы
router.get('/books/:id/topics/:topicIndex', async (req, res) => {
  try {
    const { id, topicIndex } = req.params;
    const textbook = await Textbook.findById(id);

    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }

    const topic = textbook.topics[topicIndex];

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.json(topic);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

module.exports = router;
