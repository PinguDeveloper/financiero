import type { RequestHandler } from "express";
import { prisma } from "../db.js";
import { subscriptionPayload } from "../lib/subscription.js";

export const requireSubscription: RequestHandler = async (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  const sub = subscriptionPayload(user);
  if (!sub.hasAccess) {
    res.status(402).json({
      error: "Seu período de teste terminou. Assine um plano para continuar.",
      subscription: sub,
    });
    return;
  }

  next();
};
