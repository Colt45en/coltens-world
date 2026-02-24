import { z } from "zod";
export const SessionIdSchema = z.string().min(1);
export const TraceIdSchema = z.string().min(1);
