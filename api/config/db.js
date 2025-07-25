import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Atlas conectado');
  } catch (error) {
    console.error('❌ Error al conectar con MongoDB Atlas:', error);
    process.exit(1);
  }
};

export default connectDB;
