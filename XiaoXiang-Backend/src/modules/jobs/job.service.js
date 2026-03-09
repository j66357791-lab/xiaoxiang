// src/modules/jobs/job.service.js
import mongoose from 'mongoose';
import Job from './job.model.js';
import Category from '../categories/category.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class JobService {
  static async getAllJobs(query = {}) {
    console.log('[JobService] 🔍 查询回收商品列表...');
    const filter = { isPublished: true, isActive: true };

    // 兼容查询参数
    if (query.categoryL1 || query.category1) filter.categoryL1 = query.categoryL1 || query.category1;
    if (query.categoryL2 || query.category2) filter.categoryL2 = query.categoryL2 || query.category2;
    if (query.categoryL3 || query.category3) filter.categoryL3 = query.categoryL3 || query.category3;
    
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'active';
    }

    if (query.keyword) {
      filter.$or = [
        { title: { $regex: query.keyword, $options: 'i' } },
        { description: { $regex: query.keyword, $options: 'i' } },
      ];
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('categoryL1', 'name color icon')
        .populate('categoryL2', 'name color icon')
        .populate('categoryL3', 'name color icon')
        .populate('warehouse.id', 'name address phone')
        .sort({ sort: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter),
    ]);

    return {
      jobs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getJobById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('商品ID无效');
    }
    const job = await Job.findById(id)
      .populate('categoryL1', 'name color icon')
      .populate('categoryL2', 'name color icon')
      .populate('categoryL3', 'name color icon')
      .populate('warehouse.id', 'name address phone');
    if (!job) throw new NotFoundError('商品不存在');
    await Job.findByIdAndUpdate(id, { $inc: { 'stats.viewCount': 1 } });
    return job;
  }

  static async createJob(jobData) {
    console.log('[JobService] 📝 创建回收商品...');
    
    // 🔧 修复：兼容前端传来的字段名 (category1 -> categoryL1)
    const { 
      title, 
      subtitle, 
      content, // 前端传的是 content
      description,
      category1, category2, category3, // 前端传的是 category1/2/3
      categoryL1, categoryL2, categoryL3, // 也有可能直接传 L1/L2/L3
      attributes, 
      images, 
      coverImage, 
      pricing, 
      conditionPrices, 
      warehouse, 
      recycleConfig, 
      scheduledAt, 
      endAt, 
      authorId, 
      sort, 
      isActive,
      // 兼容旧字段
      steps,
      contentImages,
      amountLevels,
      totalSlots,
      deadlineHours,
      depositRequirement,
      kycRequired,
      isRepeatable,
      type
    } = jobData;

    if (!title) throw new BadRequestError('商品名称不能为空');

    // 🔧 优先使用 L1，如果没有则使用 category1
    const finalCat1 = categoryL1 || category1;
    const finalCat2 = categoryL2 || category2;
    const finalCat3 = categoryL3 || category3;

    if (!finalCat1) throw new BadRequestError('请选择商品分类');

    const cat1 = await Category.findById(finalCat1);
    if (!cat1) throw new BadRequestError('一级分类不存在');

    const now = new Date();
    let isPublished = true;
    let status = 'active';
    if (scheduledAt && new Date(scheduledAt) > now) {
      isPublished = false;
      status = 'draft';
    }

    const job = await Job.create({
      title: title.trim(),
      subtitle: subtitle?.trim(),
      // 🔧 优先使用 description，如果没有则使用 content
      description: (description || content)?.trim(),
      // 保存内容原文（兼容旧字段）
      content: content?.trim(),
      
      categoryL1: finalCat1 || null,
      categoryL2: finalCat2 || null,
      categoryL3: finalCat3 || null,
      
      attributes: attributes || [],
      images: images || [],
      coverImage: coverImage || (images?.[0] || null),
      pricing: {
        basePrice: pricing?.basePrice || 0,
        minPrice: pricing?.minPrice || 0,
        maxPrice: pricing?.maxPrice || 0,
        priceUnit: pricing?.priceUnit || '元',
      },
      conditionPrices: conditionPrices || [],
      warehouse: warehouse || {},
      recycleConfig: {
        enableRecycle: recycleConfig?.enableRecycle ?? true,
        enableTrade: recycleConfig?.enableTrade ?? false,
        estimatedDays: recycleConfig?.estimatedDays || 3,
        freeShipping: recycleConfig?.freeShipping ?? true,
        supportPickup: recycleConfig?.supportPickup ?? false,
        pickupRadius: recycleConfig?.pickupRadius || 10,
      },
      status,
      isPublished,
      isFrozen: false,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      endAt: endAt ? new Date(endAt) : null,
      author: authorId || null,
      sort: sort || 0,
      isActive: isActive ?? true,
      
      // 🆕 同步保存前端传来的旧字段，保证数据完整性
      steps: steps || [],
      contentImages: contentImages || [],
      amountLevels: amountLevels || [],
      totalSlots: totalSlots || 999,
      deadlineHours: deadlineHours || 24,
      depositRequirement: depositRequirement || 0,
      kycRequired: kycRequired || false,
      isRepeatable: isRepeatable || false,
      type: type || 'single',
      amount: pricing?.basePrice || 0,
      appliedCount: 0,
    });
    console.log('[JobService] ✅ 创建成功, ID:', job._id);
    return job;
  }

  static async updateJob(id, updateData) {
    console.log('[JobService] 📝 更新回收商品:', id);
    const job = await Job.findById(id);
    if (!job) throw new NotFoundError('商品不存在');

    // 🔧 处理字段映射
    const updateFields = { ...updateData };
    
    // 如果传的是 category1，映射为 categoryL1
    if (updateFields.category1) updateFields.categoryL1 = updateFields.category1;
    if (updateFields.category2) updateFields.categoryL2 = updateFields.category2;
    if (updateFields.category3) updateFields.categoryL3 = updateFields.category3;
    
    // 如果传的是 content，映射为 description
    if (updateFields.content && !updateFields.description) {
        updateFields.description = updateFields.content;
    }

    const allowedFields = [
      'title', 'subtitle', 'description', 'content',
      'categoryL1', 'categoryL2', 'categoryL3',
      'attributes', 'images', 'coverImage',
      'pricing', 'conditionPrices', 'warehouse', 'recycleConfig',
      'status', 'isFrozen', 'isPublished', 'scheduledAt', 'endAt', 'sort', 'isActive',
      // 允许更新旧字段
      'steps', 'contentImages', 'amountLevels', 'totalSlots', 'deadlineHours', 'depositRequirement', 'kycRequired', 'isRepeatable'
    ];

    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        if (field === 'pricing') {
          job.pricing = { ...job.pricing.toObject(), ...updateFields.pricing };
        } else if (field === 'recycleConfig') {
          job.recycleConfig = { ...job.recycleConfig.toObject(), ...updateFields.recycleConfig };
        } else if (field === 'warehouse') {
          job.warehouse = { ...job.warehouse.toObject(), ...updateFields.warehouse };
        } else if (field === 'scheduledAt' || field === 'endAt') {
          job[field] = updateFields[field] ? new Date(updateFields[field]) : null;
        } else {
          job[field] = updateFields[field];
        }
      }
    }

    if (updateFields.pricing?.basePrice !== undefined) {
      job.amount = updateFields.pricing.basePrice;
    }
    
    await job.save();
    console.log('[JobService] ✅ 更新成功');
    return job;
  }

  static async deleteJob(id) {
    const job = await Job.findById(id);
    if (!job) throw new NotFoundError('商品不存在');
    await Job.findByIdAndDelete(id);
    console.log('[JobService] 🗑️ 删除成功:', job.title);
    return job;
  }

  static async toggleFreeze(id, isFrozen) {
    const job = await Job.findById(id);
    if (!job) throw new NotFoundError('商品不存在');
    job.isFrozen = isFrozen !== undefined ? isFrozen : !job.isFrozen;
    if (job.isFrozen) {
      job.status = 'paused';
    } else {
      job.status = 'active';
    }
    await job.save();
    return job;
  }

  static async getJobsByCategory(categoryId, limit = 10) {
    return await Job.find({
      $or: [
        { categoryL1: categoryId },
        { categoryL2: categoryId },
        { categoryL3: categoryId },
      ],
      status: 'active',
      isPublished: true,
      isActive: true,
    })
      .sort({ sort: 1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  static async incrementRecycleCount(jobId) {
    await Job.findByIdAndUpdate(jobId, {
      $inc: { 'stats.recycleCount': 1, appliedCount: 1 },
    });
  }

  static async checkExpired() {
    return await Job.checkExpired();
  }
}
