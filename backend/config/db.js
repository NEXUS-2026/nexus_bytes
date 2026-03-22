const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is not set. Add your MongoDB Atlas URI in backend/.env",
    );
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || undefined,
  });

  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

module.exports = { connectDB, mongoose };
