import "express";

declare module "express" {
  interface Request {
    /** Authenticated user ID, set by requireAuth middleware. */
    userId?: string;
  }
}