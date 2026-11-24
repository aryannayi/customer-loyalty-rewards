'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  ShieldAlert,
  KeyRound,
  Package,
  Layers,
  Users,
  AlertTriangle,
  Download,
  Printer,
  X,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Lock,
  LogOut,
  ChevronDown,
  ChevronUp,
  Ban,
  RotateCcw,
  QrCode,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react'

interface BatchItem {
  id: string
  name: string
  productName: string
  pointsPerCode: number
  quantity: number
  codesCount: number
  claimedCount: number
  unclaimedCount: number
  revokedCount: number
  createdAt: string
  codes?: {
    id: string
    code: string
    status: 'UNCLAIMED' | 'REDEEMED' | 'REVOKED'
    redeemedAt: string | null
    createdAt: string
  }[]
}

interface FraudLogItem {
  id: string
  attemptedCode: string
  contact: string
  reason: 'INVALID_CODE' | 'ALREADY_REDEEMED' | 'REVOKED_CODE' | 'RATE_LIMITED'
  createdAt: string
}

interface AdminOverviewData {
  metrics: {
    totalCodes: number
    redeemedCount: number
    unclaimedCount: number
    revokedCount: number
    activeCustomers: number
    totalPointsIssued: number
    totalPointsSpent: number
    currentOutstandingPoints: number
  }
  batches: BatchItem[]
  recentRedemptions: any[]
  recentFraudLogs: FraudLogItem[]
}

interface NewlyGeneratedBatch {
  id: string
  name: string
  productName: string
  pointsPerCode: number
  quantity: number
  codesSample: { id: string; code: string; status: string }[]
  totalCodesGenerated: number
  allCodes?: { code: string; url: string; qrDataUrl?: string }[]
}

export default function AdminDashboardPage() {
  // Passcode & Auth State
  const [passcode, setPasscode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true)

  // Overview Data State
  const [data, setData] = useState<AdminOverviewData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Batch Generation Form State
  const [batchName, setBatchName] = useState('')
  const [productName, setProductName] = useState('')
  const [pointsPerCode, setPointsPerCode] = useState('50')
  const [quantity, setQuantity] = useState('10')
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Generated Batch Modal / QR Print Drawer State
  const [generatedBatchModal, setGeneratedBatchModal] = useState<NewlyGeneratedBatch | null>(null)
  const [qrCodeItems, setQrCodeItems] = useState<{ code: string; url: string; qrDataUrl: string }[]>([])
  const [isGeneratingQRs, setIsGeneratingQRs] = useState(false)

  // Batch Inspector State
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [codeSearchQuery, setCodeSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNCLAIMED' | 'REDEEMED' | 'REVOKED'>('ALL')
  const [revokingCodeId, setRevokingCodeId] = useState<string | null>(null)

  // Check existing session on mount
  useEffect(() => {
    const savedPasscode = sessionStorage.getItem('factory_admin_passcode')
    if (savedPasscode) {
      setPasscode(savedPasscode)
      verifyAndLoadOverview(savedPasscode)
    } else {
      setIsVerifyingAuth(false)
    }
  }, [])

  async function verifyAndLoadOverview(codeToTest: string) {
    setIsLoadingData(true)
    setAuthError(null)

    try {
      const res = await fetch('/api/admin/overview', {
        headers: {
          'x-admin-passcode': codeToTest.trim(),
        },
      })

      if (res.ok) {
        const overviewData = await res.json()
        setData(overviewData)
        setIsAuthenticated(true)
        sessionStorage.setItem('factory_admin_passcode', codeToTest.trim())
      } else {
        const errData = await res.json().catch(() => ({}))
        setIsAuthenticated(false)
        sessionStorage.removeItem('factory_admin_passcode')
        setAuthError(errData.error || 'Invalid factory admin passcode.')
      }
    } catch (err: any) {
      setAuthError('Network error connecting to factory admin server.')
    } finally {
      setIsVerifyingAuth(false)
      setIsLoadingData(false)
    }
  }

  function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passcode.trim()) {
      setAuthError('Please enter the factory passcode.')
      return
    }
    verifyAndLoadOverview(passcode.trim())
  }

  function handleLogout() {
    sessionStorage.removeItem('factory_admin_passcode')
    setIsAuthenticated(false)
    setPasscode('')
    setData(null)
  }

  // Handle Generating Batch
  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault()
    setGenerateError(null)

    const numPoints = parseInt(pointsPerCode, 10)
    const numQty = parseInt(quantity, 10)

    if (!batchName.trim() || !productName.trim()) {
      setGenerateError('Batch name and product name are required.')
      return
    }
    if (isNaN(numPoints) || numPoints <= 0) {
      setGenerateError('Points per code must be a positive integer.')
      return
    }
    if (isNaN(numQty) || numQty <= 0 || numQty > 500) {
      setGenerateError('Quantity must be between 1 and 500.')
      return
    }

    setIsGeneratingBatch(true)

    try {
      const activePasscode = sessionStorage.getItem('factory_admin_passcode') || passcode
      const res = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-passcode': activePasscode,
        },
        body: JSON.stringify({
          name: batchName.trim(),
          productName: productName.trim(),
          pointsPerCode: numPoints,
          quantity: numQty,
        }),
      })

      const resData = await res.json()

      if (res.ok && resData.batch) {
        // Clear form
        setBatchName('')
        setProductName('')
        // Refresh overview
        verifyAndLoadOverview(activePasscode)

        // Prepare codes for QR label generator
        const origin = window.location.origin
        const sampleList = resData.batch.codesSample || []
        
        // Find newly created batch in refreshed overview or use sample
        const fullBatch = data?.batches.find((b) => b.id === resData.batch.id)
        const codesList = fullBatch?.codes || sampleList

        setIsGeneratingQRs(true)
        const qrList = await Promise.all(
          codesList.map(async (c: any) => {
            const scanUrl = `${origin}/?code=${encodeURIComponent(c.code)}`
            const qrDataUrl = await QRCode.toDataURL(scanUrl, {
              width: 140,
              margin: 1,
              color: { dark: '#14532D', light: '#FFFFFF' },
            })
            return {
              code: c.code,
              url: scanUrl,
              qrDataUrl,
            }
          })
        )
        setQrCodeItems(qrList)
        setIsGeneratingQRs(false)

        setGeneratedBatchModal({
          id: resData.batch.id,
          name: resData.batch.name,
          productName: resData.batch.productName,
          pointsPerCode: resData.batch.pointsPerCode,
          quantity: resData.batch.quantity,
          codesSample: resData.batch.codesSample,
          totalCodesGenerated: resData.batch.totalCodesGenerated,
        })
      } else {
        setGenerateError(resData.error || 'Failed to create batch.')
      }
    } catch (err: any) {
      setGenerateError('Network error while creating batch.')
    } finally {
      setIsGeneratingBatch(false)
    }
  }

  // Handle Revoking / Unrevoking Code
  async function handleToggleCodeRevoke(codeIdOrString: string, currentStatus: string) {
    const newAction = currentStatus === 'REVOKED' ? 'UNREVOKE' : 'REVOKE'
    const confirmMsg =
      newAction === 'REVOKE'
        ? `Are you sure you want to REVOKE code "${codeIdOrString}"? Customers will no longer be able to claim it.`
        : `Are you sure you want to UNREVOKE and restore code "${codeIdOrString}"?`

    if (!window.confirm(confirmMsg)) return

    setRevokingCodeId(codeIdOrString)
    try {
      const activePasscode = sessionStorage.getItem('factory_admin_passcode') || passcode
      const res = await fetch(`/api/admin/codes/${encodeURIComponent(codeIdOrString)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-admin-passcode': activePasscode,
        },
        body: JSON.stringify({ action: newAction }),
      })

      if (res.ok) {
        // Refresh overview
        verifyAndLoadOverview(activePasscode)
      } else {
        const errData = await res.json()
        alert(errData.error || 'Failed to update code status.')
      }
    } catch (err) {
      alert('Network error updating code status.')
    } finally {
      setRevokingCodeId(null)
    }
  }

  // Handle CSV Download
  function handleDownloadCSV() {
    if (!generatedBatchModal) return
    const activePasscode = sessionStorage.getItem('factory_admin_passcode') || passcode
    const currentBatch = data?.batches.find((b) => b.id === generatedBatchModal.id)
    const codes = currentBatch?.codes || generatedBatchModal.codesSample

    const origin = window.location.origin
    const header = ['Code', 'Batch Name', 'Product Name', 'Points', 'Status', 'Claim QR URL']
    const rows = codes.map((c: any) => [
      c.code,
      generatedBatchModal.name,
      generatedBatchModal.productName,
      generatedBatchModal.pointsPerCode,
      c.status,
      `${origin}/?code=${encodeURIComponent(c.code)}`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [header.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${generatedBatchModal.name}-box-codes.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // -------------------------------------------------------------------------
  // 1. PASSCODE GATE SCREEN
  // -------------------------------------------------------------------------
  if (isVerifyingAuth) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-[#166534] font-semibold text-sm">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Verifying factory authentication...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-[#E2E8F0]">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#14532D] to-[#166534] text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-950/20">
              <KeyRound className="w-7 h-7 stroke-[2.2]" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Factory Admin Access
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter factory owner passcode to manage box batches, code revocation, and fraud feeds.
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-6 p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Admin Passcode
              </label>
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter passcode (e.g. factory2026)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingData}
              className="w-full py-3.5 px-4 rounded-xl bg-[#14532D] hover:bg-[#166534] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/10 disabled:opacity-60"
            >
              {isLoadingData ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Unlock Admin Dashboard
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-[#14532D] font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Customer Loyalty Portal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Calculate quick stats
  const metrics = data?.metrics || {
    totalCodes: 0,
    redeemedCount: 0,
    unclaimedCount: 0,
    revokedCount: 0,
    activeCustomers: 0,
    totalPointsIssued: 0,
    totalPointsSpent: 0,
    currentOutstandingPoints: 0,
  }

  const claimRatePct =
    metrics.totalCodes > 0
      ? Math.round((metrics.redeemedCount / metrics.totalCodes) * 100)
      : 0

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col">
      {/* 2. ADMIN HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl bg-[#14532D] text-white flex items-center justify-center shadow-sm hover:bg-[#166534] transition-colors"
              title="Return to Customer Portal"
            >
              <Package className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-[#14532D] tracking-tight">
                  Factory Owner Dashboard
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Secured Session
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Box code issuance, anti-fraud logs & batch inspection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const pass = sessionStorage.getItem('factory_admin_passcode') || passcode
                verifyAndLoadOverview(pass)
              }}
              disabled={isLoadingData}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl transition-colors"
            >
              Customer View
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI SUMMARY ROW */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Total Codes */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Total Codes Issued
              </p>
              <p className="text-3xl font-black text-slate-900 font-mono">
                {metrics.totalCodes.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {metrics.unclaimedCount} unclaimed in boxes
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#14532D] flex items-center justify-center font-bold">
              <Package className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

          {/* Card 2: Claim Rate */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Redemption Rate
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#14532D] font-mono">
                  {claimRatePct}%
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ({metrics.redeemedCount} claimed)
                </span>
              </div>
              <div className="w-28 h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${claimRatePct}%` }}
                />
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

          {/* Card 3: Active Customers */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Active Customers
              </p>
              <p className="text-3xl font-black text-slate-900 font-mono">
                {metrics.activeCustomers.toLocaleString()}
              </p>
              <p className="text-xs text-emerald-700 font-medium mt-1">
                {metrics.totalPointsIssued.toLocaleString()} total pts awarded
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Users className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

          {/* Card 4: Fraud Alerts Blocked */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Fraud Attempts Blocked
              </p>
              <p className="text-3xl font-black text-[#DC2626] font-mono">
                {data?.recentFraudLogs?.length || 0}
              </p>
              <p className="text-xs text-rose-600 font-medium mt-1">
                {metrics.revokedCount} revoked box codes
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-[#DC2626] flex items-center justify-center font-bold">
              <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>
        </section>

        {/* 4. TWO-COLUMN: GENERATE BATCH PANEL (LEFT) & FRAUD MONITORING FEED (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* GENERATE BATCH CODES & QR PANEL */}
          <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#14532D] flex items-center justify-center font-bold">
                <PlusCircle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Generate Production Batch
                </h2>
                <p className="text-xs text-slate-500">
                  Issue unique cryptographic codes (`BOX-XXXX-XXXX`) and prepare print labels.
                </p>
              </div>
            </div>

            {generateError && (
              <div className="mb-6 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                <span>{generateError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Batch Identifier / Lot #
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BATCH-2026-ALPHA"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Eco Thermal Tumbler 750ml"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Points Per Box Code
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={pointsPerCode}
                    onChange={(e) => setPointsPerCode(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Quantity of Codes (1-500)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isGeneratingBatch}
                className="w-full py-3.5 px-6 rounded-xl bg-[#14532D] hover:bg-[#166534] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all disabled:opacity-60"
              >
                {isGeneratingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Cryptographic Codes...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 text-emerald-300" />
                    Generate Batch & QR Labels
                  </>
                )}
              </button>
            </form>
          </div>

          {/* LIVE FRAUD & REUSE MONITORING ALERT PANEL */}
          <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-[#E2E8F0] shadow-xs flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#DC2626] flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Live Security & Fraud Feed
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time intercept of duplicate claims, fake codes & rate limits.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200">
                Active Shield
              </span>
            </div>

            {/* Fraud logs list */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 divide-y divide-slate-100">
              {!data?.recentFraudLogs?.length ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No fraud attempts detected</p>
                  <p className="text-[11px] text-slate-400">System is clean and operational.</p>
                </div>
              ) : (
                data.recentFraudLogs.map((log) => {
                  let badgeBg = 'bg-rose-50 text-rose-800 border-rose-200'
                  if (log.reason === 'INVALID_CODE') badgeBg = 'bg-amber-50 text-amber-800 border-amber-200'
                  if (log.reason === 'REVOKED_CODE') badgeBg = 'bg-purple-50 text-purple-800 border-purple-200'
                  if (log.reason === 'RATE_LIMITED') badgeBg = 'bg-red-50 text-red-800 border-red-200'

                  return (
                    <div
                      key={log.id}
                      className="pt-2.5 first:pt-0 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${badgeBg}`}>
                            {log.reason}
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {log.attemptedCode}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px]">
                          Contact: <strong className="text-slate-700">{log.contact}</strong>
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* 5. BATCHES & CODE INSPECTOR TABLE */}
        <section className="bg-white rounded-3xl border border-[#E2E8F0] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#166534]" />
                Batches & Box Code Inspector
              </h3>
              <p className="text-xs text-slate-500">
                Inspect physical production batches, monitor claim ratios, and revoke suspicious codes.
              </p>
            </div>
          </div>

          {!data?.batches?.length ? (
            <div className="py-12 text-center text-slate-400">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No production batches found</p>
              <p className="text-xs text-slate-400 mt-1">
                Create your first batch using the form above to issue box codes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.batches.map((b) => {
                const isExpanded = expandedBatchId === b.id
                const claimPct = b.codesCount > 0 ? Math.round((b.claimedCount / b.codesCount) * 100) : 0

                // Filter codes for the expanded batch
                const filteredCodes = (b.codes || []).filter((c) => {
                  const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter
                  const matchesSearch =
                    !codeSearchQuery || c.code.toLowerCase().includes(codeSearchQuery.toLowerCase())
                  return matchesStatus && matchesSearch
                })

                return (
                  <div
                    key={b.id}
                    className="border border-[#E2E8F0] rounded-2xl overflow-hidden transition-all bg-white"
                  >
                    {/* Batch Summary Header Row */}
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F8FAFC]/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className="font-mono font-bold text-[#14532D] text-sm sm:text-base">
                            {b.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {b.pointsPerCode} pts / box
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-700">
                          {b.productName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Issued on {new Date(b.createdAt).toLocaleDateString()} • {b.quantity} total codes
                        </p>
                      </div>

                      {/* Claim Ratio Progress Bar */}
                      <div className="w-full md:w-64 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Claim Ratio</span>
                          <span className="font-bold font-mono text-slate-700">
                            {b.claimedCount} / {b.codesCount} ({claimPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200/70 overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-600 transition-all duration-300"
                            style={{ width: `${claimPct}%` }}
                            title={`${b.claimedCount} Redeemed`}
                          />
                          {b.revokedCount > 0 && (
                            <div
                              className="h-full bg-rose-500"
                              style={{ width: `${(b.revokedCount / b.codesCount) * 100}%` }}
                              title={`${b.revokedCount} Revoked`}
                            />
                          )}
                        </div>
                      </div>

                      {/* Expand / Collapse Button */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                          className="w-full md:w-auto px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          {isExpanded ? (
                            <>
                              Hide Codes <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              Inspect Codes ({b.codes?.length || b.codesCount}){' '}
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Codes Inspector Panel */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 border-t border-[#E2E8F0] bg-white space-y-4">
                        {/* Search & Status Filters */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="relative w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search code..."
                              value={codeSearchQuery}
                              onChange={(e) => setCodeSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#166534]"
                            />
                          </div>

                          <div className="flex items-center gap-1 self-start sm:self-auto overflow-x-auto text-xs">
                            {(['ALL', 'UNCLAIMED', 'REDEEMED', 'REVOKED'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setStatusFilter(st)}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                                  statusFilter === st
                                    ? 'bg-[#14532D] text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Codes Table */}
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wider font-semibold border-b border-slate-100">
                                <th className="py-2.5 px-3">Code String</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Redeemed At</th>
                                <th className="py-2.5 px-3 text-right">Owner Control Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredCodes.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="py-6 text-center text-slate-400">
                                    No codes match the selected filter.
                                  </td>
                                </tr>
                              ) : (
                                filteredCodes.map((codeItem) => (
                                  <tr key={codeItem.id} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                      {codeItem.code}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          codeItem.status === 'UNCLAIMED'
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                            : codeItem.status === 'REDEEMED'
                                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                                        }`}
                                      >
                                        {codeItem.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500">
                                      {codeItem.redeemedAt
                                        ? new Date(codeItem.redeemedAt).toLocaleString([], {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })
                                        : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        type="button"
                                        disabled={revokingCodeId === codeItem.code}
                                        onClick={() => handleToggleCodeRevoke(codeItem.code, codeItem.status)}
                                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                          codeItem.status === 'REVOKED'
                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                        }`}
                                      >
                                        {revokingCodeId === codeItem.code ? (
                                          'Updating...'
                                        ) : codeItem.status === 'REVOKED' ? (
                                          <span className="flex items-center gap-1">
                                            <RotateCcw className="w-3 h-3" /> Restore Code
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-1">
                                            <Ban className="w-3 h-3" /> Revoke
                                          </span>
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* 6. MODAL / DRAWER: PRINTABLE QR LABELS & CSV EXPORT */}
      {generatedBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#14532D] flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Batch Created: {generatedBatchModal.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {generatedBatchModal.quantity} codes ready for box packaging inserts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneratedBatchModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Actions Bar */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3 no-print">
              <p className="text-xs text-slate-600 font-medium">
                Export to production line:
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#14532D] hover:bg-[#166534] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print QR Box Inserts
                </button>
              </div>
            </div>

            {/* Modal Body / Printable Grid */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isGeneratingQRs ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#166534]" />
                  <span>Rendering print-ready QR vectors...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {qrCodeItems.map((item, idx) => (
                    <div
                      key={item.code}
                      className="border-2 border-dashed border-emerald-800/40 rounded-2xl p-4 bg-white flex flex-col items-center text-center justify-between shadow-2xs break-inside-avoid"
                    >
                      {/* Top Brand Banner */}
                      <div className="w-full border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-black tracking-tight text-[#14532D] uppercase">
                          EcoRewards™ Official
                        </span>
                        <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          +{generatedBatchModal.pointsPerCode} PTS
                        </span>
                      </div>

                      {/* QR Vector Image */}
                      {item.qrDataUrl && (
                        <img
                          src={item.qrDataUrl}
                          alt={item.code}
                          className="w-28 h-28 my-1"
                        />
                      )}

                      {/* Code string */}
                      <div className="my-1">
                        <p className="text-sm font-mono font-black tracking-widest text-[#14532D]">
                          {item.code}
                        </p>
                        <p className="text-[9px] text-slate-500 font-medium">
                          {generatedBatchModal.productName}
                        </p>
                      </div>

                      {/* Instructions */}
                      <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-wider">
                        Scan QR or enter code at website to redeem
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E2E8F0] flex justify-end no-print">
              <button
                type="button"
                onClick={() => setGeneratedBatchModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
