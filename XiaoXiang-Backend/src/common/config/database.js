import mongoose from 'mongoose';

/**
 * 数据库连接配置
 */
export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI ||
                    process.env.MONGO_URL ||
                    'mongodb+srv://j66357791_db_user:hjh628727@cluster0.oiwbvje.mongodb.net/invest-v5?retryWrites=true&w=majority';

    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    console.log('⏳ 正在连接数据库...');

    await mongoose.connect(mongoUri, options);

    console.log('✅ 数据库连接成功');
    console.log(`   - 数据库名称: ${mongoose.connection.db?.databaseName || '未知'}`);
    console.log(`   - 主机: ${mongoose.connection.host || '未知'}`);

    // 监听连接事件
    mongoose.connection.on('error', (err) => {
      console.error('❌ 数据库连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  数据库连接断开');
    });

  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  }
};
