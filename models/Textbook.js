const mongoose = require('mongoose');

const textbookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  topics: [
    {
      title: {
        type: String,
      },
      content: {
        type: String,
      },
    },
  ],
  avatar: {
    type: String,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  isVisible: {
    type: Boolean,
    default: false,
  },
  ratings: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
    },
  ],
});

const Textbook = mongoose.model('Textbook', textbookSchema);

module.exports = Textbook;
