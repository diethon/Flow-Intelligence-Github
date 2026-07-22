const mongoose = require('mongoose');
const { ChatService } = require('./dist/services/ChatService.js');
require('dotenv').config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const repoId = new mongoose.Types.ObjectId().toString(); // dummy
    const res = await ChatService.generateChatResponse(repoId, "Hello", []);
    console.log(res);
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}
test();
