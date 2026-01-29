import mongoose from 'mongoose';
// 👇 注意：路径改成了 ./models/User.js (当前目录下的 models)
import User from '../model/User.js'; 

// 数据库连接字符串
const MONGO_URI = "mongodb+srv://j66357791_db_user:hjh628727@cluster0.oiwbvje.mongodb.net/invest-v5?retryWrites=true&w=majority";

const createAdmin = async () => {
  try {
    // 1. 连接数据库
    console.log('正在连接数据库...');
    await mongoose.connect(MONGO_URI);
    console.log('数据库连接成功...');

    const ACCOUNT = '18679012034@qq.com';
    const PASSWORD = '628727';

    // 2. 检查账号是否已存在
    const existingUser = await User.findOne({ email: ACCOUNT });

    if (existingUser) {
      console.log('用户已存在，正在更新为超级管理员...');
      existingUser.role = 'superAdmin';
      existingUser.name = '超级管理员';
      // 强制更新密码
      existingUser.password = PASSWORD; 
      await existingUser.save();
    } else {
      console.log('用户不存在，正在创建超级管理员...');
      // 创建新用户
      const adminUser = new User({
        email: ACCOUNT,
        password: PASSWORD, 
        role: 'superAdmin',
        name: '超级管理员',
        balance: 0,
        points: 0
      });

      await adminUser.save();
    }

    console.log('\n=================================================');
    console.log('✅ 超级管理员账号处理完成！');
    console.log(`📱 账号: ${ACCOUNT}`);
    console.log(`🔑 密码: ${PASSWORD}`);
    console.log(`🛡 身份: Super Admin`);
    console.log('=================================================\n');

  } catch (error) {
    console.error('❌ 创建失败，错误信息如下:');
    console.error(error);
  } finally {
    // 3. 关闭数据库连接
    mongoose.disconnect();
    console.log('数据库连接已关闭');
    process.exit(); // 退出进程
  }
};

// 执行创建函数
createAdmin();
