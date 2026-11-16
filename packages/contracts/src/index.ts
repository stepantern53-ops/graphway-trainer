import { z } from 'zod';
import type { CoefficientName, FunctionSpec, MathLevel, Scalar } from '@graphway/math-core';

export const credentialsSchema = z.object({
  nickname: z.string().transform((value) => value.trim().normalize('NFC')).pipe(
    z.string().regex(/^[A-Za-zА-Яа-яЁё0-9_]{3,24}$/u)
  ),
  password: z.string().refine((value) => {
    const codePointLength = Array.from(value).length;
    return codePointLength >= 10 && codePointLength <= 128 && new TextEncoder().encode(value).length <= 512;
  })
}).strict();

export const completionRequestSchema = z.object({
  curriculumVersion: z.string().min(1),
  coefficients: z.partialRecord(z.enum(['a', 'b', 'c', 'k']), z.string())
}).strict();

export const currentProgressRequestSchema = z.object({
  levelId: z.string().regex(/^(L|Q)(0[1-9]|1[0-2])$/),
  curriculumVersion: z.string().min(1)
}).strict();

export const safeUserSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  role: z.enum(['student', 'admin'])
}).strict();
export type SafeUser = z.infer<typeof safeUserSchema>;

export const progressDTOSchema = z.object({
  curriculumVersion: z.string(),
  currentLevelId: z.string(),
  nextLevelId: z.string().nullable(),
  completedLevelIds: z.array(z.string()),
  unlockedLevelIds: z.array(z.string()),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative()
}).strict();
export type ProgressDTO = z.infer<typeof progressDTOSchema>;

export const authResponseSchema = z.object({ user: safeUserSchema, progress: progressDTOSchema }).strict();
export type AuthResponse = z.infer<typeof authResponseSchema>;
export const csrfResponseSchema = z.object({ csrfToken: z.string().min(1) }).strict();
export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), field: z.string().optional() }).strict()
}).strict();

export const episodesResponseSchema = z.object({
  episodes: z.array(z.object({
    id: z.enum(['linear', 'quadratic']),
    title: z.string(),
    totalCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    unlocked: z.boolean()
  }).strict())
}).strict();

export const levelListResponseSchema = z.object({
  levels: z.array(z.object({
    id: z.string(),
    title: z.string(),
    focus: z.string(),
    goal: z.string(),
    completed: z.boolean(),
    unlocked: z.boolean()
  }).strict())
}).strict();

const scalarSchema = z.union([z.number().finite(), z.string()]);
const circleSchema = z.object({ x: scalarSchema, y: scalarSchema, r: scalarSchema }).strict();
const mathLevelSchema = z.object({
  functionSpec: z.object({ family: z.enum(['linear', 'quadratic']) }).strict(),
  bounds: z.partialRecord(z.enum(['a', 'b', 'c', 'k']), z.object({ min: scalarSchema, max: scalarSchema, minAbs: scalarSchema.optional() }).strict()).optional(),
  fixed: z.partialRecord(z.enum(['a', 'b', 'c', 'k']), scalarSchema).optional(),
  exactConditions: z.array(z.object({ x: scalarSchema, y: scalarSchema }).strict()).optional(),
  geometry: z.object({
    start: circleSchema,
    goal: circleSchema,
    pits: z.array(circleSchema),
    domain: z.object({ min: z.number().finite(), max: z.number().finite() }).strict().optional()
  }).strict()
}).strict();

export const theoryLessonSchema = z.object({
  focus: z.string(),
  activeCoefficientMeaning: z.string(),
  fixedCoefficientMeaning: z.string(),
  blocks: z.array(z.object({
    kind: z.enum(['text', 'formula']),
    content: z.string()
  }).strict()),
  example: z.object({
    prompt: z.string(),
    steps: z.array(z.string()).min(1),
    check: z.string()
  }).strict()
}).strict();
export type TheoryLesson = z.infer<typeof theoryLessonSchema>;

export const levelDTOSchema = z.object({
  id: z.string().regex(/^(L|Q)(0[1-9]|1[0-2])$/),
  version: z.string().min(1),
  episodeId: z.enum(['linear', 'quadratic']),
  title: z.string(),
  focus: z.string(),
  goal: z.string(),
  theoryKey: z.string(),
  controls: z.array(z.object({ name: z.enum(['a', 'b', 'c', 'k']), mode: z.enum(['slider-input', 'input']) }).strict()),
  initial: z.record(z.string(), z.string()),
  theory: theoryLessonSchema,
  ...mathLevelSchema.shape
}).strict();
export type LevelDTO = z.infer<typeof levelDTOSchema>;
export type LevelDefinition = LevelDTO;

export const completionResultSchema = z.object({
  completion: z.object({ levelId: z.string(), curriculumVersion: z.string(), completedAt: z.string().datetime() }).strict(),
  progress: progressDTOSchema
}).strict();
export type CompletionResult = z.infer<typeof completionResultSchema>;

export type { CoefficientName, FunctionSpec, MathLevel, Scalar };
