import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import cassandra from 'cassandra-driver';

export class AppError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Zod Validation Errors -> 400 Bad Request
  if (err instanceof ZodError) {
    const errorDetails = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: errorDetails[0]?.message || 'Invalid input data',
      details: errorDetails,
    });
    return;
  }

  // 2. Invalid UUID errors -> 400 Bad Request
  if (err instanceof TypeError && err.message?.includes('valid uuid')) {
    res.status(400).json({
      success: false,
      message: 'Invalid UUID format',
      error: err.message,
    });
    return;
  }

  // 3. Cassandra Connection / Network / Timeout Errors -> 503 Service Unavailable
  const isCassandraConnectionError =
    err instanceof cassandra.errors.NoHostAvailableError ||
    err instanceof cassandra.errors.OperationTimedOutError ||
    err.name === 'NoHostAvailableError' ||
    err.name === 'OperationTimedOutError' ||
    err.name === 'BusyConnectionError' ||
    (err instanceof cassandra.errors.ResponseError && [0x1000, 0x1100, 0x1200, 0x1300, 0x1500].includes(err.code)) ||
    err.message?.includes('No host could be accessed') ||
    err.message?.includes('All host(s) tried for query failed') ||
    err.message?.includes('Connection was closed') ||
    err.message?.includes('Socket was closed') ||
    err.message?.includes('ECONNREFUSED');

  if (isCassandraConnectionError) {
    console.error('[Database Unavailable]:', err.message);
    res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable',
      error: 'Cannot establish connection to Apache Cassandra cluster',
    });
    return;
  }

  // 4. Known Application Errors (AppError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.details || err.message,
    });
    return;
  }

  // 5. Default Internal Server Error -> 500
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message || 'An unexpected error occurred',
  });
}
