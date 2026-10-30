/**
 * [BAREM 2, 4] CRUD danh mục dịch vụ trên web và tự phát sinh nhật ký.
 * CREATE_SERVICE, UPDATE_SERVICE, DELETE_SERVICE được ghi dưới nhóm service_name=User.
 * Demo: thao tác một dịch vụ thử, SELECT services và audit_logs của User cùng ngày UTC.
 * Chỉ xóa dịch vụ thử; không cần xóa các nhóm chuẩn Auth/User/Order/Payment để trình diễn.
 */
import { Request, Response, NextFunction } from 'express';
import { serviceCatalogService } from '../services/serviceCatalogService.js';
import { createServiceSchema, updateServiceSchema } from '../validators/serviceValidator.js';
import { mutationAudit } from '../utils/mutationAudit.js';
import { isValidUuid } from '../validators/auditLogValidator.js';
import { AppError } from '../middleware/errorHandler.js';

export class ServiceController {
  /**
   * Đọc danh mục dịch vụ hiện có trong Cassandra.
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const services = await serviceCatalogService.getAllServices();
      res.status(200).json({
        success: true,
        message: 'Services retrieved successfully',
        data: services,
        count: services.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Đọc một dịch vụ theo UUID; UUID sai nhận 400, không có dữ liệu nhận 404.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceId = String(req.params.id);
      if (!isValidUuid(serviceId)) {
        throw new AppError(`Invalid UUID format for service_id: '${serviceId}'`, 400);
      }

      const service = await serviceCatalogService.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({
          success: false,
          message: 'Service not found',
          error: `No service found with ID ${serviceId}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Service retrieved successfully',
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [BAREM 2] Thêm dịch vụ; mutationAudit lấy actor từ phiên và gắn CREATE_SERVICE.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createServiceSchema.parse(req.body);
      const created = await serviceCatalogService.createService(validatedData, mutationAudit(req, 'User', 'CREATE_SERVICE'));


      res.status(201).json({
        success: true,
        message: 'Service created successfully',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [BAREM 2] Sửa tên/mô tả/trạng thái; gắn UPDATE_SERVICE để truy vết thay đổi.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceId = String(req.params.id);
      if (!isValidUuid(serviceId)) {
        throw new AppError(`Invalid UUID format for service_id: '${serviceId}'`, 400);
      }

      const validatedData = updateServiceSchema.parse(req.body);
      const updated = await serviceCatalogService.updateService(serviceId, validatedData, mutationAudit(req, 'User', 'UPDATE_SERVICE'));


      res.status(200).json({
        success: true,
        message: 'Service updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [BAREM 2] Xóa dịch vụ và ghi DELETE_SERVICE mức WARN; không xóa lịch sử audit.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceId = String(req.params.id);
      if (!isValidUuid(serviceId)) {
        throw new AppError(`Invalid UUID format for service_id: '${serviceId}'`, 400);
      }


      await serviceCatalogService.deleteService(serviceId, mutationAudit(req, 'User', 'DELETE_SERVICE', {}, 'WARN'));


      res.status(200).json({
        success: true,
        message: 'Service deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const serviceController = new ServiceController();
