const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'emoji'],
      default: 'text',
    },
    attachments: [
      {
        url: String,
        type: String,
        name: String,
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    readBy: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        readAt: Date,
      },
    ],
    reactions: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        emoji: String,
      },
    ],
  },
  { timestamps: true }
);

// Index for faster queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
