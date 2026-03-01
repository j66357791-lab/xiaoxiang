import { success, paginated } from '../../common/utils/response.js';
import { AssetService } from './asset.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class AssetController {
  /**
   * 获取资产列表
   * GET /api/assets
   */
  static getAssets = asyncHandler(async (req, res) => {
    const result = await AssetService.getAssets(req.query);
    return paginated(res, result.assets, result);
  });

  /**
   * 获取单个资产详情
   * GET /api/assets/:id
   */
  static getAssetById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const asset = await Asset.findById(id)
      .populate('userId', 'profile.name email')
      .populate('orderId', 'orderNumber status');
    if (!asset) return res.status(404).json({ success: false, message: '资产不存在' });
    return success(res, asset);
  });

  /**
   * 资产处置 (售卖/结算/完结)
   * PUT /api/assets/:id/dispose
   */
  static disposeAsset = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const adminId = req.user._id;
    
    const asset = await AssetService.updateDisposal(id, data, adminId);
    return success(res, asset, '处置成功');
  });
}
