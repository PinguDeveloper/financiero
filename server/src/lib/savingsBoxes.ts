import { prisma } from "../db.js";
import { decimalToNumber } from "./serialize.js";

export type SerializedSavingsBox = {
  id: string;
  name: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

function map(row: {
  id: string;
  name: string;
  balance: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SerializedSavingsBox {
  return {
    id: row.id,
    name: row.name,
    balance: decimalToNumber(row.balance as never),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSavingsBoxes(userId: string) {
  return (await prisma.savingsBox.findMany({ where: { userId }, orderBy: { name: "asc" } })).map(map);
}

export async function createSavingsBox(userId: string, input: { name: string; balance?: number }) {
  return map(
    await prisma.savingsBox.create({
      data: { userId, name: input.name.trim().slice(0, 120), balance: input.balance ?? 0 },
    })
  );
}

export async function updateSavingsBox(
  userId: string,
  id: string,
  input: Partial<{ name: string; balance: number }>
) {
  const row = await prisma.savingsBox.findFirst({ where: { id, userId } });
  if (!row) return null;
  return map(
    await prisma.savingsBox.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name.trim().slice(0, 120) } : {}),
        ...(input.balance != null ? { balance: input.balance } : {}),
      },
    })
  );
}

export async function deleteSavingsBox(userId: string, id: string) {
  const row = await prisma.savingsBox.findFirst({ where: { id, userId } });
  if (!row) return false;
  await prisma.savingsBox.delete({ where: { id } });
  return true;
}

export async function depositSavingsBox(userId: string, id: string, amount: number) {
  const row = await prisma.savingsBox.findFirst({ where: { id, userId } });
  if (!row) return null;
  const current = decimalToNumber(row.balance as never);
  const next = Math.round((current + amount) * 100) / 100;
  return map(
    await prisma.savingsBox.update({
      where: { id },
      data: { balance: next },
    })
  );
}
