import TaskType from './taskType.model.js';
import { NotFoundError, ConflictError } from '../../common/utils/error.js';

export class TaskTypeService {
  /**
   * 获取所有任务类型
   */
  static async getAllTaskTypes() {
    return await TaskType.find().sort({ createdAt: -1 });
  }

  /**
   * 创建任务类型
   */
  static async createTaskType(name, color) {
    const existing = await TaskType.findOne({ name });
    if (existing) throw new ConflictError('任务类型已存在');

    const taskType = await TaskType.create({ name, color: color || '#FF9800' });
    return taskType;
  }

  /**
   * 删除任务类型
   */
  static async deleteTaskType(id) {
    const taskType = await TaskType.findById(id);
    if (!taskType) throw new NotFoundError('任务类型不存在');

    await TaskType.findByIdAndDelete(id);
    return taskType;
  }
}
