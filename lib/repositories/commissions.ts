import {unstable_cache} from "next/cache";

import {prisma} from "@/lib/db/prisma";
import type {CommissionRequestRecord} from "@/lib/types";

export async function createCommissionRequest(
  data: Omit<CommissionRequestRecord, "id" | "createdAt" | "updatedAt">
): Promise<CommissionRequestRecord> {
  const request = await prisma.commissionRequest.create({
    data: {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      requestType: data.requestType,
      budgetRange: data.budgetRange,
      deadline: data.deadline,
      specificDeadline: data.specificDeadline,
      topic: data.topic,
      beatLink: data.beatLink,
      referenceLink: data.referenceLink,
      usageIntent: data.usageIntent,
      additionalNotes: data.additionalNotes,
      status: data.status,
      quotedPrice: data.quotedPrice,
      paypalLink: data.paypalLink,
      adminNotes: data.adminNotes,
      deliveryLink: data.deliveryLink,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      utmTerm: data.utmTerm,
      referrer: data.referrer,
      landingPage: data.landingPage,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

export async function listCommissionRequests(): Promise<CommissionRequestRecord[]> {
  const requests = await prisma.commissionRequest.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return requests.map((req) => ({
    ...req,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString()
  }));
}

export async function getCommissionRequest(id: string): Promise<CommissionRequestRecord | null> {
  const req = await prisma.commissionRequest.findUnique({
    where: {id}
  });

  if (!req) return null;

  return {
    ...req,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString()
  };
}

export async function updateCommissionRequest(
  id: string,
  patch: Partial<Omit<CommissionRequestRecord, "id" | "createdAt" | "updatedAt">>
): Promise<CommissionRequestRecord> {
  const req = await prisma.commissionRequest.update({
    where: {id},
    data: {
      ...patch,
      updatedAt: new Date()
    }
  });

  return {
    ...req,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString()
  };
}
