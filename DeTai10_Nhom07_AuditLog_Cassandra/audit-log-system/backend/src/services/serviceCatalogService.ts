import { auditLogService, AuditLogInput } from './auditLogService.js';
import { getCassandraClient, cassandra } from '../config/cassandra.js';
import { AppError } from '../middleware/errorHandler.js';
import { isValidUuid } from '../validators/auditLogValidator.js';

export interface ServiceRecord {
  service_id: string;
  service_name: string;
  description: string;
  status: boolean;
  created_at: Date;
  updated_at: Date;
}

export class ServiceCatalogService {
  /**
   * Retrieve all registered services
   */
  async getAllServices(): Promise<ServiceRecord[]> {
    const client = getCassandraClient();
    const query = 'SELECT service_id, service_name, description, status, created_at, updated_at FROM audit_log_system.services';
    const result = await client.execute(query);
    
    return result.rows.map((row) => ({
      service_id: row.service_id.toString(),
      service_name: row.service_name,
      description: row.description || '',
      status: Boolean(row.status),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Get single service by UUID
   */
  async getServiceById(serviceId: string): Promise<ServiceRecord | null> {
    if (!isValidUuid(serviceId)) {
      throw new AppError(`Invalid UUID format for service_id: '${serviceId}'`, 400);
    }

    const client = getCassandraClient();
    const query = 'SELECT service_id, service_name, description, status, created_at, updated_at FROM audit_log_system.services WHERE service_id = ?';
    const result = await client.execute(query, [cassandra.types.Uuid.fromString(serviceId)], { prepare: true });
    
    const row = result.first();
    if (!row) return null;

    return {
      service_id: row.service_id.toString(),
      service_name: row.service_name,
      description: row.description || '',
      status: Boolean(row.status),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Get single service by name using secondary index
   */
  async getServiceByName(serviceName: string): Promise<ServiceRecord | null> {
    const client = getCassandraClient();
    const query = 'SELECT service_id, service_name, description, status, created_at, updated_at FROM audit_log_system.services WHERE service_name = ?';
    const result = await client.execute(query, [serviceName.trim()], { prepare: true });
    
    const row = result.first();
    if (!row) return null;

    return {
      service_id: row.service_id.toString(),
      service_name: row.service_name,
      description: row.description || '',
      status: Boolean(row.status),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Register a new service
   */
  async createService(data: { service_name: string; description?: string; status?: boolean }, audit?: AuditLogInput): Promise<ServiceRecord> {
    const trimmedName = data.service_name.trim();
    const existing = await this.getServiceByName(trimmedName);
    if (existing) {
      throw new AppError(`Service with name '${trimmedName}' already exists`, 409);
    }

    const client = getCassandraClient();
    const service_id = cassandra.types.Uuid.random();
    const now = new Date();
    const status = data.status !== undefined ? data.status : true;
    const description = (data.description || '').trim();

    const query = `
      INSERT INTO audit_log_system.services (
        service_id, service_name, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [service_id, trimmedName, description, status, now, now];
    if (audit) await auditLogService.createLog({ ...audit, details: { ...audit.details,
      service_id: service_id.toString(), service_name: trimmedName, status } }, [{ query, params }]);
    else await client.execute(query, params, { prepare: true });

    return {
      service_id: service_id.toString(),
      service_name: trimmedName,
      description,
      status,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Update an existing service
   */
  async updateService(
    serviceId: string,
    data: { service_name?: string; description?: string; status?: boolean },
    audit?: AuditLogInput
  ): Promise<ServiceRecord> {
    if (!isValidUuid(serviceId)) {
      throw new AppError(`Invalid UUID format for service_id: '${serviceId}'`, 400);
    }

    const existing = await this.getServiceById(serviceId);
    if (!existing) {
      throw new AppError(`Service with ID '${serviceId}' not found`, 404);
    }

    if (data.service_name) {
      const trimmedName = data.service_name.trim();
      if (trimmedName !== existing.service_name) {
        const nameConflict = await this.getServiceByName(trimmedName);
        if (nameConflict && nameConflict.service_id !== serviceId) {
          throw new AppError(`Service with name '${trimmedName}' already exists`, 409);
        }
      }
    }

    const client = getCassandraClient();
    const updatedServiceName = data.service_name ? data.service_name.trim() : existing.service_name;
    const updatedDescription = data.description !== undefined ? data.description.trim() : existing.description;
    const updatedStatus = data.status !== undefined ? data.status : existing.status;
    const now = new Date();

    const query = `
      UPDATE audit_log_system.services
      SET service_name = ?, description = ?, status = ?, updated_at = ?
      WHERE service_id = ?
    `;

    const params = [updatedServiceName, updatedDescription, updatedStatus, now, cassandra.types.Uuid.fromString(serviceId)];
    if (audit) await auditLogService.createLog({ ...audit, details: { ...audit.details,
      service_id: serviceId, service_name: updatedServiceName, status: updatedStatus } }, [{ query, params }]);
    else await client.execute(query, params, { prepare: true });

    return {
      service_id: serviceId,
      service_name: updatedServiceName,
      description: updatedDescription,
      status: updatedStatus,
      created_at: existing.created_at,
      updated_at: now,
    };
  }

  /**
   * Delete a service by ID
   */
  async deleteService(serviceId: string, audit?: AuditLogInput): Promise<void> {
    if (!isValidUuid(serviceId)) {
      throw new AppError(`Invalid UUID format for service_id: '${serviceId}'`, 400);
    }

    const existing = await this.getServiceById(serviceId);
    if (!existing) {
      throw new AppError(`Service with ID '${serviceId}' not found`, 404);
    }

    const client = getCassandraClient();
    const query = 'DELETE FROM audit_log_system.services WHERE service_id = ?';
    const params = [cassandra.types.Uuid.fromString(serviceId)];
    if (audit) await auditLogService.createLog({ ...audit, details: { ...audit.details,
      service_id: serviceId, service_name: existing.service_name } }, [{ query, params }]);
    else await client.execute(query, params, { prepare: true });
  }

  /**
   * Check if a service is active
   */
  async isServiceActive(serviceName: string): Promise<{ exists: boolean; active: boolean }> {
    const service = await this.getServiceByName(serviceName.trim());
    if (!service) {
      return { exists: false, active: false };
    }
    return { exists: true, active: service.status };
  }
}

export const serviceCatalogService = new ServiceCatalogService();
