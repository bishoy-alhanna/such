import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Sub {
  status: string
  plan: string
  daysLeftInTrial?: number
}

export default function SubscriptionBanner() {
  const { user } = useAuth()
  const [sub, setSub] = useState<Sub | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user || user.role === 'SystemAdmin') return
    setDismissed(false)
    api.get<Sub>('/subscription')
      .then(r => setSub(r.data))
      .catch(() => {})
  }, [user?.id])

  if (!sub || dismissed || !user || user.role === 'SystemAdmin') return null

  const trialEnding = sub.status === 'Trial' && (sub.daysLeftInTrial ?? 99) <= 7
  const pastDue     = sub.status === 'PastDue'

  if (!trialEnding && !pastDue) return null

  const bg   = pastDue ? '#dc2626' : '#d97706'
  const icon = pastDue ? 'alert-circle' : 'time-outline'
  const msg  = pastDue
    ? 'الاشتراك متأخر السداد. يرجى تسوية الفاتورة للحفاظ على الوصول الكامل.'
    : `تنتهي الفترة التجريبية خلال ${sub.daysLeftInTrial} ${(sub.daysLeftInTrial ?? 0) === 1 ? 'يوم' : 'أيام'}. يرجى الترقية للاستمرار.`

  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={18} color="#fff" style={s.icon} />
      <Text style={s.msg}>{msg}</Text>
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  icon:   { flexShrink: 0 },
  msg:    { flex: 1, color: '#fff', fontSize: 12, textAlign: 'right', lineHeight: 18 },
})
