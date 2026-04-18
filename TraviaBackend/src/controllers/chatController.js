const { getIo } = require("../socket");
const {
  getRideChatMessages,
  createRideChatMessage,
} = require("../services/chatService");

const getMessages = async (req, res) => {
  try {
    const { rideId } = req.params;
    const messages = await getRideChatMessages(rideId);
    res.json({ data: messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { content, clientMessageId } = req.body;
    const senderId = req.user.id;
    const payload = await createRideChatMessage({
      rideId,
      content,
      senderId,
      clientMessageId,
    });

    getIo().to(`ride_${rideId}`).emit("new_message", payload);

    res.status(201).json({ data: payload });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("SendMessage Error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
};

module.exports = { getMessages, sendMessage };
