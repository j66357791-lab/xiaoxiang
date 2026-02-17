import { success } from '../../common/utils/response.js';
import { TaskTypeService } from './taskType.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class TaskTypeController {
  static getAllTaskTypes = asyncHandler(async (req, res) => {
    const taskTypes = await TaskTypeService.getAllTaskTypes();
    return success(res, taskTypes);
  });

  static createTaskType = asyncHandler(async (req, res) => {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '类型名称不能为空'
      });
    }

    const taskType = await TaskTypeService.createTaskType(name, color);
    return success(res, taskType, '创建成功', 201);
  });

  static deleteTaskType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await TaskTypeService.deleteTaskType(id);
    return success(res, null, '删除成功');
  });
}
