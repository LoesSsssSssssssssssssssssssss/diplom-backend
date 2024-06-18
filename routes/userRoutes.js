const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Progress = require('../models/Progressbar');
const mongoose = require('mongoose');
require('dotenv').config();

// middleware для проверки авторизации пользователя
const isAuthenticated = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  const re = /^(?=.*\d).{4,}$/;
  return re.test(password);
};

const validateUsername = (username) => {
  const re = /^[А-Яа-яЁё\s]+$/;
  return re.test(username);
};

// Маршрут для получения активных и завершенных учебников
router.get('/books', isAuthenticated, async (req, res) => {
  try {
    const userId = req.userId;

    // Получаем прогресс пользователя
    const progressRecords = await Progress.find({ user: userId }).populate(
      'textbook'
    );

    const activeBooks = [];
    const completedBooks = [];

    progressRecords.forEach((progress) => {
      const completedTopics = progress.completedTopics.length;
      const totalTopics = progress.textbook.topics.length;

      if (totalTopics === 0) {
        console.error(`Textbook ${progress.textbook.title} has no topics`);
      }

      if (completedTopics === totalTopics) {
        completedBooks.push({
          id: progress.textbook._id,
          title: progress.textbook.title,
          description: progress.textbook.description,
          avatar: progress.textbook.avatar,
          totalTopics: totalTopics,
          completedTopics: completedTopics,
        });
      } else {
        activeBooks.push({
          id: progress.textbook._id,
          title: progress.textbook.title,
          description: progress.textbook.description,
          avatar: progress.textbook.avatar,
          totalTopics: totalTopics,
          completedTopics: completedTopics,
        });
      }
    });

    res.json({ activeBooks, completedBooks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/userAvatars/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage: storage });

// роут для получения профиля пользователя
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// роут для обновления профиля пользователя
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const { username, email, phone } = req.body;
    const updatedData = {};
    if (username) updatedData.username = username;
    if (email) updatedData.email = email;
    if (phone) updatedData.phone = phone;
    const updatedUser = await User.findByIdAndUpdate(req.userId, updatedData, {
      new: true,
    });
    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

//Добавление аватара пользователя
router.post(
  '/avatar',
  isAuthenticated,
  upload.single('avatar'),
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      user.avatar = req.file.path;
      await user.save();
      res.json({ message: 'Avatar uploaded successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

// Создает progress
router.post('/progress', isAuthenticated, async (req, res) => {
  const { textbook } = req.body;
  const userId = req.userId;

  try {
    // Проверяем, существует ли уже запись прогресса для данного пользователя и учебника
    const progress = await Progress.findOne({ user: userId, textbook });

    if (progress) {
      // Запись прогресса существует, возвращаем статус 200
      res.status(200).json({ message: 'Progress exists' });
    } else {
      // Запись прогресса не существует, создаем новую запись и возвращаем статус 201
      const newProgress = new Progress({
        user: userId,
        textbook,
      });
      await newProgress.save();
      res.status(201).json({ message: 'Progress created' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create or update progress' });
  }
});

//Если прогресс существует true
router.get('/progress/:userId/:textbookId', async (req, res) => {
  try {
    const { userId, textbookId } = req.params;
    const progress = await Progress.findOne({
      user: userId,
      textbook: textbookId,
    });

    if (progress) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Возвращает progress
router.get('/progressbook/:userId/:textbookId', async (req, res) => {
  const userId = req.params.userId;
  const textbookId = req.params.textbookId;

  try {
    const progress = await Progress.findOne({
      user: userId,
      textbook: textbookId,
    });

    if (!progress) {
      return res.status(200).json({ completedTopics: [] });
    }

    res.status(200).json({ completedTopics: progress.completedTopics });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//Добавляет пройденную тему в progress
router.post(
  '/increaseProgress/:userId/:textbookId',
  isAuthenticated,
  async (req, res) => {
    const userId = req.params.userId;
    const textbookId = req.params.textbookId;
    const topicId = req.body.topicId;

    try {
      let progress = await Progress.findOne({
        user: userId,
        textbook: textbookId,
      });

      if (!progress) {
        progress = new Progress({
          user: userId,
          textbook: textbookId,
          completedTopics: [topicId],
        });
      } else {
        if (progress.completedTopics.includes(topicId)) {
          return res.status(204).send();
        }

        progress.completedTopics.push(topicId);
      }

      await progress.save();

      res.status(200).json({ message: 'Progress increased successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to increase progress' });
    }
  }
);

// Регистрация пользователя
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body;

    if (!validateUsername(username)) {
      return res
        .status(400)
        .json({ error: 'Имя может содержать только кириллицу и пробелы' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Некорректный формат почты' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error:
          'Пароль должен быть минимум 4 символа и содержать хотя бы одну цифру',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'Пользователь с такой почтой уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, email, role });
    await user.save();
    res.status(201).json({ message: 'Пользователь зарегестрирован' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Эндпоинт для получения имени пользователя по userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ username: user.username, avatar: user.avatar });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch username' });
  }
});

// Авторизация пользователя
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY);
    res.json({ token, username: user.username, avatar: user.avatar });
  } catch (error) {
    res.status(500).json({ error: 'Авторизация не удалась' });
  }
});

module.exports = router;
