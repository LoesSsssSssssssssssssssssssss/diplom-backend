const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  textbook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Textbook',
    required: true,
  },
  completedTopics: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Textbook.topics',
    },
  ],
});

const Progress = mongoose.model('Progress', progressSchema);

module.exports = Progress;
