import { z } from 'zod';
import { containsSensitiveData } from '../utils/sensitiveDataFilter.js';

// Allowed audit levels per specification
export const ALLOWED_LEVELS = ['INFO', 'WARN', 'ERROR'] as const;
export type AuditLevel = (typeof ALLOWED_LEVELS)[number];

// Allowed actions per service
export const ALLOWED_ACTIONS: Record<string, string[]> = {
  Auth: ['LOGIN', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'RESET_PASSWORD'],
  User: ['CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'VIEW_USER', 'CREATE_SERVICE', 'UPDATE_SERVICE', 'DELETE_SERVICE'],
  Order: ['CREATE_ORDER', 'UPDATE_ORDER', 'CANCEL_ORDER', 'DELETE_ORDER'],
  Payment: ['CREATE_PAYMENT', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REFUND'],
};

// UUID v1-v5 validation pattern
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// IPv4 / IPv6 regex
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^localhost$/;

// Zod schema for log creation
export const createLogSchema = z.object({
  service_name: z
    .string({ required_error: 'service_name is required' })
    .min(2, 'service_name must have at least 2 characters')
    .max(50, 'service_name cannot exceed 50 characters')
    .trim(),
  level: z.enum(ALLOWED_LEVELS, {
    errorMap: () => ({
      message: "level must be strictly one of: 'INFO', 'WARN', 'ERROR'. DEBUG, HIGH, LOW are rejected.",
    }),
  }),
  action: z
    .string({ required_error: 'action is required' })
    .min(2, 'action must have at least 2 characters')
    .max(100, 'action cannot exceed 100 characters')
    .trim(),
  message: z
    .string({ required_error: 'message is required' })
    .min(1, 'message cannot be empty')
    .max(2000, 'message cannot exceed 2000 characters')
    .trim(),
  user_id: z.string().max(100).optional().nullable(),
  ip_address: z
    .string()
    .optional()
    .nullable()
    .refine(
      (ip) => !ip || IP_REGEX.test(ip),
      { message: 'ip_address must be a valid IPv4 or IPv6 address' }
    ),
  details: z.union([z.string(), z.record(z.any())]).optional().nullable(),
  ttl: z.number().int().positive().max(31536000).optional().nullable(),
  log_id: z.string().refine((id) => !id || isValidUuid(id), { message: 'log_id must be a valid UUID' }).optional().nullable(),
  log_time: z.union([z.string().datetime(), z.date()]).optional().nullable(),
}).superRefine((data, ctx) => {
  // Validate sensitive data in message
  const msgCheck = containsSensitiveData(data.message);
  if (msgCheck.hasSensitive) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['message'],
      message: msgCheck.reason || 'Forbidden sensitive data detected in message',
    });
  }

  // Validate sensitive data in details
  const detailsStr = typeof data.details === 'object' ? JSON.stringify(data.details) : data.details;
  const detailsCheck = containsSensitiveData(detailsStr);
  if (detailsCheck.hasSensitive) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['details'],
      message: detailsCheck.reason || 'Forbidden sensitive data detected in details',
    });
  }
});

// Zod schema for query filtering
export const queryLogSchema = z.object({
  service: z.string().optional(),
  level: z.enum(ALLOWED_LEVELS, {
    errorMap: () => ({
      message: "level must be strictly one of: 'INFO', 'WARN', 'ERROR'",
    }),
  }).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format').optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional(),
  from: z.string().optional(), // HH:mm or HH:mm:ss or ISO timestamp
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  page_state: z.string().optional().nullable(),
  cursor: z.string().optional().nullable(),
  pageState: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.from && data.to) {
    // If both are HH:mm or HH:mm:ss
    const isTimeOnly = /^\d{2}:\d{2}(:\d{2})?$/.test(data.from) && /^\d{2}:\d{2}(:\d{2})?$/.test(data.to);
    if (isTimeOnly) {
      if (data.from > data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['from'],
          message: "'from' time cannot be greater than 'to' time",
        });
      }
    } else {
      const fromMs = new Date(data.from).getTime();
      const toMs = new Date(data.to).getTime();
      if (!isNaN(fromMs) && !isNaN(toMs) && fromMs > toMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['from'],
          message: "'from' time cannot be greater than 'to' time",
        });
      }
    }
  }
});
