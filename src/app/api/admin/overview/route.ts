import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAdminPasscode } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 1. Verify admin authorization
    const auth = verifyAdminPasscode(request)
    if (!auth.authorized) {
      return auth.response!
    }

    // 2. Fetch metrics
    const [
      totalCodes,
      redeemedCount,
      unclaimedCount,
      revokedCount,
      activeCustomers,
      totalPointsIssuedAgg,
      totalPointsSpentAgg,
      batches,
      recentRedemptions,
      recentFraudLogs,
    ] = await Promise.all([
      prisma.boxCode.count(),
      prisma.boxCode.count({ where: { status: 'REDEEMED' } }),
      prisma.boxCode.count({ where: { status: 'UNCLAIMED' } }),
      prisma.boxCode.count({ where: { status: 'REVOKED' } }),
      prisma.customer.count(),
      prisma.customer.aggregate({
        _sum: {
          totalEarned: true,
        },
      }),
      prisma.rewardRedemption.aggregate({
        _sum: {
          pointsSpent: true,
        },
      }),
      prisma.batch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          _count: {
            select: { codes: true },
          },
        },
      }),
      prisma.rewardRedemption.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              contact: true,
            },
          },
          reward: {
            select: {
              id: true,
              title: true,
              pointsCost: true,
            },
          },
        },
      }),
      prisma.fraudLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ])

    const totalPointsIssued = totalPointsIssuedAgg._sum.totalEarned ?? 0
    const totalPointsSpent = totalPointsSpentAgg._sum.pointsSpent ?? 0

    return NextResponse.json(
      {
        metrics: {
          totalCodes,
          redeemedCount,
          unclaimedCount,
          revokedCount,
          activeCustomers,
          totalPointsIssued,
          totalPointsSpent,
          currentOutstandingPoints: totalPointsIssued - totalPointsSpent,
        },
        batches: batches.map((b) => ({
          id: b.id,
          name: b.name,
          productName: b.productName,
          pointsPerCode: b.pointsPerCode,
          quantity: b.quantity,
          codesCount: b._count.codes,
          createdAt: b.createdAt,
        })),
        recentRedemptions,
        recentFraudLogs,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in admin overview API:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve admin dashboard overview', details: error.message },
      { status: 500 }
    )
  }
}
