// src/modules/jobs/job.service.js

import mongoose from 'mongoose';
import Job from './job.model.js';
import Category from '../categories/category.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class JobService {
  
  static async getAllJobs(query = {}) {
    console.log('[JobService] 🔍 查询回收商品列表...');
    
    const filter = { isPublished: true, isActive: true };
    
    if (query.categoryL1) filter.categoryL1 = query.categoryL1;
    if (query.categoryL2) filter.categoryL2 = query.categoryL2;
    if (query.categoryL3) filter.categoryL3 = query.categoryL3;
    
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
    
    const {
      title, subtitle, description,
      categoryL1, categoryL2, categoryL3,
      attributes, images, coverImage,
      pricing, conditionPrices,
      warehouse, recycleConfig,
      scheduledAt, endAt,
      authorId, sort, isActive,
    } = jobData;
    
    if (!title) throw new BadRequestError('商品名称不能为空');
    if (!categoryL1) throw new BadRequestError('请选择商品分类');
    
    const cat1 = await Category.findById(categoryL1);
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
      description: description?.trim(),
      categoryL1: categoryL1 || null,
      categoryL2: categoryL2 || null,
      categoryL3: categoryL3 || null,
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
      amount: pricing?.basePrice || 0,
      totalSlots: 999,
      appliedCount: 0,
    });
    
    console.log('[JobService] ✅ 创建成功, ID:', job._id);
    return job;
  }
  
  static async updateJob(id, updateData) {
    console.log('[JobService] 📝 更新回收商品:', id);
    
    const job = await Job.findById(id);
    if (!job) throw new NotFoundError('商品不存在');
    
    const allowedFields = [
      'title', 'subtitle', 'description',
      'categoryL1', 'categoryL2', 'categoryL3',
      'attributes', 'images', 'coverImage',
      'pricing', 'conditionPrices',
      'warehouse', 'recycleConfig',
      'status', 'isFrozen', 'isPublished',
      'scheduledAt', 'endAt',
      'sort', 'isActive',
    ];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'pricing') {
          job.pricing = { ...job.pricing.toObject(), ...updateData.pricing };
        } else if (field === 'recycleConfig') {
          job.recycleConfig = { ...job.recycleConfig.toObject(), ...updateData.recycleConfig };
        } else if (field === 'warehouse') {
          job.warehouse = { ...job.warehouse.toObject(), ...updateData.warehouse };
        } else if (field === 'scheduledAt' || field === 'endAt') {
          job[field] = updateData[field] ? new Date(updateData[field]) : null;
        } else {
          job[field] = updateData[field];
        }
      }
    }
    
    if (updateData.pricing?.basePrice !== undefined) {
      job.amount = updateData.pricing.basePrice;
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
