'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ProfileData = {
  username: string | null
  gems: number
  created_at: string
}

type Stats = {
  uniqueCards: number
  totalCards: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({ uniqueCards: 0, totalCards: 0 })
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setEmail(user.email ?? null)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, gems, created_at')
        .eq('user_id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setUsername(profileData.username ?? '')
      }

      const { data: cards } = await supabase
        .from('user_characters')
        .select('count')
        .eq('user_id', user.id)

      if (cards) {
        setStats({
          uniqueCards: cards.length,
          totalCards: cards.reduce((sum, c) => sum + c.count, 0),
        })
      }

      setLoading(false)
    }
    load()
  }, [])

  async function saveUsername() {
    setSaving(true)
    setSaveMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim() || null })
      .eq('user_id', user.id)

    setSaveMessage(error ? 'Failed to save.' : 'Username saved!')
    setSaving(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading profile...</div>
      </main>
    )
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <h1 className="text-xl font-black">Profile</h1>
          <div className="w-16" />
        </div>

        {/* Avatar + name */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-violet-800 border-2 border-violet-500 flex items-center justify-center text-3xl mx-auto mb-3">
            ⚔️
          </div>
          <p className="text-xl font-black text-white">{profile?.username || 'Unnamed Trainer'}</p>
          <p className="text-gray-500 text-sm">{email}</p>
          <p className="text-gray-600 text-xs mt-1">Member since {memberSince}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Gems', value: profile?.gems ?? 0, color: 'text-yellow-400', icon: '💎' },
            { label: 'Unique Cards', value: stats.uniqueCards, color: 'text-violet-400', icon: '🎴' },
            { label: 'Total Pulled', value: stats.totalCards, color: 'text-blue-400', icon: '✨' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-gray-500 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Edit username */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <p className="text-white font-bold mb-3">Display Name</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter a username..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
              maxLength={32}
              className="flex-1 bg-gray-800 text-white placeholder-gray-600 border border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              onClick={saveUsername}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-xl px-4 py-2.5 transition-colors"
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>
          {saveMessage && (
            <p className={`text-sm mt-2 ${saveMessage.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>
              {saveMessage}
            </p>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white font-semibold rounded-2xl py-3 transition-colors"
        >
          Sign Out
        </button>

      </div>
    </main>
  )
}
