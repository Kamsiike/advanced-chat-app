const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    conversationType: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
    },
    groupName: {
      type: String,
      default: null,
    },
    groupIcon: {
      type: String,
      default: null,
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    description: {
      type: String,
      maxlength: 300,
      default: '',
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// Index for faster queries
ConversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
