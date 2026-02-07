import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
dotenv.config();

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 修复 KYC 状态数据迁移脚本
 * 将所有非标准状态的用户统一处理
 */
async function fixKycStatus() {
  let connection = null;
  
  try {
    // 验证环境变量
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 环境变量未设置，请在 .env 文件中配置');
    }

    console.log('🔌 正在连接数据库...');
    
    // 连接数据库
    connection = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5秒超时
    });
    
    console.log('✅ 数据库连接成功');

    // 动态导入 User 模型
    console.log('📦 正在加载 User 模型...');
    
    // 计算 User 模型的相对路径
    const userModelPath = join(__dirname, '../modules/users/user.model.js');
    
    try {
      // 动态导入 User 模型
      const UserModule = await import(userModelPath);
      
      // 检查导出类型
      let User;
      if (UserModule.default) {
        User = UserModule.default;
      } else if (UserModule.User) {
        User = UserModule.User;
      } else {
        // 如果导出的是 mongoose 模型，尝试直接获取
        User = mongoose.models.User || UserModule;
      }
      
      if (!User) {
        // 如果还是找不到，尝试直接注册模型
        console.log('⚠️  未找到导出的 User 模型，尝试从 Schema 创建...');
        
        // 检查是否有 Schema
        if (UserModule.UserSchema) {
          User = mongoose.model('User', UserModule.UserSchema);
        } else if (UserModule.default?.schema) {
          User = mongoose.model('User', UserModule.default.schema);
        } else {
          // 最后尝试，如果没有找到合适的导出，我们可以直接操作集合
          console.log('⚠️  无法加载 User 模型，将直接操作集合...');
          
          // 直接操作集合的版本
          await fixWithCollection();
          return;
        }
      }
      
      await fixWithModel(User);
      
    } catch (importError) {
      console.error('❌ 加载 User 模型失败:', importError.message);
      console.log('⚠️  尝试直接操作集合...');
      await fixWithCollection();
    }
    
  } catch (error) {
    console.error('❌ 迁移失败：', error.message);
    console.error(error.stack);
    process.exit(1); // 退出码 1 表示错误
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('👋 数据库连接已关闭');
    }
  }
}

/**
 * 使用 User 模型进行修复
 */
async function fixWithModel(User) {
  console.log('🎯 开始修复 KYC 状态...');
  
  // 1. 查看当前 KYC 状态分布
  const stats = await User.aggregate([
    { 
      $group: { 
        _id: { 
          $ifNull: ['$kycStatus', 'null/empty'] 
        }, 
        count: { $sum: 1 } 
      } 
    },
    { $sort: { count: -1 } }
  ]);
  
  console.log('\n📊 当前 KYC 状态分布：');
  stats.forEach(stat => {
    console.log(`   - ${stat._id}: ${stat.count} 人`);
  });
  
  // 2. 修复各种状态
  const operations = [
    // 修复空值和 null
    {
      condition: { kycStatus: { $in: [null, '', undefined] } },
      update: { $set: { kycStatus: 'Unverified' } },
      description: '空值或 null 状态'
    },
    // 如果有其他非标准状态，可以继续添加
    // {
    //   condition: { kycStatus: 'some-invalid-status' },
    //   update: { $set: { kycStatus: 'Unverified' } },
    //   description: '无效状态修复'
    // }
  ];
  
  let totalFixed = 0;
  
  for (const op of operations) {
    const result = await User.updateMany(op.condition, op.update);
    if (result.modifiedCount > 0) {
      console.log(`\n✅ 修复了 ${result.modifiedCount} 个 ${op.description} 记录`);
      totalFixed += result.modifiedCount;
    }
  }
  
  // 3. 统计修复后的分布
  const newStats = await User.aggregate([
    { 
      $group: { 
        _id: { 
          $ifNull: ['$kycStatus', 'null/empty'] 
        }, 
        count: { $sum: 1 } 
      } 
    },
    { $sort: { count: -1 } }
  ]);
  
  console.log('\n📊 修复后的 KYC 状态分布：');
  newStats.forEach(stat => {
    console.log(`   - ${stat._id}: ${stat.count} 人`);
  });
  
  console.log(`\n🎉 迁移完成！总共修复了 ${totalFixed} 条记录`);
}

/**
 * 直接操作集合进行修复（备用方案）
 */
async function fixWithCollection() {
  console.log('🎯 开始直接操作集合修复 KYC 状态...');
  
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  
  if (!usersCollection) {
    throw new Error('无法找到 users 集合');
  }
  
  // 1. 查看当前 KYC 状态分布
  const stats = await usersCollection.aggregate([
    { 
      $group: { 
        _id: { 
          $ifNull: ['$kycStatus', 'null/empty'] 
        }, 
        count: { $sum: 1 } 
      } 
    },
    { $sort: { count: -1 } }
  ]).toArray();
  
  console.log('\n📊 当前 KYC 状态分布：');
  stats.forEach(stat => {
    console.log(`   - ${stat._id}: ${stat.count} 人`);
  });
  
  // 2. 修复空值和 null
  const nullResult = await usersCollection.updateMany(
    { 
      $or: [
        { kycStatus: { $exists: false } },
        { kycStatus: null },
        { kycStatus: '' },
        { kycStatus: { $type: 'undefined' } }
      ]
    },
    { $set: { kycStatus: 'Unverified' } }
  );
  
  console.log(`\n✅ 修复了 ${nullResult.modifiedCount} 个空值/缺失状态的记录`);
  
  // 3. 统计修复后的分布
  const newStats = await usersCollection.aggregate([
    { 
      $group: { 
        _id: { 
          $ifNull: ['$kycStatus', 'null/empty'] 
        }, 
        count: { $sum: 1 } 
      } 
    },
    { $sort: { count: -1 } }
  ]).toArray();
  
  console.log('\n📊 修复后的 KYC 状态分布：');
  newStats.forEach(stat => {
    console.log(`   - ${stat._id}: ${stat.count} 人`);
  });
  
  console.log(`\n🎉 迁移完成！总共修复了 ${nullResult.modifiedCount} 条记录`);
}

/**
 * 安全的主函数执行
 */
async function main() {
  try {
    await fixKycStatus();
    process.exit(0); // 成功退出
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1); // 失败退出
  }
}

// 执行脚本
main();