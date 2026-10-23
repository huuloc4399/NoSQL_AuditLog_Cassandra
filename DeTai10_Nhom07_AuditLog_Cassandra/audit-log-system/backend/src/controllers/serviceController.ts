import { Request, Response, NextFunction } from 'express';
import { serviceCatalogService } from '../services/serviceCatalogService.js';
import { createServiceSchema, updateServiceSchema } from '../validators/serviceValidator.js';
import { mutationAudit } from '../utils/mutationAudit.js';
import { isValidUuid } from '../validators/auditLogValidator.js';
import { AppError } from '../middleware/errorHandler.js';

export class ServiceController {
  /**
   * GET /api/services - Retrieve all services
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
   * GET /api/services/:id - Retrieve single service
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
   * POST /api/services - Register a new service
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
   * PUT /api/services/:id - Update service
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
   * DELETE /api/services/:id - Delete service
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
