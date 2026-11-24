'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Package,
  Gift,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Lock,
  Search,
  RefreshCw,
  ExternalLink,
  History,
  Box,
  ChevronRight,
  UserCheck,
  AlertOctagon,
} from 'lucide-react'

interface RewardItem {
  id: string
  title: string
  description: string
  pointsCost: number
  stock: number
  active: boolean
}

interface ClaimedBox {
  id: string
  code: string
  batchName: string
  productName: string
  pointsEarned: number
  redeemedAt: string | null
}

interface RedemptionRecord {
  id: string
  pointsSpent: number
  status: string
  createdAt: string
  reward: {
    id: string
    title: string
    description: string
    pointsCost: number
  }
}

interface CustomerProfile {
  id: string
  name: string
  contact: string
  pointsBalance: number
  totalEarned: number
  createdAt: string
}

function CustomerPortal() {
  const searchParams = useSearchParams()
  const codeParam = searchParams.get('code')

  // Wallet & Profile State
  const [walletLookupInput, setWalletLookupInput] = useState('')
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [claimedBoxes, setClaimedBoxes] = useState<ClaimedBox[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([])
  const [rewards, setRewards] = useState<RewardItem[]>([])
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [isLoadingRewards, setIsLoadingRewards] = useState(true)

  // Box Code Claim Form State
  const [claimName, setClaimName] = useState('')
  const [claimContact, setClaimContact] = useState('')
  const [claimCode, setClaimCode] = useState(codeParam ? codeParam.toUpperCase() : '')
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<{
    text: string
    points: number
    productName: string
  } | null>(null)
  const [claimErrorMsg, setClaimErrorMsg] = useState<{
    text: string
    reason?: string
  } | null>(null)

  // Redemption State
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null)
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null)
  const [redeemErrorMsg, setRedeemErrorMsg] = useState<string | null>(null)

  // Active Tab for History
  const [activeTab, setActiveTab] = useState<'boxes' | 'rewards'>('boxes')

  // Load active rewards catalog on mount
  useEffect(() => {
    fetchRewards()
    // Load previously remembered contact from localStorage
    const savedContact = localStorage.getItem('ecorewards_contact')
    const savedName = localStorage.getItem('ecorewards_name')
    if (savedContact) {
      setClaimContact(savedContact)
      setWalletLookupInput(savedContact)
      loadCustomerWallet(savedContact)
    }
    if (savedName) {
      setClaimName(savedName)
    }
  }, [])

  // Synchronize URL ?code=... param if changes
  useEffect(() => {
    if (codeParam) {
      setClaimCode(codeParam.toUpperCase())
    }
  }, [codeParam])

  async function fetchRewards() {
    setIsLoadingRewards(true)
    try {
      const res = await fetch('/api/rewards')
      if (res.ok) {
        const data = await res.json()
        setRewards(data.rewards || [])
      }
    } catch (err) {
      console.error('Failed to fetch rewards:', err)
    } finally {
      setIsLoadingRewards(false)
    }
  }

  async function loadCustomerWallet(contactQuery: string) {
    if (!contactQuery.trim()) return
    setIsLoadingWallet(true)
    setClaimErrorMsg(null)

    try {
      const res = await fetch(`/api/customer?contact=${encodeURIComponent(contactQuery.trim())}`)
      const data = await res.json()

      if (res.ok && data.customer) {
        setCustomer(data.customer)
        setClaimedBoxes(data.claimedBoxes || [])
        setRedemptions(data.redemptions || [])
        if (data.availableRewards?.length) {
          setRewards(data.availableRewards)
        }
        setClaimName(data.customer.name)
        setClaimContact(data.customer.contact)
        localStorage.setItem('ecorewards_contact', data.customer.contact)
        localStorage.setItem('ecorewards_name', data.customer.name)
      } else {
        // If wallet doesn't exist yet, clear current customer
        setCustomer(null)
        setClaimedBoxes([])
        setRedemptions([])
        if (contactQuery !== claimContact) {
          setClaimErrorMsg({
            text: data.error || 'No customer profile found for this contact yet. Claim your first box code below to activate your wallet!',
          })
        }
      }
    } catch (err) {
      console.error('Error loading wallet:', err)
    } finally {
      setIsLoadingWallet(false)
    }
  }

  // Handle Box Code Claim
  async function handleClaimCode(e: React.FormEvent) {
    e.preventDefault()
    setClaimSuccessMsg(null)
    setClaimErrorMsg(null)

    if (!claimName.trim()) {
      setClaimErrorMsg({ text: 'Please enter your name.' })
      return
    }
    if (!claimContact.trim()) {
      setClaimErrorMsg({ text: 'Please enter your phone number or email.' })
      return
    }
    if (!claimCode.trim()) {
      setClaimErrorMsg({ text: 'Please enter a 12-character box reward code.' })
      return
    }

    setIsClaiming(true)
    try {
      const res = await fetch('/api/codes/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: claimName.trim(),
          contact: claimContact.trim(),
          code: claimCode.trim().toUpperCase(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setClaimSuccessMsg({
          text: data.message || 'Points earned successfully!',
          points: data.boxCode?.pointsEarned || data.pointsEarned || 50,
          productName: data.boxCode?.productName || 'Eco-Packaged Product',
        })
        // Clear code input upon successful redemption
        setClaimCode('')
        // Refresh customer wallet
        loadCustomerWallet(claimContact.trim())
      } else {
        setClaimErrorMsg({
          text: data.error || 'Failed to claim code.',
          reason: data.reason,
        })
      }
    } catch (err: any) {
      setClaimErrorMsg({ text: 'Network connection error. Please try again.' })
    } finally {
      setIsClaiming(false)
    }
  }

  // Handle Reward Redemption
  async function handleRedeemReward(reward: RewardItem) {
    if (!customer) {
      setRedeemErrorMsg('Please look up or activate your wallet with your phone/email first.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (customer.pointsBalance < reward.pointsCost) {
      setRedeemErrorMsg(`You need ${reward.pointsCost - customer.pointsBalance} more points to claim this reward.`)
      return
    }

    if (reward.stock <= 0) {
      setRedeemErrorMsg('Sorry, this reward is currently out of stock.')
      return
    }

    const confirmRedeem = window.confirm(
      `Redeem "${reward.title}" for ${reward.pointsCost} points? (Remaining balance will be ${customer.pointsBalance - reward.pointsCost} points)`
    )
    if (!confirmRedeem) return

    setRedeemingRewardId(reward.id)
    setRedeemSuccessMsg(null)
    setRedeemErrorMsg(null)

    try {
      const res = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          rewardId: reward.id,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setRedeemSuccessMsg(`Successfully redeemed "${reward.title}"! Our fulfillment team has received your order.`)
        // Refresh customer wallet & available rewards
        loadCustomerWallet(customer.contact)
        fetchRewards()
      } else {
        setRedeemErrorMsg(data.error || 'Failed to redeem reward.')
      }
    } catch (err: any) {
      setRedeemErrorMsg('Network error while redeeming reward.')
    } finally {
      setRedeemingRewardId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col">
      {/* 1. TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#14532D] to-[#166534] flex items-center justify-center shadow-md shadow-emerald-950/10 text-white">
              <Package className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-[#14532D] tracking-tight">
                  EcoRewards<span className="text-emerald-500">™</span>
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Factory Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Sustainable Packaging & Box Loyalty Rewards Engine
              </p>
            </div>
          </div>

          {/* Quick "Check My Wallet" Search Bar */}
          <div className="flex-1 max-w-md hidden md:flex items-center">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                loadCustomerWallet(walletLookupInput)
              }}
              className="w-full relative flex items-center"
            >
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter Email or Phone to check wallet..."
                value={walletLookupInput}
                onChange={(e) => setWalletLookupInput(e.target.value)}
                className="w-full pl-9.5 pr-24 py-2 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={isLoadingWallet}
                className="absolute right-1 px-3 py-1.5 text-xs font-semibold bg-[#166534] hover:bg-[#14532D] text-white rounded-lg transition-colors flex items-center gap-1 disabled:opacity-60 shadow-xs"
              >
                {isLoadingWallet ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Check'
                )}
              </button>
            </form>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2 sm:gap-3">
            {customer && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-900 font-medium">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="truncate max-w-[120px]">{customer.name}</span>
                <span className="font-bold text-emerald-700 ml-1">
                  ({customer.pointsBalance} pts)
                </span>
              </div>
            )}

            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#14532D] bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all border border-slate-200/60"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Factory Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Wallet Lookup (Visible on Small Screens) */}
      <div className="md:hidden bg-white px-4 py-2.5 border-b border-[#E2E8F0]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            loadCustomerWallet(walletLookupInput)
          }}
          className="relative flex items-center"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Enter Email or Phone to check wallet..."
            value={walletLookupInput}
            onChange={(e) => setWalletLookupInput(e.target.value)}
            className="w-full pl-9 pr-20 py-2 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
          <button
            type="submit"
            disabled={isLoadingWallet}
            className="absolute right-1 px-3 py-1.5 text-xs font-semibold bg-[#166534] text-white rounded-lg"
          >
            {isLoadingWallet ? '...' : 'Check'}
          </button>
        </form>
      </div>

      {/* 2. HERO: POINTS WALLET & BOX CODE CLAIM SECTION */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: PROMINENT POINTS BALANCE CARD */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#14532D] via-[#166534] to-[#14532D] text-white rounded-3xl p-7 sm:p-9 shadow-xl shadow-emerald-950/15 relative overflow-hidden flex flex-col justify-between border border-emerald-800">
            {/* Background Texture Accents */}
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-300/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              {/* Badge & Wallet Identity */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 backdrop-blur-xs">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  Eco-Partner Wallet
                </span>
                {customer ? (
                  <span className="text-xs text-emerald-200 font-mono">
                    ID: {customer.id.slice(0, 8)}...
                  </span>
                ) : (
                  <span className="text-xs text-emerald-200/80 font-medium">
                    Guest Account
                  </span>
                )}
              </div>

              {/* Main Balance Display */}
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wider text-emerald-200 font-bold mb-1">
                  Available Rewards Balance
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl sm:text-6xl font-black tracking-tight text-white font-mono">
                    {customer ? customer.pointsBalance.toLocaleString() : '0'}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-emerald-300">
                    PTS
                  </span>
                </div>
              </div>

              {/* Wallet Summary Stats */}
              <div className="grid grid-cols-2 gap-4 py-4 border-t border-emerald-700/60 mb-6">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-emerald-200/80 font-semibold">
                    Lifetime Points
                  </p>
                  <p className="text-xl font-bold text-white font-mono">
                    {customer ? customer.totalEarned.toLocaleString() : '0'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-emerald-200/80 font-semibold">
                    Boxes Claimed
                  </p>
                  <p className="text-xl font-bold text-white font-mono">
                    {claimedBoxes.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Status / Helper Text */}
            <div className="pt-4 border-t border-emerald-700/60 flex items-center justify-between text-xs text-emerald-100">
              {customer ? (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Logged in as <strong>{customer.name}</strong>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-200/90">
                  <Wallet className="w-4 h-4 text-emerald-300" />
                  <span>Look up wallet or claim a box code to earn points</span>
                </div>
              )}
              {customer && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('ecorewards_contact')
                    localStorage.removeItem('ecorewards_name')
                    setCustomer(null)
                    setClaimedBoxes([])
                    setRedemptions([])
                    setWalletLookupInput('')
                  }}
                  className="text-xs text-emerald-300 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Clear Wallet
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: CLAIM BOX REWARD CODE CARD */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-7 sm:p-9 shadow-lg shadow-slate-200/60 border border-[#E2E8F0] relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#166534] flex items-center justify-center font-bold">
                <Box className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Claim Box Reward Code
                </h2>
                <p className="text-xs text-slate-500">
                  Check inside your physical product box for your unique sticker or insert card.
                </p>
              </div>
            </div>

            {/* FEEDBACK BANNERS */}
            {claimSuccessMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 animate-in fade-in duration-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-950">
                    + {claimSuccessMsg.points} Points Added to Wallet!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Verified authentic batch for <strong>{claimSuccessMsg.productName}</strong>. Your points balance has been updated immediately.
                  </p>
                </div>
              </div>
            )}

            {claimErrorMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] flex items-start gap-3 animate-in fade-in duration-300">
                <AlertOctagon className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-[#7F1D1D] flex items-center gap-2">
                    {claimErrorMsg.reason ? `Security Notice: ${claimErrorMsg.reason}` : 'Claim Unsuccessful'}
                  </h4>
                  <p className="text-xs text-[#991B1B] mt-0.5">
                    {claimErrorMsg.text}
                  </p>
                </div>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleClaimCode} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Johnson"
                    value={claimName}
                    onChange={(e) => setClaimName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Phone or Email Address
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. worker@factory.com or 555-0192"
                    value={claimContact}
                    onChange={(e) => setClaimContact(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    12-Character Box Reward Code
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Format: BOX-XXXX-XXXX
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={13}
                    placeholder="BOX-XXXX-XXXX"
                    value={claimCode}
                    onChange={(e) => {
                      let val = e.target.value.toUpperCase().replace(/\s+/g, '')
                      setClaimCode(val)
                    }}
                    className="w-full px-4 py-3 text-base sm:text-lg font-mono font-bold tracking-widest text-[#14532D] bg-[#F8FAFC] border-2 border-emerald-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] transition-all placeholder:text-slate-300"
                  />
                  {claimCode && (
                    <button
                      type="button"
                      onClick={() => setClaimCode('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isClaiming}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#14532D] hover:bg-[#166534] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg shadow-emerald-950/10 transition-all disabled:opacity-60"
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Verifying Code with Factory Registry...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      Verify & Claim Reward Points
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                Protected by factory anti-reuse cryptographic ledger and 10-minute automated rate limiting.
              </p>
            </form>
          </div>
        </div>

        {/* 3. REDEEMABLE REWARDS CATALOG GRID */}
        <section className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-[#14532D] border border-emerald-200 mb-2">
                <Gift className="w-3.5 h-3.5 text-emerald-600" />
                Factory Rewards Catalog
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Redeem Products & Merch
              </h3>
              <p className="text-sm text-slate-500">
                Spend your earned box points directly on industrial gear, branded apparel, and accessories.
              </p>
            </div>
            {customer && (
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">Your Current Balance</p>
                <p className="text-xl font-black text-[#14532D] font-mono">
                  {customer.pointsBalance.toLocaleString()} PTS
                </p>
              </div>
            )}
          </div>

          {/* Toast feedback for redemption */}
          {redeemSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">{redeemSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setRedeemSuccessMsg(null)}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {redeemErrorMsg && (
            <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">{redeemErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setRedeemErrorMsg(null)}
                className="text-xs text-[#7F1D1D] hover:text-[#991B1B] font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Grid Cards */}
          {isLoadingRewards ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-3xl p-6 border border-[#E2E8F0] animate-pulse space-y-4">
                  <div className="w-full h-36 bg-slate-100 rounded-2xl" />
                  <div className="h-5 bg-slate-100 rounded-md w-3/4" />
                  <div className="h-4 bg-slate-100 rounded-md w-full" />
                  <div className="h-10 bg-slate-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : rewards.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-[#E2E8F0]">
              <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-700">No reward items currently active</p>
              <p className="text-xs text-slate-400 mt-1">
                The factory owner hasn't published reward catalog items yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.map((reward) => {
                const currentBalance = customer?.pointsBalance || 0
                const progressPct = Math.min(100, Math.round((currentBalance / reward.pointsCost) * 100))
                const canAfford = currentBalance >= reward.pointsCost
                const isOutOfStock = reward.stock <= 0
                const pointsNeeded = Math.max(0, reward.pointsCost - currentBalance)

                return (
                  <div
                    key={reward.id}
                    className="bg-white rounded-3xl border border-[#E2E8F0] hover:border-emerald-300 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full text-xs font-black font-mono bg-emerald-50 text-[#14532D] border border-emerald-200">
                          {reward.pointsCost} PTS
                        </span>
                        {isOutOfStock ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                            {reward.stock} in stock
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-lg font-bold text-slate-900 group-hover:text-[#166534] transition-colors mb-2">
                        {reward.title}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-6">
                        {reward.description}
                      </p>
                    </div>

                    <div>
                      {/* Progress toward Goal */}
                      <div className="space-y-1.5 mb-5 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Goal Progress</span>
                          <span className="font-bold text-slate-700 font-mono">
                            {canAfford ? (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                Ready to claim!
                              </span>
                            ) : (
                              `${pointsNeeded} pts to go`
                            )}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              canAfford ? 'bg-emerald-500' : 'bg-[#166534]'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => handleRedeemReward(reward)}
                        disabled={!canAfford || isOutOfStock || redeemingRewardId === reward.id}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                          canAfford && !isOutOfStock
                            ? 'bg-[#166534] hover:bg-[#14532D] text-white shadow-sm hover:shadow-md'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {redeemingRewardId === reward.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Redeeming...
                          </>
                        ) : isOutOfStock ? (
                          'Out of Stock'
                        ) : canAfford ? (
                          <>
                            Redeem Now <ArrowRight className="w-4 h-4" />
                          </>
                        ) : (
                          `Requires ${reward.pointsCost} Points`
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 4. ACTIVITY & CLAIM HISTORY TABS */}
        <section className="bg-white rounded-3xl border border-[#E2E8F0] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <History className="w-5 h-5 text-[#166534]" />
                Wallet Activity Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Track every box verified and reward fulfilled under your account.
              </p>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('boxes')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'boxes'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Claimed Boxes ({claimedBoxes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rewards')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'rewards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Reward Redemptions ({redemptions.length})
              </button>
            </div>
          </div>

          {/* TAB 1: CLAIMED BOXES */}
          {activeTab === 'boxes' && (
            <div>
              {!customer ? (
                <div className="py-12 text-center">
                  <Box className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">
                    No active wallet loaded
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Enter your email or phone in the lookup bar above to view your claimed packaging history.
                  </p>
                </div>
              ) : claimedBoxes.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">
                    No box codes claimed yet
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Your claimed codes will appear here once you verify your first box.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Box Code</th>
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4">Batch</th>
                        <th className="py-3 px-4">Points Added</th>
                        <th className="py-3 px-4 text-right">Redeemed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {claimedBoxes.map((box) => (
                        <tr key={box.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#14532D]">
                            {box.code}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {box.productName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-xs">
                            {box.batchName}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                              +{box.pointsEarned} PTS
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-400 text-xs">
                            {box.redeemedAt
                              ? new Date(box.redeemedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recently'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REWARD REDEMPTIONS */}
          {activeTab === 'rewards' && (
            <div>
              {!customer ? (
                <div className="py-12 text-center">
                  <Gift className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">
                    No active wallet loaded
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Enter your email or phone in the lookup bar above to view your redeemed physical rewards.
                  </p>
                </div>
              ) : redemptions.length === 0 ? (
                <div className="py-12 text-center">
                  <Gift className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">
                    No reward redemptions yet
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Select any reward from the catalog above to redeem your earned points!
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Reward Item</th>
                        <th className="py-3 px-4">Points Spent</th>
                        <th className="py-3 px-4">Fulfillment Status</th>
                        <th className="py-3 px-4 text-right">Redeemed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {redemptions.map((redemption) => (
                        <tr key={redemption.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {redemption.reward?.title || 'Reward Item'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                            {redemption.pointsSpent} PTS
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                redemption.status === 'FULFILLED'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {redemption.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-400 text-xs">
                            {new Date(redemption.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-[#E2E8F0] bg-white py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-600 font-semibold">
            <Package className="w-4 h-4 text-[#166534]" />
            <span>EcoRewards™ Factory Box Code Engine</span>
          </div>
          <p>© {new Date().getFullYear()} Factory Loyalty Rewards System. Eco-friendly certified packaging.</p>
        </div>
      </footer>
    </div>
  )
}

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#166534] font-semibold text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading EcoRewards™ Portal...
          </div>
        </div>
      }
    >
      <CustomerPortal />
    </Suspense>
  )
}
