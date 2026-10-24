export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: FieldError[],
  ) {
    super(message);
  }
}
