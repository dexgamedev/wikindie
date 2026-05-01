import type { ErrorRequestHandler } from 'express'

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (message = 'Not found') => new AppError(404, message)

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error instanceof AppError ? error.status : 500
  const message = error instanceof Error ? error.message : 'Internal server error'
  if (status >= 500) console.error(error)
  res.status(status).json({ error: message })
}
