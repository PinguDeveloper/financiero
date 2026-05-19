import { prisma } from "../db.js";
import { decimalToNumber } from "./serialize.js";

export type SerializedPlannedExpense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  dayOfMonth: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function map(row: {
  id: string;
  description: string;
  amount: unknown;
  category: string;
  dayOfMonth: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SerializedPlannedExpense {
  return {
    id: row.id,
    description: row.description,
    amount: decimalToNumber(row.amount as never),
    category: row.category,
    dayOfMonth: row.dayOfMonth,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlannedExpenses(userId: string) {
  return (
    await prisma.plannedExpense.findMany({
      where: { userId },
      orderBy: [{ active: "desc" }, { dayOfMonth: "asc" }],
    })
  ).map(map);
}

export async function createPlannedExpense(
  userId: string,
  input: { description: string; amount: number; category: string; dayOfMonth: number; active?: boolean }
) {
  return map(
    await prisma.plannedExpense.create({
      data: {
        userId,
        description: input.description.trim().slice(0, 500),
        amount: input.amount,
        category: input.category.trim().slice(0, 120),
        dayOfMonth: Math.min(28, Math.max(1, input.dayOfMonth)),
        active: input.active ?? true,
      },
    })
  );
}

export async function updatePlannedExpense(
  userId: string,
  id: string,
  input: Partial<{
    description: string;
    amount: number;
    category: string;
    dayOfMonth: number;
    active: boolean;
  }>
) {
  const row = await prisma.plannedExpense.findFirst({ where: { id, userId } });
  if (!row) return null;
  return map(
    await prisma.plannedExpense.update({
      where: { id },
      data: {
        ...(input.description != null ? { description: input.description.trim().slice(0, 500) } : {}),
        ...(input.amount != null ? { amount: input.amount } : {}),
        ...(input.category != null ? { category: input.category.trim().slice(0, 120) } : {}),
        ...(input.dayOfMonth != null
          ? { dayOfMonth: Math.min(28, Math.max(1, input.dayOfMonth)) }
          : {}),
        ...(input.active != null ? { active: input.active } : {}),
      },
    })
  );
}

export async function deletePlannedExpense(userId: string, id: string) {
  const row = await prisma.plannedExpense.findFirst({ where: { id, userId } });
  if (!row) return false;
  await prisma.plannedExpense.delete({ where: { id } });
  return true;
}
