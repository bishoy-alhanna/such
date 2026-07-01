import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'

type Step = 'national-id' | 'credentials-only' | 'full-form'

interface CheckResult { found: boolean; memberName?: string; alreadyRegistered?: boolean }

const EMPTY = {
  username: '', password: '', confirmPassword: '',
  fullName: '', gender: '', dateOfBirth: '',
  mobile: '', fatherNationalId: '',
  isMarried: false, husbandNationalId: '',
}

export default function SignupScreen() {
  const navigation = useNavigation<any>()
  const [nationalId, setNationalId] = useState('')
  const [check,      setCheck]      = useState<CheckResult | null>(null)
  const [checking,   setChecking]   = useState(false)
  const [checkErr,   setCheckErr]   = useState('')
  const [step,       setStep]       = useState<Step>('national-id')
  const [form,       setForm]       = useState({ ...EMPTY })
  const [submitting, setSubmitting] = useState(false)
  const [submitErr,  setSubmitErr]  = useState('')
  const [done,       setDone]       = useState(false)

  const set = (k: keyof typeof EMPTY, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleCheck = async () => {
    setCheckErr(''); setCheck(null)
    if (!/^\d{14}$/.test(nationalId)) { setCheckErr('الرقم القومي يجب أن يكون 14 رقم.'); return }
    setChecking(true)
    try {
      const r = await api.get<CheckResult>('/auth/check-national-id', { params: { nationalId } })
      const res = r.data
      setCheck(res)
      if (res.alreadyRegistered) { setCheckErr('هذا الرقم القومي مسجل بالفعل. يرجى تسجيل الدخول.'); return }
      setStep(res.found ? 'credentials-only' : 'full-form')
    } catch { setCheckErr('فشل التحقق. يرجى المحاولة مرة أخرى.') }
    finally  { setChecking(false) }
  }

  const handleSubmit = async () => {
    setSubmitErr('')
    if (!form.username.trim()) return setSubmitErr('اسم المستخدم مطلوب.')
    if (!form.password)        return setSubmitErr('كلمة المرور مطلوبة.')
    if (form.password !== form.confirmPassword) return setSubmitErr('كلمتا المرور غير متطابقتين.')
    if (step === 'full-form' && !form.fullName.trim()) return setSubmitErr('الاسم الكامل مطلوب.')

    const isMarriedFemale = step === 'full-form' && form.gender === 'Female' && form.isMarried
    setSubmitting(true)
    try {
      await api.post('/auth/signup', {
        username:          form.username.trim(),
        password:          form.password,
        nationalId,
        fullName:          step === 'full-form' ? form.fullName.trim()       : undefined,
        gender:            step === 'full-form' ? form.gender || undefined    : undefined,
        dateOfBirth:       step === 'full-form' && form.dateOfBirth ? form.dateOfBirth : undefined,
        mobile:            step === 'full-form' ? form.mobile || undefined    : undefined,
        fatherNationalId:  step === 'full-form' ? form.fatherNationalId || undefined : undefined,
        isMarried:         isMarriedFemale,
        husbandNationalId: isMarriedFemale ? form.husbandNationalId || undefined : undefined,
      })
      setDone(true)
    } catch (err: any) {
      setSubmitErr(err?.response?.data?.message ?? 'فشل التسجيل. يرجى المحاولة مرة أخرى.')
    } finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <View style={s.center}>
        <View style={s.card}>
          <Text style={s.doneIcon}>✓</Text>
          <Text style={s.doneTitle}>تم تقديم الطلب</Text>
          <Text style={s.doneSub}>حسابك قيد المراجعة. ستتمكن من تسجيل الدخول بعد موافقة المشرف.</Text>
          <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Login')}>
            <Text style={s.btnText}>العودة لتسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>إنشاء حساب</Text>
        <Text style={s.subtitle}>رعاية — ShepherdCare</Text>

        {/* National ID */}
        <Text style={s.label}>الرقم القومي (14 رقم) *</Text>
        <View style={s.row}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            value={nationalId}
            onChangeText={t => { setNationalId(t.replace(/\D/g, '').slice(0, 14)); setCheck(null); setStep('national-id') }}
            placeholder="12345678901234"
            keyboardType="numeric"
            maxLength={14}
            placeholderTextColor="#9ca3af"
            textAlign="right"
            editable={!(step !== 'national-id' && !!check)}
          />
          {step === 'national-id' && (
            <TouchableOpacity
              style={[s.btn, { marginLeft: 8, paddingVertical: 12, paddingHorizontal: 18 }]}
              onPress={handleCheck}
              disabled={checking || nationalId.length !== 14}
            >
              {checking ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>تحقق</Text>}
            </TouchableOpacity>
          )}
          {step !== 'national-id' && (
            <TouchableOpacity
              style={[s.btnOutline, { marginLeft: 8 }]}
              onPress={() => { setStep('national-id'); setCheck(null); setCheckErr('') }}
            >
              <Text style={s.btnOutlineText}>تغيير</Text>
            </TouchableOpacity>
          )}
        </View>
        {!!checkErr && <Text style={s.error}>{checkErr}</Text>}

        {check?.found && !check.alreadyRegistered && (
          <View style={s.foundBanner}>
            <Text style={s.foundText}>✓ تم العثور على عضو: <Text style={{ fontWeight: '700' }}>{check.memberName}</Text></Text>
          </View>
        )}
        {check && !check.found && (
          <View style={s.notFoundBanner}>
            <Text style={s.notFoundText}>لم يتم العثور على سجل. يرجى إدخال بياناتك للتسجيل.</Text>
          </View>
        )}

        {/* Full form for new members */}
        {step === 'full-form' && (
          <>
            <Text style={s.label}>الاسم الكامل *</Text>
            <TextInput style={s.input} value={form.fullName} onChangeText={v => set('fullName', v)} placeholder="الاسم بالكامل" placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.label}>الجنس</Text>
            <View style={s.segmentRow}>
              {['Male', 'Female'].map(g => (
                <TouchableOpacity key={g} style={[s.segment, form.gender === g && s.segmentActive]} onPress={() => set('gender', g)}>
                  <Text style={[s.segmentText, form.gender === g && s.segmentTextActive]}>{g === 'Male' ? 'ذكر' : 'أنثى'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>تاريخ الميلاد</Text>
            <TextInput style={s.input} value={form.dateOfBirth} onChangeText={v => set('dateOfBirth', v)} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" keyboardType="numeric" />

            <Text style={s.label}>الهاتف</Text>
            <TextInput style={s.input} value={form.mobile} onChangeText={v => set('mobile', v)} placeholder="01xxxxxxxxx" keyboardType="phone-pad" placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.label}>الرقم القومي للأب</Text>
            <TextInput style={s.input} value={form.fatherNationalId} onChangeText={v => set('fatherNationalId', v.replace(/\D/g, '').slice(0, 14))} placeholder="14 رقم (اختياري)" keyboardType="numeric" maxLength={14} placeholderTextColor="#9ca3af" textAlign="right" />

            {/* Married female fields */}
            {form.gender === 'Female' && (
              <>
                <Text style={s.label}>الحالة الاجتماعية</Text>
                <View style={s.segmentRow}>
                  {[{ v: false, l: 'عزباء' }, { v: true, l: 'متزوجة' }].map(opt => (
                    <TouchableOpacity key={String(opt.v)} style={[s.segment, form.isMarried === opt.v && s.segmentActive]} onPress={() => setForm(p => ({ ...p, isMarried: opt.v, husbandNationalId: '' }))}>
                      <Text style={[s.segmentText, form.isMarried === opt.v && s.segmentTextActive]}>{opt.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {form.isMarried && (
                  <>
                    <Text style={s.label}>الرقم القومي للزوج</Text>
                    <TextInput style={s.input} value={form.husbandNationalId} onChangeText={v => set('husbandNationalId', v.replace(/\D/g, '').slice(0, 14))} placeholder="14 رقم (اختياري)" keyboardType="numeric" maxLength={14} placeholderTextColor="#9ca3af" textAlign="right" />
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Credentials — shown in both non-national-id steps */}
        {(step === 'credentials-only' || step === 'full-form') && (
          <>
            <Text style={s.label}>اسم المستخدم *</Text>
            <TextInput style={s.input} value={form.username} onChangeText={v => set('username', v)} placeholder="username" autoCapitalize="none" autoCorrect={false} placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.label}>كلمة المرور *</Text>
            <TextInput style={s.input} value={form.password} onChangeText={v => set('password', v)} placeholder="••••••••" secureTextEntry placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.label}>تأكيد كلمة المرور *</Text>
            <TextInput style={s.input} value={form.confirmPassword} onChangeText={v => set('confirmPassword', v)} placeholder="••••••••" secureTextEntry placeholderTextColor="#9ca3af" textAlign="right" />

            {!!submitErr && <Text style={s.error}>{submitErr}</Text>}

            <TouchableOpacity style={[s.btn, { marginTop: 8 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تقديم الطلب</Text>}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.signupLink} onPress={() => navigation.navigate('Login')}>
          <Text style={s.signupText}>لديك حساب بالفعل؟ <Text style={s.signupHighlight}>تسجيل الدخول</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:             { flex: 1, backgroundColor: '#f8fafc' },
  container:        { padding: 24, paddingBottom: 48 },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title:            { fontSize: 26, fontWeight: '800', color: '#1f2937', textAlign: 'right', marginBottom: 4 },
  subtitle:         { fontSize: 13, color: '#9ca3af', textAlign: 'right', marginBottom: 24 },
  label:            { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, textAlign: 'right', marginTop: 12 },
  input:            { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827', marginBottom: 4, backgroundColor: '#fff' },
  row:              { flexDirection: 'row', alignItems: 'center' },
  error:            { color: '#dc2626', fontSize: 13, textAlign: 'right', marginTop: 4 },
  foundBanner:      { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, padding: 10, marginTop: 8 },
  foundText:        { color: '#15803d', fontSize: 13, textAlign: 'right' },
  notFoundBanner:   { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 10, marginTop: 8 },
  notFoundText:     { color: '#92400e', fontSize: 13, textAlign: 'right' },
  segmentRow:       { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segment:          { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
  segmentActive:    { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  segmentText:      { fontSize: 14, color: '#374151' },
  segmentTextActive:{ color: '#fff', fontWeight: '600' },
  btn:              { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText:          { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline:       { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  btnOutlineText:   { fontSize: 14, color: '#374151' },
  card:             { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  doneIcon:         { fontSize: 52, color: '#10b981', marginBottom: 12 },
  doneTitle:        { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 8 },
  doneSub:          { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  signupLink:       { marginTop: 24, alignItems: 'center' },
  signupText:       { fontSize: 14, color: '#6b7280' },
  signupHighlight:  { color: '#6366f1', fontWeight: '600' },
})
