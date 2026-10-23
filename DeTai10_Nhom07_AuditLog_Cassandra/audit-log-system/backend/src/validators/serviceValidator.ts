import { z } from 'zod';

export const createServiceSchema = z.object({
  service_name: z
    .string({ required_error: 'service_name is required' })
    .min(2, 'service_name must have at least 2 characters')
    .max(50, 'service_name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'service_name must only contain alphanumeric characters, underscores, or hyphens')
    .trim(),
  description: z
    .string()
    .max(255, 'description cannot exceed 255 characters')
    .optional()
    .default(''),
  status: z.boolean().default(true),
});

export const updateServiceSchema = z.object({
  service_name: z
    .string()
    .min(2, 'service_name must have at least 2 characters')
    .max(50, 'service_name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'service_name must only contain alphanumeric characters, underscores, or hyphens')
    .trim()
    .optional(),
  description: z.string().max(255).optional(),
  status: z.boolean().optional(),
});
