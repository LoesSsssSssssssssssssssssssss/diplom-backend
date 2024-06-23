const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Textbook = require('../models/Textbook');
const Progress = require('../models/Progressbar');
const Category = require('../models/Category');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const checkAdmin = (req, res, next) => {
  User.findById(req.user.userId)
    .then((user) => {
      if (user && user.role === 'admin') {
        next();
      } else {
        res.status(403).json({ error: 'Unauthorized access' });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    });
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/textbookAvatars/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({ storage: storage });

const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/categoryImages/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const uploadCategoryImage = multer({ storage: categoryStorage });

router.get('/check-role', authenticateUser, checkAdmin, (req, res) => {
  res.status(200).json({ isAdmin: true });
});

router.put(
  '/books/:textbookId/topics/reorder',
  authenticateUser,
  checkAdmin,
  async (req, res) => {
    const { textbookId } = req.params;
    const { topics } = req.body;

    try {
      const textbook = await Textbook.findById(textbookId);

      if (!textbook) {
        return res.status(404).json({ error: 'Textbook not found' });
      }

      textbook.topics = topics;

      await textbook.save();

      return res
        .status(200)
        .json({ message: 'Порядок тем успешно обновлен', textbook });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to reorder topics' });
    }
  }
);

router.patch(
  '/books/:id/visibility',
  authenticateUser,
  checkAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isVisible } = req.body;

      const textbook = await Textbook.findByIdAndUpdate(
        id,
        { isVisible },
        { new: true }
      );

      if (!textbook) {
        return res.status(404).json({ error: 'Textbook not found' });
      }

      res.json(textbook);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update textbook visibility' });
    }
  }
);

// Получение всех учебников
router.get('/books', async (req, res) => {
  try {
    const textbooks = await Textbook.find();
    res.json(textbooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch textbooks' });
  }
});

// Маршрут для добавления нового учебника
router.post('/add', authenticateUser, checkAdmin, async (req, res) => {
  const { title, description, category } = req.body;
  try {
    const newTextbook = new Textbook({
      title,
      description,
      category,
    });
    await newTextbook.save();
    res
      .status(201)
      .json({ message: 'Учебник успешно добавлен', textbook: newTextbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put(
  '/books/:textbookId/topics/:topicId',
  authenticateUser,
  checkAdmin,
  async (req, res) => {
    const { textbookId, topicId } = req.params;
    const { title, content } = req.body;

    try {
      const textbook = await Textbook.findById(textbookId);

      if (!textbook) {
        return res.status(404).json({ error: 'Textbook not found' });
      }

      const topic = textbook.topics.find(
        (topic) => topic._id.toString() === topicId.toString()
      );

      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      topic.title = title;
      topic.content = content;

      await textbook.save();

      return res
        .status(200)
        .json({ message: 'Тема успешно обновлена', textbook });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update topic' });
    }
  }
);

router.delete(
  '/books/:textbookId/topics/:topicId',
  authenticateUser,
  checkAdmin,
  async (req, res) => {
    const { textbookId, topicId } = req.params;

    try {
      const textbook = await Textbook.findById(textbookId);

      if (!textbook) {
        return res.status(404).json({ error: 'Textbook not found' });
      }

      const topicIndex = textbook.topics.findIndex(
        (topic) => topic._id.toString() === topicId.toString()
      );

      if (topicIndex === -1) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      textbook.topics.splice(topicIndex, 1);

      await textbook.save();

      // Удаление прогресса для этой темы у всех пользователей
      await Progress.updateMany(
        { textbook: textbookId },
        { $pull: { completedTopics: topicId } }
      );

      return res
        .status(200)
        .json({ message: 'Тема успешно удалена', textbook });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete topic' });
    }
  }
);

router.post('/:id/topics', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    const textbook = await Textbook.findById(id);

    if (!textbook) {
      return res.status(404).json({ error: 'Textbook not found' });
    }

    textbook.topics.push({ title, content });
    await textbook.save();

    res.status(201).json({ message: 'Тема успешно добавлена', textbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add topic to textbook' });
  }
});

// Получение всех зарег.пользователей
router.get('/users', authenticateUser, checkAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Изменение роли пользователя
router.put('/users/:id', authenticateUser, checkAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const user = await User.findByIdAndUpdate(id, { role }, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Удаление пользователя
router.delete('/users/:id', authenticateUser, checkAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Удаление учебника
router.delete('/books/:id', authenticateUser, checkAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Находим и удаляем учебник
    const deletedBook = await Textbook.findByIdAndDelete(id);

    if (!deletedBook) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Удаляем все записи о прогрессе, связанные с удаляемым учебником
    await Progress.deleteMany({ textbook: id });

    res.json({ message: 'Учебник удален' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: 'Failed to delete book and progress records' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: '1h' }
    );
    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновление картинки учебника
router.put(
  '/books/:id/avatar',
  authenticateUser,
  checkAdmin,
  upload.single('avatar'),
  async (req, res) => {
    const { id } = req.params;
    const { filename } = req.file;

    try {
      const textbook = await Textbook.findByIdAndUpdate(
        id,
        { avatar: `uploads/textbookAvatars/${filename}` },
        { new: true }
      );

      if (!textbook) {
        return res.status(404).json({ error: 'Textbook not found' });
      }

      res.json({ message: 'Аватар успешно добавлен', textbook });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update textbook avatar' });
    }
  }
);

router.post(
  '/categories',
  authenticateUser,
  checkAdmin,
  uploadCategoryImage.single('image'),
  async (req, res) => {
    const { name, description } = req.body;
    const image = `uploads/categoryImages/${req.file.filename}`;

    try {
      const newCategory = new Category({
        name,
        image,
        description,
      });

      await newCategory.save();

      res.status(201).json({
        message: 'Категория успешно добавлена',
        category: newCategory,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add category' });
    }
  }
);

module.exports = router;
